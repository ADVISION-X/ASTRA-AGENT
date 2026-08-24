import {
  XUANXUE_AI_PRODUCTION_PROVIDER_INPUT_BLOCKED_BEFORE_SUBMISSION,
  type XuanxueAiOrderRecord,
} from "./xuanxue-ai-production.schema.js";
import {
  cancelXuanxueAiProductionJob,
  acknowledgeXuanxueAiProductionHandover,
  checkpointXuanxueAiProductionJob,
  completeXuanxueAiProductionJob,
  failXuanxueAiProductionJob,
  uploadXuanxueAiProductionProductResult,
  uploadXuanxueAiProductionOutputArtifact,
} from "./xuanxue-ai-production-cloud-client.js";
import type {
  XuanxueAiProductionAttachmentCheckpointProof,
} from "./xuanxue-ai-production-cloud-client-contract.js";
import type {
  XuanxueAiProductionCloudClaimedJob,
} from "./xuanxue-ai-production-cloud-contract.js";
import type { XuanxueAiProductionWorkerSessionV6 } from "./xuanxue-ai-production-worker-session.js";
import type { XuanxueAiProductionCloudOutbox } from "./xuanxue-ai-production-cloud-outbox.js";
import { cleanXuanxueAiProductionCloudStaging } from "./xuanxue-ai-production-cloud-staging.js";

type ResultStage = NonNullable<XuanxueAiOrderRecord["result"]>["stages"][number];
type PublicationInput = Readonly<{
  session: XuanxueAiProductionWorkerSessionV6;
  outbox: XuanxueAiProductionCloudOutbox;
  dataDir: string;
  job: XuanxueAiProductionCloudClaimedJob;
  record: XuanxueAiOrderRecord;
}>;

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
  session: XuanxueAiProductionWorkerSessionV6,
  outbox: XuanxueAiProductionCloudOutbox,
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
  const uploaded = await uploadXuanxueAiProductionOutputArtifact(session, outbox, job, {
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

const publishAttachmentCheckpoints = async (input: PublicationInput): Promise<void> => {
  for (const stage of input.record.stages) {
    if (!stage.attachmentUploadProof) continue;
    await checkpointXuanxueAiProductionJob(input.session, input.outbox, input.job, {
      status: "factory_running",
      localOrderId: input.record.order.orderId,
      attachmentUploadProof: attachmentCheckpoint({
        stageId: stage.stageId,
        proof: stage.attachmentUploadProof,
      }),
    });
  }
};

const publishCompletedOrder = async (input: PublicationInput): Promise<boolean> => {
  if (input.record.status !== "completed" || !input.record.result) return false;
  const stages = await Promise.all(input.record.result.stages.map(
    (stage) => uploadGeneratedImageStage(input.session, input.outbox, input.job, stage),
  ));
  const completeResult = { ...input.record.result, stages };
  await uploadXuanxueAiProductionProductResult(
    input.session, input.outbox, input.job, input.dataDir, completeResult,
  );
  await completeXuanxueAiProductionJob(input.session, input.outbox, input.job, completeResult);
  await cleanXuanxueAiProductionCloudStaging(input.dataDir, input.job.job_id);
  return true;
};

const publishCancelledOrder = async (input: PublicationInput): Promise<boolean> => {
  if (input.record.status !== "cancelled") return false;
  await cancelXuanxueAiProductionJob(input.session, input.outbox, input.job, {
    local_order_id: input.record.order.orderId,
    reason: input.record.failureReason ?? "cloud control intent acknowledged at a local safe point",
  });
  await cleanXuanxueAiProductionCloudStaging(input.dataDir, input.job.job_id);
  return true;
};

const publishHandover = async (input: PublicationInput): Promise<boolean> => {
  const handover = input.record.status === "recovery_pending"
    && input.record.failureReason?.startsWith("XUANXUE_AI_INTERVENTION_TAKEOVER@");
  if (!handover) return false;
  await acknowledgeXuanxueAiProductionHandover(
    input.session, input.outbox, input.job, input.record.order.orderId,
  );
  return true;
};

const publishFailedOrder = async (input: PublicationInput): Promise<void> => {
  const providerBlocked = input.record.failureReason?.startsWith(
    XUANXUE_AI_PRODUCTION_PROVIDER_INPUT_BLOCKED_BEFORE_SUBMISSION,
  ) ?? false;
  const recoverable = input.record.status === "recovery_pending" && !providerBlocked;
  await failXuanxueAiProductionJob(input.session, input.outbox, input.job, {
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
  if (!recoverable) {
    await cleanXuanxueAiProductionCloudStaging(input.dataDir, input.job.job_id);
  }
};

export const publishXuanxueAiProductionCloudOrder = async (input: PublicationInput): Promise<void> => {
  await publishAttachmentCheckpoints(input);
  if (await publishCompletedOrder(input)) return;
  if (await publishCancelledOrder(input)) return;
  if (await publishHandover(input)) return;
  await publishFailedOrder(input);
};

export { attachmentCheckpoint as toXuanxueAiProductionAttachmentCheckpoint };
