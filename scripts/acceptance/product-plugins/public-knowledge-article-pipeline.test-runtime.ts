import { createHash } from "node:crypto";
import sharp from "sharp";
import { governanceAssert as assert } from "../../audit/shared/governance-exam-assert.js";
import type { ProductGptTools } from "../../../src/capabilities/gpt/index.js";
import type { SharedExecutionContext } from "../../../src/mediator/product-plugin-contract.js";
import { productionRoutePolicy } from "../../../src/lib/local-runtime/production/route-policy.js";
import { executionFailure } from "../../../src/lib/execution-failure.js";
import { articleOutput, researchOutput } from "./public-knowledge-article-pipeline-output-fixtures.js";
import { CONFIRMED_AT, HASH, type SeoCall, type SeoFailure, type SeoHarness } from
  "./public-knowledge-article-pipeline-fixture-state.js";

type SeoExecuteInput = Parameters<ProductGptTools["execute"]>[0];
const SEO_CONVERSATION_URL = "https://chatgpt.com/c/seo-flow";
type ImageFixture = Readonly<{ bytes: Uint8Array; hash: `sha256:${string}`; mediaType: `image/${string}` }>;
const imageFixture = (bytes: Uint8Array, mediaType: `image/${string}`): ImageFixture => Object.freeze({
  bytes, mediaType,
  hash: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
});
export const PORTRAIT_IMAGE_FIXTURE = imageFixture(
  new Uint8Array(await sharp({ create: { width: 1024, height: 1536,
    channels: 3, background: { r: 24, g: 48, b: 72 } } }).png().toBuffer()),
  "image/png",
);
const orientedSourcePixels = Buffer.alloc(320 * 640 * 3);
for (let y = 0; y < 640; y += 1) for (let x = 0; x < 320; x += 1) {
  const offset = (y * 320 + x) * 3;
  const left = x < 160;
  const top = y < 320;
  const [red, green, blue] = top
    ? left ? [240, 10, 10] : [10, 240, 10]
    : left ? [10, 10, 240] : [240, 240, 10];
  orientedSourcePixels[offset] = red;
  orientedSourcePixels[offset + 1] = green;
  orientedSourcePixels[offset + 2] = blue;
}
export const ORIENTED_IMAGE_FIXTURE = imageFixture(new Uint8Array(await sharp(orientedSourcePixels, {
  raw: { width: 320, height: 640, channels: 3 },
}).jpeg({ quality: 100 }).withMetadata({ orientation: 6 }).toBuffer()), "image/jpeg");
const userTurnId = (stepId: string): string => `00000000-0000-4000-8000-${String(
  stepId === "corpus_research" ? 1 : stepId === "article_synthesis" ? 3 : 5).padStart(12, "0")}`;

const outputForCall = (
  state: SeoHarness,
  call: SeoCall,
  decision: "proceed" | "decline",
  image: ImageFixture,
): unknown => {
  if (call.child === "select_gpt_model_from_start_v3") return {
    modelDisplayName: call.input.profile.startModelDisplayName,
    previousChecked: "true", selectionVersion: "gpt-model-selection.v3", state: "model-selected",
  };
  if (call.child === "reconcile_gpt_attachment_set") return { files: state.materials.map((material, index) => ({
    artifactRef: material.material_id, displayName: material.display_name,
    providerDisplayName: state.providerNames[index], sha256: HASH, bytes: 1,
  })) };
  if (call.child === "submit_exact_gpt_turn_once") return {
    status: "CONFIRMED", promptHash: call.input.promptHash,
    mutationSent: true, canonicalConversationUrl: SEO_CONVERSATION_URL,
    userTurnId: userTurnId(call.productStepId),
  };
  if (call.child === "checkpoint_gpt_text_response") {
    const payload = call.productStepId === "corpus_research" ? researchOutput(decision)
      : call.productStepId === "article_synthesis" ? articleOutput() : { decision: "no_issue", issues: [] };
    const semanticText = JSON.stringify(payload);
    return { assistantTurnId: `00000000-0000-4000-8000-${String(
      Number(userTurnId(call.productStepId).slice(-12)) + 1).padStart(12, "0")}`,
      rawDomHtml: `<article>${semanticText}</article>`,
      rawDomHash: HASH, semanticText, semanticTextHash: HASH };
  }
  if (call.child === "checkpoint_gpt_generated_image") return {
    assistantTurnId: "00000000-0000-4000-8000-000000000006", semanticMediaId: "gpt-generated-image-main",
    mediaHash: image.hash, authorityTargetHash: HASH, authorityDocumentHash: HASH,
    canonicalConversationUrl: SEO_CONVERSATION_URL,
    turnMarker: "marker", originalBytes: image.bytes,
    originalSizeBytes: image.bytes.byteLength, originalMediaType: image.mediaType,
    originalSha256: image.hash,
  };
  return {};
};

const assertCallBoundary = (call: SeoCall): void => {
  if (call.child !== "attach_approved_gpt_files_once" && call.child !== "reconcile_gpt_attachment_set") return;
  assert(Array.isArray(call.input.files));
  for (const file of call.input.files) {
    assert.deepEqual(Object.keys(file).sort(), ["artifactRef", "bytes", "displayName", "sha256"]);
  }
};

const confirmedEffect = (evidenceRef: string) => ({
  effectScope: "provider_effect", outcome: "CONFIRMED", mutationOutcome: "confirmed",
  terminalAt: CONFIRMED_AT, evidenceRef, evidenceHash: HASH,
});

export const createContext = (
  state: SeoHarness,
  decision: "proceed" | "decline",
  failureAt?: SeoFailure,
  attemptId = "attempt-1",
  image = PORTRAIT_IMAGE_FIXTURE,
): SharedExecutionContext => ({
  materials: state.materials,
  routePolicy: productionRoutePolicy("public_knowledge_article_pipeline", state.actionId),
  productSkill: Object.freeze({ text: "fixture public knowledge skill", hash: HASH }),
  gpt: {
    jobId: `job-${state.actionId}`, attemptId,
    readConfirmedSubmit: async (input) => {
      const call = input as SeoCall;
      state.submitReadbackQueries.push(call);
      if (!state.confirmedSubmitSteps.has(call.productStepId)) return null;
      const evidenceRef = `evidence:readback:${call.productStepId}`;
      return { value: outputForCall(state, call, decision, image), evidenceRef, evidenceHash: HASH,
        sourceAttemptId: attemptId, exactCallIdentityHash: HASH, artifactRefs: [],
        effectReceipt: confirmedEffect(evidenceRef) } as never;
    },
    execute: async (input: SeoExecuteInput) => {
      const call = input as SeoCall;
      assertCallBoundary(call);
      state.calls.push(call);
      if (state.remainingFailures > 0 && call.child === failureAt?.child
        && (!failureAt.productStepId || call.productStepId === failureAt.productStepId)) {
        state.remainingFailures -= 1;
        throw executionFailure("failed", failureAt.code, { metadata: { mutationOutcome: "no" } });
      }
      if (call.child === "submit_exact_gpt_turn_once") state.physicalSubmitDispatches += 1;
      const evidenceRef = `evidence:${state.calls.length}`;
      return { value: outputForCall(state, call, decision, image), evidenceRef, evidenceHash: HASH,
        sourceAttemptId: attemptId, exactCallIdentityHash: HASH,
        artifactRefs: call.child === "checkpoint_gpt_text_response" ? [`artifact:${call.productStepId}`]
          : call.child === "checkpoint_gpt_generated_image"
            ? ["artifact:image-original"] : [],
        effectReceipt: call.child === "submit_exact_gpt_turn_once" ? confirmedEffect(evidenceRef) : null } as never;
    },
  },
  resultRevision: { revision: 0, priorRejection: null },
  uploadGeneratedImage: async (artifact) => {
    state.generatedImageUploadCalls += 1;
    const metadata = await sharp(artifact.webp_bytes, { failOn: "error", limitInputPixels: false }).metadata();
    assert.deepEqual([metadata.format, metadata.width, metadata.height, metadata.exif, metadata.icc,
      metadata.iptc, metadata.xmp], ["webp", artifact.width, artifact.height, undefined, undefined, undefined, undefined]);
    if (image === ORIENTED_IMAGE_FIXTURE) {
      const decoded = await sharp(artifact.webp_bytes).raw().toBuffer({ resolveWithObject: true });
      const sample = (x: number, y: number, channel: number): number =>
        decoded.data[(y * decoded.info.width + x) * decoded.info.channels + channel]!;
      const assertColor = (x: number, y: number, dominant: readonly number[], low: readonly number[]) => {
        for (const channel of dominant) assert(sample(x, y, channel) > 180);
        for (const channel of low) assert(sample(x, y, channel) < 80);
      };
      assertColor(80, 80, [2], [0, 1]);
      assertColor(560, 80, [0], [1, 2]);
      assertColor(80, 240, [0, 1], [2]);
      assertColor(560, 240, [1], [0, 2]);
    }
    return { artifact_id: artifact.artifact_id, object_ref: `object:${artifact.artifact_id}`,
      sha256: artifact.sha256, receipt_hash: HASH, bytes: artifact.bytes,
      mime_type: artifact.media_type, width: artifact.width, height: artifact.height };
  },
  complete: async (output) => {
    state.completed = output;
    return {} as Awaited<ReturnType<SharedExecutionContext["complete"]>>;
  },
});

export const withFastHandoffs = async <T>(_state: SeoHarness, run: () => Promise<T>): Promise<T> => run();
