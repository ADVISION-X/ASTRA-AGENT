import type {
  AiFeedResult,
  AiInputGatewayProgress,
  WebChatAttachmentUploadProof,
} from "../../capabilities/ai-input-gateway/index.js";
import type { XuanxueAiStageDefinition } from "./xuanxue-ai-production.profile.js";
import {
  buildXuanxueAiFeedInput,
  canonicalXuanxueRawOutputHash,
  requireXuanxueStage,
} from "./xuanxue-ai-production-feed.js";
import type { XuanxueAiProductionRuntime } from "./xuanxue-ai-production.runtime.js";
import { normalizeGeneratedImageResult } from "./xuanxue-ai-production-image-result.js";
import {
  XUANXUE_AI_PRODUCTION_PROVIDER_INPUT_BLOCKED_BEFORE_SUBMISSION,
  type XuanxueAiOrderRecord,
  type XuanxueAiStageRecord,
} from "./xuanxue-ai-production.schema.js";
import {
  xuanxueAiOutputIntegrityFailure,
  xuanxueAiOutputRequiresFreshExecution,
} from "./xuanxue-ai-production-output-integrity.js";

export interface XuanxueAiProductionExecutionObserver {
  readonly onAttachmentUploadCompleted?: (input: {
    readonly orderId: string;
    readonly stageId: XuanxueAiStageRecord["stageId"];
    readonly proof: WebChatAttachmentUploadProof;
  }) => Promise<void>;
}

const nowIso = (): string => new Date().toISOString();
const RECOVERY_RETRY_DELAY_MS = 1_000;
const MAX_RECOVERY_RETRY_DELAY_MS = 10_000;

const continuationConversationUnavailable = (
  reason: string | null,
): boolean => Boolean(
  reason
  && /(?:WEB_CHAT_CONTINUATION_CONVERSATION_DRIFT|provider continuation conversation mismatch|XUANXUE_AI_PRODUCTION_CONTINUATION_PROOF_MISSING)/iu
    .test(reason)
);

const waitForRecoveryRetry = async (
  stage: XuanxueAiStageRecord,
): Promise<boolean> => {
  const deadline = new Date(stage.createdAt).getTime()
    + stage.material.timeoutMs;
  const remainingMs = deadline - Date.now();
  if (remainingMs <= 0) return false;
  const retryDelayMs = Math.min(
    remainingMs,
    MAX_RECOVERY_RETRY_DELAY_MS,
    RECOVERY_RETRY_DELAY_MS * Math.max(1, stage.attemptCount),
  );
  await new Promise<void>((resolve) => setTimeout(resolve, retryDelayMs));
  return true;
};

const canonicalizeStageResult = (
  result: AiFeedResult,
): AiFeedResult => {
  const rawOutputHash = result.rawOutputHash
    ? canonicalXuanxueRawOutputHash(result.rawOutputHash)
    : null;
  const providerOutputHash = result.providerProof.outputHash
    ? canonicalXuanxueRawOutputHash(result.providerProof.outputHash)
    : null;
  return {
    ...result,
    rawOutputHash,
    providerProof: {
      ...result.providerProof,
      outputHash: providerOutputHash,
    },
  };
};

const terminalAttachmentReason = (result: AiFeedResult): string => {
  const proof = result.providerProof.attachmentUploadProof;
  const reason = proof?.failureReason
    ?? proof?.reviewRequiredReason
    ?? result.failureReason
    ?? result.reviewRequiredReason
    ?? "provider rejected the governed attachment set";
  return reason.replace(/\s+/gu, " ").trim().slice(0, 400);
};

const isPublicKnowledgePreSubmitAttachmentBlock = (
  result: AiFeedResult,
  stage: XuanxueAiStageRecord,
  productId: XuanxueAiOrderRecord["order"]["productId"],
): boolean => {
  const proofStatus = result.providerProof.attachmentUploadProof?.status;
  return productId === "public_knowledge_article_pipeline"
    && stage.stageId === "corpus_research"
    && (result.status === "failed" || result.status === "review_required")
    && (proofStatus === "failed" || proofStatus === "review_required")
    && !result.providerProof.webChatUrl
    && !result.providerProof.freshConversationProof
    && !result.providerProof.sameConversationProof
    && !result.providerProof.forkedFromCheckpointProof;
};

const terminalStageFromResult = (
  result: AiFeedResult,
  stage: XuanxueAiStageRecord,
  productId: XuanxueAiOrderRecord["order"]["productId"],
): Pick<XuanxueAiStageRecord, "status" | "failureReason"> => {
  if (isPublicKnowledgePreSubmitAttachmentBlock(result, stage, productId)) {
    return {
      status: "failed",
      failureReason:
        `${XUANXUE_AI_PRODUCTION_PROVIDER_INPUT_BLOCKED_BEFORE_SUBMISSION}:`
        + terminalAttachmentReason(result),
    };
  }
  if (result.status === "review_required") {
    return {
      status: "recovery_pending",
      failureReason:
        result.reviewRequiredReason ?? "provider review required",
    };
  }
  if (result.status === "failed") {
    return {
      status: "recovery_pending",
      failureReason: result.failureReason ?? "provider execution failed",
    };
  }
  if (!result.rawResponseText || !result.rawOutputHash) {
    return {
      status: "recovery_pending",
      failureReason: "XUANXUE_AI_PRODUCTION_RAW_RESPONSE_MISSING",
    };
  }
  const integrityFailure = xuanxueAiOutputIntegrityFailure(
    result.rawResponseText,
  );
  if (integrityFailure) {
    return {
      status: "recovery_pending",
      failureReason: integrityFailure,
    };
  }
  if (
    result.parseStatus === "json_invalid"
    && result.schemaValidationStatus !== "not_applicable"
  ) {
    return {
      status: "recovery_pending",
      failureReason: "XUANXUE_AI_PRODUCTION_OUTPUT_JSON_INVALID",
    };
  }
  return { status: "completed", failureReason: null };
};

const hasTerminalAttachmentTransportProof = (
  stage: XuanxueAiStageRecord,
): boolean => {
  const status =
    stage.aiFeedResult?.providerProof.attachmentUploadProof?.status;
  return status === "failed" || status === "review_required";
};

const hasProvenTerminalPreSubmitIdentityConflict = (
  reason: string | null,
): boolean => Boolean(
  reason
  && /WEB_CHAT_(?:FOREIGN_TURN_REBOUND|FRESH_CONVERSATION_REBOUND|CANONICAL_CONVERSATION_ALREADY_BOUND|TURN_MARKER_AMBIGUOUS)/u
    .test(reason),
);

const restartRecoverableStage = (
  runtime: XuanxueAiProductionRuntime,
  stage: XuanxueAiStageRecord,
): XuanxueAiStageRecord => {
  if (hasTerminalAttachmentTransportProof(stage)) return stage;
  const terminalGatewayExecution = stage.aiFeedResult?.status === "failed"
    || stage.aiFeedResult?.status === "review_required";
  const hasDurableSubmission = Boolean(
    stage.aiFeedResult?.providerProof.webChatUrl,
  );
  const terminalPreSubmitGatewayRequiresFreshExecution =
    terminalGatewayExecution
    && !hasDurableSubmission
    && !stage.supersededExecutionId
    && hasProvenTerminalPreSubmitIdentityConflict(stage.failureReason);
  const outputRequiresFreshExecution =
    xuanxueAiOutputRequiresFreshExecution(stage.failureReason);
  if (
    stage.status !== "recovery_pending"
    || (
      !terminalPreSubmitGatewayRequiresFreshExecution
      && !outputRequiresFreshExecution
    )
  ) return stage;
  const restartedAt = nowIso();
  return runtime.store.updateStage({
    ...stage,
    executionId:
      `${stage.orderId}:${stage.stageId}:restart:${stage.attemptCount + 1}`,
    supersededExecutionId: stage.executionId,
    status: "queued",
    aiFeedResult: null,
    attachmentUploadProof: null,
    rawResponseText: null,
    rawOutputHash: null,
    progressPhase: "queued",
    failureReason: null,
    updatedAt: restartedAt,
  }, "stage_fresh_execution_restarted");
};

const progressStatus = (
  phase: AiInputGatewayProgress["phase"],
): XuanxueAiStageRecord["status"] => phase === "recovery_pending"
  ? "recovery_pending"
  : phase === "waiting_provider"
    ? "waiting_provider"
    : phase === "response_checkpointed"
      ? "response_checkpointed"
      : "running";

const persistStageProgress = (
  runtime: XuanxueAiProductionRuntime,
  orderId: string,
  stageId: XuanxueAiStageRecord["stageId"],
  progress: AiInputGatewayProgress,
): void => {
  const latest = runtime.store.readOrder(orderId);
  if (!latest) return;
  const persisted = requireXuanxueStage(latest, stageId);
  if (persisted.status === "completed") return;
  runtime.store.updateStage({
    ...persisted,
    status: progressStatus(progress.phase),
    progressPhase: progress.phase,
    updatedAt: progress.occurredAt,
  }, "stage_progress");
};

const persistStageAttachmentUploadProof = (
  runtime: XuanxueAiProductionRuntime,
  orderId: string,
  stageId: XuanxueAiStageRecord["stageId"],
  proof: WebChatAttachmentUploadProof,
): void => {
  const latest = runtime.store.readOrder(orderId);
  if (!latest) throw new Error("XUANXUE_AI_PRODUCTION_ORDER_NOT_FOUND");
  const persisted = requireXuanxueStage(latest, stageId);
  if (
    persisted.attachmentUploadProof
    && JSON.stringify(persisted.attachmentUploadProof) !== JSON.stringify(proof)
  ) {
    throw new Error("XUANXUE_AI_PRODUCTION_ATTACHMENT_PROOF_DRIFT");
  }
  if (persisted.attachmentUploadProof) return;
  runtime.store.updateStage({
    ...persisted,
    attachmentUploadProof: proof,
    updatedAt: proof.endedAt,
  }, "stage_attachment_upload_proof");
};

const persistStageResult = (
  runtime: XuanxueAiProductionRuntime,
  orderId: string,
  stage: XuanxueAiStageRecord,
  result: AiFeedResult,
): XuanxueAiStageRecord => {
  const progressedOrder = runtime.store.readOrder(orderId);
  if (!progressedOrder) {
    throw new Error("XUANXUE_AI_PRODUCTION_ORDER_NOT_FOUND");
  }
  const progressedStage = requireXuanxueStage(
    progressedOrder,
    stage.stageId,
  );
  const terminal = terminalStageFromResult(
    result,
    progressedStage,
    progressedOrder.order.productId,
  );
  return runtime.store.updateStage({
    ...progressedStage,
    ...terminal,
    aiFeedResult: result,
    rawResponseText: result.rawResponseText ?? null,
    rawOutputHash: result.rawOutputHash,
    progressPhase: terminal.status === "completed" || terminal.status === "failed"
      ? "terminal"
      : "recovery_pending",
    updatedAt: nowIso(),
  }, "stage_terminal");
};

export const acknowledgeInterventionSafePoint = async (
  runtime: XuanxueAiProductionRuntime,
  orderId: string,
  checkpoint: string,
): Promise<void> => {
  const acknowledged = runtime.store.acknowledgeInterventionAtSafePoint(
    orderId,
    checkpoint,
  );
  if (acknowledged) {
    if (acknowledged.state === "taken_over") {
      await runtime.aiInputGateway.releaseProviderTargetForOperator?.(
        `xuanxue-ai-production:${orderId}`,
      );
    }
    throw new Error(
      `XUANXUE_AI_INTERVENTION_STOPPED:${acknowledged.state}:${checkpoint}`,
    );
  }
};

const executeGatewayStage = async (input: {
  runtime: XuanxueAiProductionRuntime;
  orderId: string;
  stage: XuanxueAiStageRecord;
  feedInput: Awaited<ReturnType<typeof buildXuanxueAiFeedInput>>;
  observer?: XuanxueAiProductionExecutionObserver;
}): Promise<AiFeedResult> => canonicalizeStageResult(
  await input.runtime.aiInputGateway.execute(
    input.feedInput,
    {
      executionId: input.stage.executionId,
      ...(input.stage.supersededExecutionId
        ? { supersededExecutionId: input.stage.supersededExecutionId }
        : {}),
      onProgress: async (progress) =>
        persistStageProgress(
          input.runtime,
          input.orderId,
          input.stage.stageId,
          progress,
        ),
      onAttachmentUploadCompleted: async (proof) => {
        persistStageAttachmentUploadProof(
          input.runtime,
          input.orderId,
          input.stage.stageId,
          proof,
        );
        await input.observer?.onAttachmentUploadCompleted?.({
          orderId: input.orderId,
          stageId: input.stage.stageId,
          proof,
        });
      },
    },
  ),
);

const executeStage = async (
  runtime: XuanxueAiProductionRuntime,
  orderId: string,
  definition: XuanxueAiStageDefinition,
  observer?: XuanxueAiProductionExecutionObserver,
): Promise<XuanxueAiStageRecord> => {
  const current = runtime.store.readOrder(orderId);
  if (!current) throw new Error("XUANXUE_AI_PRODUCTION_ORDER_NOT_FOUND");
  let stage = restartRecoverableStage(
    runtime,
    requireXuanxueStage(current, definition.stageId),
  );
  if (
    stage.status === "completed"
    || hasTerminalAttachmentTransportProof(stage)
  ) return stage;
  await acknowledgeInterventionSafePoint(
    runtime,
    orderId,
    `before-stage-feed:${definition.stageId}`,
  );
  const feedInput = await buildXuanxueAiFeedInput(
    runtime,
    current,
    stage,
    definition,
  );
  const startedAt = nowIso();
  stage = runtime.store.updateStage({
    ...stage,
    status: "running",
    attemptCount: stage.attemptCount + 1,
    failureReason: null,
    updatedAt: startedAt,
  }, "stage_started");
  const gatewayResult = await executeGatewayStage({
    runtime,
    orderId,
    stage,
    feedInput,
    ...(observer ? { observer } : {}),
  });
  const result = await normalizeGeneratedImageResult(
    runtime,
    orderId,
    stage.stageId,
    gatewayResult,
  );
  const persisted = persistStageResult(runtime, orderId, stage, result);
  await acknowledgeInterventionSafePoint(
    runtime,
    orderId,
    `after-response-checkpoint:${definition.stageId}`,
  );
  return persisted;
};

export const executeStageUntilSettled = async (
  runtime: XuanxueAiProductionRuntime,
  orderId: string,
  definition: XuanxueAiStageDefinition,
  observer?: XuanxueAiProductionExecutionObserver,
): Promise<XuanxueAiStageRecord> => {
  while (true) {
    let stage: XuanxueAiStageRecord;
    try {
      stage = await executeStage(runtime, orderId, definition, observer);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (
        definition.continuationFrom
        && continuationConversationUnavailable(reason)
      ) {
        const rebuilt =
          runtime.store.resetOrderForConversationGraphRebuild(
            orderId,
            {
              triggeringStageId: definition.stageId,
              reason,
            },
          );
        return requireXuanxueStage(rebuilt, definition.stageId);
      }
      throw error;
    }
    if (
      definition.continuationFrom
      && stage.status === "recovery_pending"
      && continuationConversationUnavailable(stage.failureReason)
    ) {
      const rebuilt =
        runtime.store.resetOrderForConversationGraphRebuild(
          orderId,
          {
            triggeringStageId: definition.stageId,
            reason: stage.failureReason!,
          },
      );
      return requireXuanxueStage(rebuilt, definition.stageId);
    }
    if (hasTerminalAttachmentTransportProof(stage)) return stage;
    if (
      stage.status !== "recovery_pending"
      || !await waitForRecoveryRetry(stage)
    ) return stage;
  }
};
