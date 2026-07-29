import type {
  AiFeedResult,
  AiInputGatewayProgress,
} from "../../capabilities/ai-input-gateway/index.js";
import {
  assertXuanxueAiOrderMatchesProfile,
  type XuanxueAiProductionProfile,
  type XuanxueAiStageDefinition,
} from "./xuanxue-ai-production.profile.js";
import {
  buildXuanxueAiFeedInput,
  canonicalXuanxueRawOutputHash,
  initialXuanxueStages,
  requireXuanxueStage,
} from "./xuanxue-ai-production-feed.js";
import type { XuanxueAiProductionRuntime } from "./xuanxue-ai-production.runtime.js";
import {
  XuanxueAiProductionOrderSchema,
  type XuanxueAiOrderRecord,
  type XuanxueAiProductionResult,
  type XuanxueAiStageRecord,
} from "./xuanxue-ai-production.schema.js";
import {
  xuanxueAiOutputIntegrityFailure,
  xuanxueAiOutputRequiresFreshExecution,
} from "./xuanxue-ai-production-output-integrity.js";
export type { XuanxueAiProductionRuntime } from "./xuanxue-ai-production.runtime.js";

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

export const createXuanxueAiProductionOrder = (
  runtime: XuanxueAiProductionRuntime,
  rawOrder: unknown,
): XuanxueAiOrderRecord => {
  const order = XuanxueAiProductionOrderSchema.parse(rawOrder);
  const profile = assertXuanxueAiOrderMatchesProfile(order);
  return runtime.store.createOrder(
    order,
    initialXuanxueStages(order, profile),
  );
};

const terminalStageFromResult = (
  result: AiFeedResult,
): Pick<XuanxueAiStageRecord, "status" | "failureReason"> => {
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

const restartRecoverableStage = (
  runtime: XuanxueAiProductionRuntime,
  stage: XuanxueAiStageRecord,
): XuanxueAiStageRecord => {
  const terminalGatewayExecution = stage.aiFeedResult?.status === "failed"
    || stage.aiFeedResult?.status === "review_required";
  const hasDurableSubmission = Boolean(
    stage.aiFeedResult?.providerProof.webChatUrl,
  );
  const terminalPreSubmitGatewayRequiresFreshExecution =
    terminalGatewayExecution
    && !hasDurableSubmission
    && (runtime.aiInputGateway.classifyFailure?.(
      new Error(stage.failureReason ?? "provider execution failed"),
      false,
    ) ?? "recovery_pending") !== "recovery_pending";
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
  const terminal = terminalStageFromResult(result);
  return runtime.store.updateStage({
    ...progressedStage,
    ...terminal,
    aiFeedResult: result,
    rawResponseText: result.rawResponseText ?? null,
    rawOutputHash: result.rawOutputHash,
    progressPhase: terminal.status === "completed"
      ? "terminal"
      : "recovery_pending",
    updatedAt: nowIso(),
  }, "stage_terminal");
};

const executeStage = async (
  runtime: XuanxueAiProductionRuntime,
  orderId: string,
  definition: XuanxueAiStageDefinition,
): Promise<XuanxueAiStageRecord> => {
  const current = runtime.store.readOrder(orderId);
  if (!current) throw new Error("XUANXUE_AI_PRODUCTION_ORDER_NOT_FOUND");
  let stage = restartRecoverableStage(
    runtime,
    requireXuanxueStage(current, definition.stageId),
  );
  if (stage.status === "completed") return stage;
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
  const result = canonicalizeStageResult(
    await runtime.aiInputGateway.execute(
      feedInput,
      {
        executionId: stage.executionId,
        ...(stage.supersededExecutionId
          ? {
              supersededExecutionId:
                stage.supersededExecutionId,
            }
          : {}),
        onProgress: async (progress) =>
          persistStageProgress(
            runtime,
            orderId,
            stage.stageId,
            progress,
          ),
      },
    ),
  );
  return persistStageResult(runtime, orderId, stage, result);
};

const executeStageUntilSettled = async (
  runtime: XuanxueAiProductionRuntime,
  orderId: string,
  definition: XuanxueAiStageDefinition,
): Promise<XuanxueAiStageRecord> => {
  while (true) {
    let stage: XuanxueAiStageRecord;
    try {
      stage = await executeStage(runtime, orderId, definition);
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
    if (
      stage.status !== "recovery_pending"
      || !await waitForRecoveryRetry(stage)
    ) return stage;
  }
};

const dependencyCompleted = (
  record: XuanxueAiOrderRecord,
  definition: XuanxueAiStageDefinition,
): boolean => definition.dependsOn.every((stageId) =>
  requireXuanxueStage(record, stageId).status === "completed");

const pendingDefinitions = (
  record: XuanxueAiOrderRecord,
  profile: XuanxueAiProductionProfile,
): XuanxueAiStageDefinition[] => profile.stages.filter((definition) =>
  requireXuanxueStage(record, definition.stageId).status !== "completed");

const runnableDefinitions = (
  record: XuanxueAiOrderRecord,
  profile: XuanxueAiProductionProfile,
): XuanxueAiStageDefinition[] => pendingDefinitions(record, profile)
  .filter((definition) => dependencyCompleted(record, definition));

const firstBlockingStage = (
  record: XuanxueAiOrderRecord,
): XuanxueAiStageRecord | undefined => record.stages.find((stage) =>
  stage.status === "failed"
  || stage.status === "review_required"
  || stage.status === "recovery_pending");

const completeOrder = (
  runtime: XuanxueAiProductionRuntime,
  record: XuanxueAiOrderRecord,
  profile: XuanxueAiProductionProfile,
): XuanxueAiOrderRecord => {
  const stages = record.stages.map((stage) => {
    if (
      stage.status !== "completed"
      || !stage.rawResponseText
      || !stage.rawOutputHash
      || !stage.aiFeedResult
    ) {
      throw new Error(
        `XUANXUE_AI_PRODUCTION_STAGE_INCOMPLETE:${stage.stageId}`,
      );
    }
    return {
      stageId: stage.stageId,
      executionId: stage.executionId,
      rawResponseText: stage.rawResponseText,
      rawOutputHash: stage.rawOutputHash,
      providerProof: stage.aiFeedResult.providerProof,
      transportWarnings: stage.aiFeedResult.transportWarnings ?? [],
    };
  });
  const updatedAt = nowIso();
  const result: XuanxueAiProductionResult = {
    orderId: record.order.orderId,
    sourceTaskId: record.order.sourceTaskId,
    productId: record.order.productId,
    inputBundleRef: record.order.inputBundleRef,
    inputBundleHash: record.order.inputBundleHash,
    requestHash: record.order.requestHash,
    status: "completed",
    finalStageId: profile.finalStageId,
    stages,
    failureReason: null,
    createdAt: record.createdAt,
    updatedAt,
  };
  return runtime.store.updateOrder({
    orderId: record.order.orderId,
    status: "completed",
    result,
    failureReason: null,
    updatedAt,
    eventType: "order_completed",
  });
};

export const executeXuanxueAiProductionOrder = async (
  runtime: XuanxueAiProductionRuntime,
  orderId: string,
): Promise<XuanxueAiOrderRecord> => {
  let record = runtime.store.readOrder(orderId);
  if (!record) throw new Error("XUANXUE_AI_PRODUCTION_ORDER_NOT_FOUND");
  if (
    record.status === "completed"
    || record.status === "cancelled"
    || record.status === "review_required"
    || record.status === "failed"
  ) return record;
  const profile = assertXuanxueAiOrderMatchesProfile(record.order);
  record = runtime.store.updateOrder({
    orderId,
    status: "running",
    failureReason: null,
    updatedAt: nowIso(),
    eventType: "order_started",
  });
  while (pendingDefinitions(record, profile).length > 0) {
    const runnable = runnableDefinitions(record, profile);
    if (runnable.length === 0) {
      const blocking = firstBlockingStage(record);
      const status = blocking?.status === "review_required"
        ? "review_required"
        : blocking?.status === "recovery_pending"
          ? "recovery_pending"
          : "failed";
      return runtime.store.updateOrder({
        orderId,
        status,
        failureReason:
          blocking?.failureReason
          ?? "XUANXUE_AI_PRODUCTION_GRAPH_BLOCKED",
        updatedAt: nowIso(),
        eventType: "order_blocked",
      });
    }
    await Promise.all(
      runnable.map((definition) =>
        executeStageUntilSettled(runtime, orderId, definition)),
    );
    record = runtime.store.readOrder(orderId)!;
    const blocking = firstBlockingStage(record);
    if (blocking) {
      const status = blocking.status === "review_required"
        ? "review_required"
        : blocking.status === "recovery_pending"
          ? "recovery_pending"
          : "failed";
      return runtime.store.updateOrder({
        orderId,
        status,
        failureReason: blocking.failureReason,
        updatedAt: nowIso(),
        eventType: "order_stage_terminal",
      });
    }
  }
  return completeOrder(runtime, record, profile);
};
