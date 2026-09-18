import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Project } from "ts-morph";

import { uploadProductionGeneratedImage } from "../../src/lib/local-runtime/production/cloud-client.js";
import { sha256, type WebsiteAgentTask } from "../../src/lib/local-runtime/production/contracts.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { UploadedResultReceiptSchema } from "../../src/lib/local-runtime/production/transport-protocol.js";
import { typedExecutionFailure } from "../../src/lib/execution-failure.js";
import { inspectGeneratedImageTransport } from
  "../audit/domains/agent-production-runtime/contract-inspection.js";
import { HASH_A, HASH_B, HASH_C, claimTask } from "./agent-production-runtime-fixtures.js";

const materialReceipt = (input: Readonly<{
  artifactId: string; objectRef: string; sha256: string; byteLength: number; receiptHash: string;
}>) => ({
  schema_version: "xuanxue-ai-material-receipt.v6",
  artifact_id: input.artifactId,
  role: "generated_image",
  object_ref: input.objectRef,
  sha256: input.sha256,
  byte_length: input.byteLength,
  media_type: "image/webp",
  state: "staged",
  receipt_hash: input.receiptHash,
});

const webpImage = (artifactId: string, content: string) => {
  const webpBytes = new TextEncoder().encode(content);
  return Object.freeze({
    artifact_id: artifactId, webp_bytes: webpBytes, sha256: sha256(webpBytes), bytes: webpBytes.byteLength,
    media_type: "image/webp" as const, width: 1536, height: 1024,
  });
};

const receiptResponder = (onUpload: () => void, receipt: (uploadArtifactId: string) => unknown) =>
  (async (input: string | URL | Request) => {
    onUpload();
    const uploadArtifactId = decodeURIComponent(new URL(String(input)).pathname.split("/").at(-1)!);
    return new Response(JSON.stringify({ ok: true, data: receipt(uploadArtifactId) }),
      { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof globalThis.fetch;

const localIdentityMismatch = (error: unknown): boolean =>
  typedExecutionFailure(error)?.code === "GENERATED_IMAGE_LOCAL_IDENTITY_MISMATCH";

const exerciseGeneratedImageUpload = async (productionTask: WebsiteAgentTask): Promise<void> => {
  const imageTemporary = await mkdtemp(path.join(tmpdir(), "agent-generated-image-"));
  const imageStore = new ProductionRuntimeStore(imageTemporary);
  const enqueueGeneratedImage = imageStore.enqueue.bind(imageStore);
  let imageEnqueues = 0;
  imageStore.enqueue = ((write) => {
    imageEnqueues += 1;
    return enqueueGeneratedImage(write);
  }) as typeof imageStore.enqueue;
  const imageFetch = globalThis.fetch;
  let physicalImageUploads = 0;
  const countUpload = (): void => { physicalImageUploads += 1; };
  try {
    const image = webpImage("image:fixture", "fixture-webp");
    globalThis.fetch = receiptResponder(countUpload, (artifactId) => materialReceipt({
      artifactId, objectRef: "object:image:fixture", sha256: image.sha256, byteLength: image.bytes,
      receiptHash: HASH_C,
    }));
    const imageJob = claimTask(productionTask);
    const imageSession = {
      device: { server_base_url: "https://production.invalid" },
      authorizationHeaders: async (headers: Record<string, string>) => headers,
    } as never;
    for (const invalidImage of [
      { ...image, bytes: image.bytes + 1 },
      { ...image, sha256: HASH_A },
      { ...image, media_type: "image/png" },
    ]) {
      await assert.rejects(uploadProductionGeneratedImage(imageSession, imageStore, imageJob, invalidImage as never),
        localIdentityMismatch, "Runtime must reject local WebP byte-length, hash, and media identity drift before upload");
    }
    assert.equal(physicalImageUploads, 0,
      "local generated-image identity failures must not create a physical Website upload");
    const first = await uploadProductionGeneratedImage(imageSession, imageStore, imageJob, image);
    const repeated = await uploadProductionGeneratedImage(imageSession, imageStore, imageJob, image);
    assert.equal(physicalImageUploads, 1, "the generated image transport must be physically delivered once");
    assert.equal(imageEnqueues, 1, "the generated image transport must persist one Outbox intent");
    assert.deepEqual(repeated.receipt, first.receipt);
    assert.equal(first.receipt.object_ref, "object:image:fixture");
    await assert.rejects(
      uploadProductionGeneratedImage(imageSession, imageStore, imageJob, {
        ...image, webp_bytes: new Uint8Array([1, 2, 3]),
      }),
      localIdentityMismatch, "a delivered Outbox receipt must not bypass current local WebP identity validation",
    );
    assert.equal(physicalImageUploads, 1,
      "a corrupt delivered replay must fail before a second physical Website upload");
    assert.equal(imageEnqueues, 1,
      "a corrupt delivered replay must fail before a second Outbox enqueue");
    const secondImage = webpImage("image:fixture-second", "fixture-webp-second");
    globalThis.fetch = receiptResponder(countUpload, () => materialReceipt({
      artifactId: "image:wrong", objectRef: "object:image:wrong", sha256: secondImage.sha256,
      byteLength: secondImage.bytes, receiptHash: HASH_C,
    }));
    await assert.rejects(
      uploadProductionGeneratedImage(imageSession, imageStore, imageJob, secondImage),
      (error: unknown) => typedExecutionFailure(error)?.code === "GENERATED_IMAGE_WEBSITE_RECEIPT_MISMATCH",
      "an artifact receipt for a different image must not terminalize the existing Outbox intent",
    );
  } finally {
    globalThis.fetch = imageFetch;
    imageStore.close();
    await rm(imageTemporary, { recursive: true, force: true });
  }
};

const RUNTIME_ROOT = "src/lib/local-runtime/production";
const replaceIn = (file: string, from: string, to: string) => (project: Project): void => {
  const source = project.getSourceFileOrThrow(path.resolve(`${RUNTIME_ROOT}/${file}`));
  assert.ok(source.getFullText().includes(from), `generated-image mutant anchor must exist: ${from}`);
  source.replaceWithText(source.getFullText().replace(from, to));
};

const swapIdentityAfterDeliveredShortcut = (project: Project): void => {
  const file = project.getSourceFileOrThrow(path.resolve(`${RUNTIME_ROOT}/cloud-client.ts`));
  const source = file.getFullText();
  const functionStart = source.indexOf("async function uploadGeneratedImage");
  const identityStart = source.indexOf("  const bytes = Buffer.from(image.webp_bytes);", functionStart);
  const deliveredStart = source.indexOf("  const delivered = store.readOutboxAuthority(requestId);", identityStart);
  const durableStart = source.indexOf("  const durableHeaders = {", deliveredStart);
  assert.ok(functionStart >= 0 && identityStart >= 0 && deliveredStart > identityStart
    && durableStart > deliveredStart, "generated-image guard blocks must remain discoverable");
  file.replaceWithText(source.slice(0, identityStart)
    + source.slice(deliveredStart, durableStart)
    + source.slice(identityStart, deliveredStart)
    + source.slice(durableStart));
};

const exerciseGeneratedImageInspectorMutants = (): void => {
  for (const mutate of [
    replaceIn("transport-protocol.ts", "}).strict();\n\nexport type UploadedResultReceipt",
      "}).passthrough();\n\nexport type UploadedResultReceipt"),
    replaceIn("cloud-client.ts", "): Promise<UploadedResultReceipt> {\n  const uploadArtifactId",
      "): Promise<UploadedResultReceipt> {\n  void image.originalSha256;\n  const uploadArtifactId"),
    replaceIn("cloud-client.ts", "bytes.byteLength !== image.bytes", "false"),
    replaceIn("cloud-client.ts", "sha256(bytes) !== image.sha256", "false"),
    replaceIn("cloud-client.ts", 'image.media_type !== "image/webp"', "false"),
    swapIdentityAfterDeliveredShortcut,
  ]) {
    const project = new Project({ tsConfigFilePath: "tsconfig.json" });
    mutate(project);
    const findings: Parameters<typeof inspectGeneratedImageTransport>[1] = [];
    inspectGeneratedImageTransport({ project, sealedRoot: process.cwd() } as never, findings);
    assert.ok(findings.some((finding) =>
      finding.checkId === "agent-production-runtime/generated-image-transport-boundary"),
    "receipt, Provider-original, local WebP identity and delivered-shortcut mutants must fail the Runtime inspector");
  }
};

/** Generated-image WebP identity, one physical upload, V6 receipt strictness and inspector mutants. */
export const exerciseGeneratedImageTransport = async (productionTask: WebsiteAgentTask): Promise<void> => {
  await exerciseGeneratedImageUpload(productionTask);
  const uploadedImageReceipt = materialReceipt({
    artifactId: "artifact:image", objectRef: "object:image", sha256: HASH_A, byteLength: 42, receiptHash: HASH_B,
  });
  assert.doesNotThrow(() => UploadedResultReceiptSchema.parse(uploadedImageReceipt));
  assert.throws(() => UploadedResultReceiptSchema.parse({ ...uploadedImageReceipt, width: 1024, height: 1536 }),
    /unrecognized_keys/u, "V6 uploaded receipt must reject geometry and every other unknown field");
  exerciseGeneratedImageInspectorMutants();
};
