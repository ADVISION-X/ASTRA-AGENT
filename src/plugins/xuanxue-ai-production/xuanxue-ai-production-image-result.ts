import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import type { AiFeedResult } from "../../capabilities/ai-input-gateway/index.js";
import type { XuanxueAiProductionRuntime } from "./xuanxue-ai-production.runtime.js";
import type { XuanxueAiStageRecord } from "./xuanxue-ai-production.schema.js";

type NormalizedImage = {
  artifactRef: string;
  byteCount: number;
  filePath: string;
  height: number;
  proofId: string;
  sha256: `sha256:${string}`;
  width: number;
};

const generatedImageRoot = (dataDir: string): string =>
  path.join(dataDir, "runtime-data", "ai-input-gateway", "generated-images");

const assertOwnedSource = async (dataDir: string, sourcePath: string): Promise<string> => {
  const ownedRoot = await realpath(generatedImageRoot(dataDir));
  const resolvedSource = await realpath(sourcePath);
  if (resolvedSource !== ownedRoot && !resolvedSource.startsWith(`${ownedRoot}${path.sep}`)) {
    throw new Error("XUANXUE_AI_PRODUCTION_IMAGE_SOURCE_OUTSIDE_OWNER_ROOT");
  }
  return resolvedSource;
};

const buildOutputDirectory = async (
  dataDir: string,
  orderId: string,
  stageId: XuanxueAiStageRecord["stageId"],
): Promise<string> => {
  const runHash = createHash("sha256").update(`${orderId}:${stageId}`).digest("hex");
  const outputDirectory = path.join(
    dataDir,
    "runtime-data",
    "xuanxue-ai-production",
    "generated-images",
    runHash,
  );
  await mkdir(outputDirectory, { recursive: true });
  return outputDirectory;
};

const normalizeImage = async (
  runtime: XuanxueAiProductionRuntime,
  orderId: string,
  stageId: XuanxueAiStageRecord["stageId"],
  sourcePath: string,
): Promise<NormalizedImage> => {
  const resolvedSource = await assertOwnedSource(runtime.dataDir, sourcePath);
  const outputDirectory = await buildOutputDirectory(runtime.dataDir, orderId, stageId);
  const filePath = path.join(outputDirectory, "public-knowledge-hero.webp");
  await sharp(resolvedSource)
    .rotate()
    .resize({
      width: 1200,
      height: 630,
      fit: "contain",
      background: { r: 238, g: 234, b: 224, alpha: 1 },
    })
    .webp({ quality: 86 })
    .toFile(filePath);
  const [bytes, metadata] = await Promise.all([
    readFile(filePath),
    sharp(filePath).metadata(),
  ]);
  if (metadata.width !== 1200 || metadata.height !== 630 || metadata.format !== "webp") {
    throw new Error("XUANXUE_AI_PRODUCTION_IMAGE_NORMALIZATION_CONTRACT_MISMATCH");
  }
  const proofId = `xuanxue_image_proof_${randomUUID()}`;
  const sha256 = `sha256:${createHash("sha256").update(bytes).digest("hex")}` as const;
  await writeFile(path.join(outputDirectory, "proof.json"), `${JSON.stringify({
    proofId,
    artifactSha256: sha256,
    byteCount: bytes.byteLength,
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
  }, null, 2)}\n`);
  return {
    artifactRef: `xuanxue_generated_image_${randomUUID()}`,
    byteCount: bytes.byteLength,
    filePath,
    height: metadata.height,
    proofId,
    sha256,
    width: metadata.width,
  };
};

export const normalizeGeneratedImageResult = async (
  runtime: XuanxueAiProductionRuntime,
  orderId: string,
  stageId: XuanxueAiStageRecord["stageId"],
  result: AiFeedResult,
): Promise<AiFeedResult> => {
  if (result.outputKind !== "generated_image" || result.status !== "success") return result;
  const source = result.outputArtifacts[0];
  if (!source) throw new Error("XUANXUE_AI_PRODUCTION_IMAGE_SOURCE_MISSING");
  const normalized = await normalizeImage(runtime, orderId, stageId, source.filePath);
  return {
    ...result,
    outputArtifacts: [{
      kind: "generated_image",
      artifactRef: normalized.artifactRef,
      filePath: normalized.filePath,
      mimeType: "image/webp",
      sha256: normalized.sha256,
      originalSha256: source.originalSha256,
      providerOutputRef: source.providerOutputRef,
      byteCount: normalized.byteCount,
      width: normalized.width,
      height: normalized.height,
    }],
    providerProof: {
      ...result.providerProof,
      outputRefs: [
        ...result.providerProof.outputRefs,
        `xuanxue-image-normalization-proof:${normalized.proofId}`,
      ],
    },
  };
};
