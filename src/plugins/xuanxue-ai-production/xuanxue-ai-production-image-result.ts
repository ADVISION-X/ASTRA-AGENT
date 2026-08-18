import type { AiFeedResult } from "../../capabilities/ai-input-gateway/index.js";
import type { XuanxueAiProductionRuntime } from "./xuanxue-ai-production.runtime.js";
import {
  XUANXUE_AI_PRODUCTION_JOB_ID,
  type XuanxueAiStageRecord,
} from "./xuanxue-ai-production.schema.js";

export const normalizeGeneratedImageResult = async (
  runtime: XuanxueAiProductionRuntime,
  orderId: string,
  stageId: XuanxueAiStageRecord["stageId"],
  result: AiFeedResult,
): Promise<AiFeedResult> => {
  if (result.outputKind !== "generated_image" || result.status !== "success") return result;
  const source = result.outputArtifacts[0];
  if (!source) throw new Error("XUANXUE_AI_PRODUCTION_IMAGE_SOURCE_MISSING");
  const processed = await runtime.mediaProcessing.processMedia({
    missionId: XUANXUE_AI_PRODUCTION_JOB_ID,
    runId: `${orderId}-${stageId}`,
    inputFilePath: source.filePath,
    presetId: "public-knowledge-hero",
    artifactPolicy: "deliverable",
    timeoutMs: 120_000,
  });
  if (processed.status !== "success" || processed.output.status !== "success") {
    throw new Error(
      `review_required: generated image normalization failed:${processed.reviewRequiredReason ?? processed.failureReason ?? "unknown"}`,
    );
  }
  const artifact = processed.output.outputArtifacts[0];
  if (!artifact || artifact.contentType !== "image/webp"
    || artifact.width !== 1200 || artifact.height !== 630) {
    throw new Error("review_required: generated image normalization contract mismatch");
  }
  const safety = await runtime.mediaProcessing.processMedia({
    missionId: XUANXUE_AI_PRODUCTION_JOB_ID,
    runId: `${orderId}-${stageId}-safety`,
    inputFilePath: artifact.filePath,
    presetId: "web-image",
    artifactPolicy: "staging",
    timeoutMs: 120_000,
  });
  if (safety.status !== "success" || safety.output.status !== "success") {
    throw new Error(`review_required: generated image safety:${safety.reviewRequiredReason ?? safety.failureReason ?? "uncertain"}`);
  }
  return {
    ...result,
    outputArtifacts: [{
      kind: "generated_image", artifactRef: artifact.artifactRef,
      filePath: artifact.filePath, mimeType: "image/webp",
      sha256: `sha256:${artifact.sha256}`,
      originalSha256: source.originalSha256,
      providerOutputRef: source.providerOutputRef,
      byteCount: artifact.byteSize, width: 1200, height: 630,
    }],
    providerProof: {
      ...result.providerProof,
      outputRefs: [...result.providerProof.outputRefs,
        `media-processing-proof:${processed.runtimeProof.proofId}`,
        `safety-proof:${safety.runtimeProof.proofId}`],
    },
  };
};
