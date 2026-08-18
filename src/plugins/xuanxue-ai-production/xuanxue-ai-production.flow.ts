import {
  assertXuanxueAiOrderMatchesProfile,
  type XuanxueAiProductionProfile,
  type XuanxueAiStageDefinition,
} from "./xuanxue-ai-production.profile.js";
import {
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
  executeStageUntilSettled,
  type XuanxueAiProductionExecutionObserver,
} from "./xuanxue-ai-production-stage-execution.js";
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

export const executeXuanxueAiProductionOrder = async (
  runtime: XuanxueAiProductionRuntime,
  orderId: string,
  observer?: XuanxueAiProductionExecutionObserver,
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
        executeStageUntilSettled(runtime, orderId, definition, observer)),
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
