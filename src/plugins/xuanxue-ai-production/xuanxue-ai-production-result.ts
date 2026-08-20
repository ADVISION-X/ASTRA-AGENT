import type { XuanxueAiProductionProfile } from "./xuanxue-ai-production.profile.js";
import {
  createAgentRuntimeReceiptV2,
  type AgentBrowserAuthorityProofV2,
} from "./xuanxue-ai-production-browser-proof.js";
import type { XuanxueAiProductionRuntime } from "./xuanxue-ai-production.runtime.js";
import type {
  XuanxueAiOrderRecord,
  XuanxueAiProductionResult,
  XuanxueAiStageRecord,
} from "./xuanxue-ai-production.schema.js";

type ResultStage = XuanxueAiProductionResult["stages"][number];

const generatedImageArtifact = (
  stage: XuanxueAiStageRecord,
): NonNullable<ResultStage["artifact"]> => {
  const result = stage.aiFeedResult!;
  const artifact = result.outputArtifacts[0];
  if (
    !artifact || artifact.mimeType !== "image/webp"
    || artifact.width !== 1200 || artifact.height !== 630
  ) throw new Error("XUANXUE_AI_PRODUCTION_IMAGE_ARTIFACT_INVALID");
  const checkpointProofRef = result.providerProof.outputRefs.find(
    (ref) => ref.startsWith("media-processing-proof:"),
  );
  if (!checkpointProofRef) {
    throw new Error("XUANXUE_AI_PRODUCTION_IMAGE_CHECKPOINT_PROOF_MISSING");
  }
  return {
    artifactId: artifact.artifactRef, role: "generated_image",
    objectRef: `local:${artifact.artifactRef}`,
    sha256: artifact.sha256 as `sha256:${string}`,
    originalSha256: artifact.originalSha256 as `sha256:${string}`,
    providerOutputRef: artifact.providerOutputRef,
    mimeType: "image/webp", byteCount: artifact.byteCount,
    width: 1200, height: 630, localFilePath: artifact.filePath,
    checkpointProofRef,
  };
};

const completedResultStage = (
  stage: XuanxueAiStageRecord,
): ResultStage => {
  if (
    stage.status !== "completed" || !stage.rawResponseText
    || !stage.rawOutputHash || !stage.aiFeedResult
  ) throw new Error(`XUANXUE_AI_PRODUCTION_STAGE_INCOMPLETE:${stage.stageId}`);
  return {
    outputKind: stage.aiFeedResult.outputKind,
    stageId: stage.stageId, executionId: stage.executionId,
    rawResponseText: stage.rawResponseText, rawOutputHash: stage.rawOutputHash,
    providerProof: stage.aiFeedResult.providerProof,
    transportWarnings: stage.aiFeedResult.transportWarnings ?? [],
    ...(stage.aiFeedResult.outputKind === "generated_image"
      ? { artifact: generatedImageArtifact(stage) }
      : {}),
  };
};

export const completeXuanxueAiProductionOrder = (
  runtime: XuanxueAiProductionRuntime,
  record: XuanxueAiOrderRecord,
  profile: XuanxueAiProductionProfile,
  browserAuthorityProof?: AgentBrowserAuthorityProofV2,
): XuanxueAiOrderRecord => {
  const updatedAt = new Date().toISOString();
  const runtimeReceipt = browserAuthorityProof
    ? createAgentRuntimeReceiptV2({
      executionRef: record.order.orderId,
      browserRequired: true,
      browserAuthorityProof,
      dynamicProofVerdictRef: null,
    })
    : undefined;
  const result: XuanxueAiProductionResult = {
    orderId: record.order.orderId,
    sourceTaskId: record.order.sourceTaskId,
    productId: record.order.productId,
    inputBundleRef: record.order.inputBundleRef,
    inputBundleHash: record.order.inputBundleHash,
    requestHash: record.order.requestHash,
    contractManifestHash: record.order.contractManifestHash as `sha256:${string}` | null,
    productContractHash: record.order.productContractHash as `sha256:${string}` | null,
    localizationRole: record.order.localizationRole,
    status: "completed",
    finalStageId: profile.finalStageId,
    stages: record.stages.map(completedResultStage),
    ...(runtimeReceipt ? { runtimeReceipt } : {}),
    failureReason: null,
    createdAt: record.createdAt,
    updatedAt,
  };
  return runtime.store.updateOrder({
    orderId: record.order.orderId, status: "completed", result,
    failureReason: null, updatedAt, eventType: "order_completed",
  });
};
