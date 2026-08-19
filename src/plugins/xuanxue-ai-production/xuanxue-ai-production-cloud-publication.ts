import {
  XUANXUE_AI_PRODUCTION_PROVIDER_INPUT_BLOCKED_BEFORE_SUBMISSION,
  type XuanxueAiOrderRecord,
} from "./xuanxue-ai-production.schema.js";
import {
  checkpointXuanxueAiProductionJob,
  completeXuanxueAiProductionJob,
  failXuanxueAiProductionJob,
  uploadXuanxueAiProductionOutputArtifact,
} from "./xuanxue-ai-production-cloud-client.js";
import type {
  XuanxueAiProductionAttachmentCheckpointProof,
} from "./xuanxue-ai-production-cloud-client.js";
import type {
  XuanxueAiProductionCloudClaimedJob,
  XuanxueAiProductionCloudCredential,
} from "./xuanxue-ai-production-cloud-contract.js";
import { cleanXuanxueAiProductionCloudStaging } from "./xuanxue-ai-production-cloud-staging.js";

type ResultStage = NonNullable<XuanxueAiOrderRecord["result"]>["stages"][number];

const attachmentCheckpoint = (input: {
  readonly stageId: string;
  readonly proof: NonNullable<XuanxueAiOrderRecord["stages"][number]["attachmentUploadProof"]>;
}): XuanxueAiProductionAttachmentCheckpointProof => ({
  stage_id: input.stageId,
  upload_attempt_id: input.proof.uploadAttemptId,
  status: input.proof.status,
  expected_count: input.proof.expectedFileCount,
  detected_count: input.proof.detectedFileCount,
  current_file_name: [...input.proof.files]
    .sort((left, right) => left.order - right.order)
    .at(-1)?.displayFileName ?? null,
  staging_manifest_hash: input.proof.stagingManifestHash,
  observed_at: input.proof.endedAt,
});

const uploadGeneratedImageStage = async (
  credential: XuanxueAiProductionCloudCredential,
  job: XuanxueAiProductionCloudClaimedJob,
  stage: ResultStage,
): Promise<ResultStage> => {
  if (stage.outputKind !== "generated_image") return stage;
  if (!stage.artifact?.localFilePath) {
    throw new Error("XUANXUE_AI_PRODUCTION_IMAGE_LOCAL_FILE_MISSING");
  }
  if (!stage.artifact.checkpointProofRef) {
    throw new Error("XUANXUE_AI_PRODUCTION_IMAGE_CHECKPOINT_PROOF_MISSING");
  }
  const artifactId = `aiart_${job.job_id.replace(/[^A-Za-z0-9_-]/gu, "_").slice(-80)}_${stage.artifact.sha256.slice(-16)}`;
  const uploaded = await uploadXuanxueAiProductionOutputArtifact(credential, job, {
    stageId: "article_image_generation", artifactId,
    filePath: stage.artifact.localFilePath, sha256: stage.artifact.sha256,
    originalSha256: stage.artifact.originalSha256,
    executionId: stage.executionId,
    providerOutputRef: stage.artifact.providerOutputRef,
    checkpointProofRef: stage.artifact.checkpointProofRef,
    byteCount: stage.artifact.byteCount,
  });
  return {
    ...stage,
    artifact: {
      artifactId: uploaded.artifact_id, role: "generated_image",
      objectRef: uploaded.object_ref, sha256: uploaded.sha256,
      originalSha256: stage.artifact.originalSha256,
      providerOutputRef: stage.artifact.providerOutputRef,
      checkpointProofRef: stage.artifact.checkpointProofRef,
      mimeType: uploaded.mime_type, byteCount: uploaded.byte_count,
      width: uploaded.width, height: uploaded.height,
    },
  };
};

export const publishXuanxueAiProductionCloudOrder = async (input: {
  readonly credential: XuanxueAiProductionCloudCredential;
  readonly dataDir: string;
  readonly job: XuanxueAiProductionCloudClaimedJob;
  readonly record: XuanxueAiOrderRecord;
}): Promise<void> => {
  for (const stage of input.record.stages) {
    if (!stage.attachmentUploadProof) continue;
    await checkpointXuanxueAiProductionJob(input.credential, input.job, {
      status: "factory_running",
      localOrderId: input.record.order.orderId,
      attachmentUploadProof: attachmentCheckpoint({
        stageId: stage.stageId,
        proof: stage.attachmentUploadProof,
      }),
    });
  }
  if (input.record.status === "completed" && input.record.result) {
    const stages = await Promise.all(input.record.result.stages.map(
      (stage) => uploadGeneratedImageStage(input.credential, input.job, stage),
    ));
    await completeXuanxueAiProductionJob(input.credential, input.job, {
      ...input.record.result,
      stages,
    });
    await cleanXuanxueAiProductionCloudStaging(input.dataDir, input.job.job_id);
    return;
  }
  const providerBlocked = input.record.failureReason?.startsWith(
    XUANXUE_AI_PRODUCTION_PROVIDER_INPUT_BLOCKED_BEFORE_SUBMISSION,
  ) ?? false;
  const recoverable = input.record.status === "recovery_pending" && !providerBlocked;
  await failXuanxueAiProductionJob(input.credential, input.job, {
    status: recoverable ? "recovery_pending"
      : input.record.status === "review_required" ? "review_required" : "failed",
    code: providerBlocked ? XUANXUE_AI_PRODUCTION_PROVIDER_INPUT_BLOCKED_BEFORE_SUBMISSION
      : recoverable ? "XUANXUE_AI_PRODUCTION_LOCAL_RECOVERY_PENDING"
        : input.record.status === "review_required"
          ? "XUANXUE_AI_PRODUCTION_LOCAL_REVIEW_REQUIRED"
          : "XUANXUE_AI_PRODUCTION_LOCAL_FAILED",
    reason: input.record.failureReason ?? "local factory ended without a complete result",
    recoverable,
    localOrderId: input.record.order.orderId,
  });
};

export { attachmentCheckpoint as toXuanxueAiProductionAttachmentCheckpoint };
