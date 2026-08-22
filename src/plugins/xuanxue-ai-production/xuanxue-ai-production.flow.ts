import {
  assertXuanxueAiOrderMatchesProfile,
  type XuanxueAiProductionProfile,
  type XuanxueAiStageDefinition,
} from "./xuanxue-ai-production.profile.js";
import {
  buildXuanxueAiFeedInput,
  initialXuanxueStages,
  requireXuanxueStage,
} from "./xuanxue-ai-production-feed.js";
import type { XuanxueAiProductionRuntime } from "./xuanxue-ai-production.runtime.js";
import { completeXuanxueAiProductionOrder } from "./xuanxue-ai-production-result.js";
import {
  XuanxueAiProductionOrderSchema,
  type XuanxueAiOrderRecord,
  type XuanxueAiStageRecord,
} from "./xuanxue-ai-production.schema.js";
import {
  acknowledgeInterventionSafePoint,
  continuationConversationUnavailable,
  executeGatewayStage,
  persistStageResult,
  waitForRecoveryRetry,
  type XuanxueAiProductionExecutionObserver,
} from "./xuanxue-ai-production-stage-execution.js";
import type { XuanxueAiExecutionDeadlineBudget } from "./xuanxue-ai-production.runtime.js";
export type { XuanxueAiProductionRuntime } from "./xuanxue-ai-production.runtime.js";
export type { XuanxueAiProductionExecutionObserver } from "./xuanxue-ai-production-stage-execution.js";

const nowIso = (): string => new Date().toISOString();

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

export const hasTerminalAttachmentTransportProof = (
  stage: XuanxueAiStageRecord,
): boolean => {
  const status = stage.aiFeedResult?.providerProof.attachmentUploadProof?.status;
  return status === "failed" || status === "review_required";
};

const executeStage = async (
  runtime: XuanxueAiProductionRuntime,
  orderId: string,
  definition: XuanxueAiStageDefinition,
  observer?: XuanxueAiProductionExecutionObserver,
  deadlineBudget?: XuanxueAiExecutionDeadlineBudget,
): Promise<XuanxueAiStageRecord> => {
  const current = runtime.store.readOrder(orderId);
  if (!current) throw new Error("XUANXUE_AI_PRODUCTION_ORDER_NOT_FOUND");
  let stage = requireXuanxueStage(current, definition.stageId);
  if (stage.status === "completed"
    || stage.status === "failed"
    || stage.status === "review_required"
    || hasTerminalAttachmentTransportProof(stage)) return stage;
  await acknowledgeInterventionSafePoint(runtime, orderId, `before-stage-feed:${definition.stageId}`);
  const feedInput = await buildXuanxueAiFeedInput(runtime, current, stage, definition);
  stage = runtime.store.updateStage({
    ...stage,
    status: "running",
    attemptCount: stage.attemptCount + 1,
    failureReason: null,
    updatedAt: nowIso(),
  }, "stage_started");
  const gatewayResult = await executeGatewayStage({
    runtime,
    orderId,
    stage,
    feedInput,
    ...(observer ? { observer } : {}),
    ...(deadlineBudget ? { deadlineBudget } : {}),
  });
  const persisted = persistStageResult(runtime, orderId, stage, gatewayResult);
  await acknowledgeInterventionSafePoint(runtime, orderId, `after-response-checkpoint:${definition.stageId}`);
  return persisted;
};

const executeStageUntilSettled = async (
  runtime: XuanxueAiProductionRuntime,
  orderId: string,
  definition: XuanxueAiStageDefinition,
  observer?: XuanxueAiProductionExecutionObserver,
  deadlineBudget?: XuanxueAiExecutionDeadlineBudget,
): Promise<XuanxueAiStageRecord> => {
  const requireOperatorContinuationRecovery = (
    reason: string,
  ): XuanxueAiStageRecord => {
    const current = runtime.store.readOrder(orderId);
    if (!current) throw new Error("XUANXUE_AI_PRODUCTION_ORDER_NOT_FOUND");
    const stage = requireXuanxueStage(current, definition.stageId);
    return runtime.store.updateStage({
      ...stage,
      status: "review_required",
      progressPhase: "terminal",
      failureReason:
        `XUANXUE_AI_PRODUCTION_CONTINUATION_OPERATOR_RECOVERY_REQUIRED:${reason}`
          .slice(0, 1_000),
      updatedAt: nowIso(),
    }, "stage_continuation_operator_recovery_required");
  };
  while (true) {
    let stage: XuanxueAiStageRecord;
    try {
      stage = await executeStage(
        runtime,
        orderId,
        definition,
        observer,
        deadlineBudget,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (definition.continuationFrom && continuationConversationUnavailable(reason)) {
        return requireOperatorContinuationRecovery(reason);
      }
      throw error;
    }
    if (definition.continuationFrom
      && stage.status === "recovery_pending"
      && continuationConversationUnavailable(stage.failureReason)) {
      return requireOperatorContinuationRecovery(stage.failureReason!);
    }
    if (hasTerminalAttachmentTransportProof(stage)) return stage;
    if (stage.status !== "recovery_pending" || !await waitForRecoveryRetry(stage)) return stage;
  }
};

export const executeXuanxueAiProductionOrder = async (
  runtime: XuanxueAiProductionRuntime,
  orderId: string,
  observer?: XuanxueAiProductionExecutionObserver,
  deadlineBudget?: XuanxueAiExecutionDeadlineBudget,
): Promise<XuanxueAiOrderRecord> => {
  let record = runtime.store.readOrder(orderId);
  if (!record) throw new Error("XUANXUE_AI_PRODUCTION_ORDER_NOT_FOUND");
  if (
    record.status === "completed"
    || record.status === "cancelled"
    || record.status === "review_required"
    || record.status === "failed"
  ) return record;
  acknowledgeInterventionSafePoint(runtime, orderId, "before-order-execution");
  const profile = assertXuanxueAiOrderMatchesProfile(record.order);
  record = runtime.store.updateOrder({
    orderId,
    status: "running",
    failureReason: null,
    updatedAt: nowIso(),
    eventType: "order_started",
  });
  while (pendingDefinitions(record, profile).length > 0) {
    acknowledgeInterventionSafePoint(runtime, orderId, "before-stage-dequeue");
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
        executeStageUntilSettled(
          runtime,
          orderId,
          definition,
          observer,
          deadlineBudget,
        )),
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
  acknowledgeInterventionSafePoint(runtime, orderId, "before-order-result-commit");
  return completeXuanxueAiProductionOrder(runtime, record, profile);
};
