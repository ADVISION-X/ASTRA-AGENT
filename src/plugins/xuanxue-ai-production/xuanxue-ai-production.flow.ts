import type { AiFeedResult } from "../../capabilities/ai-input-gateway/index.js";
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
import {
  XuanxueAiProductionOrderSchema,
  type XuanxueAiOrderRecord,
  type XuanxueAiProductionResult,
  type XuanxueAiStageRecord,
} from "./xuanxue-ai-production.schema.js";
export type { XuanxueAiProductionRuntime } from "./xuanxue-ai-production.runtime.js";

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

const terminalStageFromResult = (
  result: AiFeedResult,
  recoveryAlreadyRecorded: boolean,
): Pick<XuanxueAiStageRecord, "status" | "failureReason"> => {
  if (result.status === "review_required") {
    return {
      status: "review_required",
      failureReason:
        result.reviewRequiredReason ?? "provider review required",
    };
  }
  if (result.status === "failed") {
    return {
      status: recoveryAlreadyRecorded ? "recovery_pending" : "failed",
      failureReason: result.failureReason ?? "provider execution failed",
    };
  }
  if (!result.rawResponseText || !result.rawOutputHash) {
    return {
      status: "failed",
      failureReason: "XUANXUE_AI_PRODUCTION_RAW_RESPONSE_MISSING",
    };
  }
  if (
    result.parseStatus === "json_invalid"
    && result.schemaValidationStatus !== "not_applicable"
  ) {
    return {
      status: "review_required",
      failureReason: "XUANXUE_AI_PRODUCTION_OUTPUT_JSON_INVALID",
    };
  }
  return { status: "completed", failureReason: null };
};

const executeStage = async (
  runtime: XuanxueAiProductionRuntime,
  orderId: string,
  definition: XuanxueAiStageDefinition,
): Promise<XuanxueAiStageRecord> => {
  const current = runtime.store.readOrder(orderId);
  if (!current) throw new Error("XUANXUE_AI_PRODUCTION_ORDER_NOT_FOUND");
  let stage = requireXuanxueStage(current, definition.stageId);
  if (stage.status === "completed") return stage;
  const startedAt = nowIso();
  stage = runtime.store.updateStage({
    ...stage,
    status: "running",
    attemptCount: stage.attemptCount + 1,
    failureReason: null,
    updatedAt: startedAt,
  }, "stage_started");
  const result = await runtime.aiInputGateway.execute(
    await buildXuanxueAiFeedInput(runtime, current, stage, definition),
    {
      executionId: stage.executionId,
      onProgress: async (progress) => {
        const latest = runtime.store.readOrder(orderId);
        if (!latest) return;
        const persisted = requireXuanxueStage(latest, stage.stageId);
        if (persisted.status === "completed") return;
        runtime.store.updateStage({
          ...persisted,
          status: progress.phase === "recovery_pending"
            ? "recovery_pending"
            : progress.phase === "waiting_provider"
              ? "waiting_provider"
              : progress.phase === "response_checkpointed"
                ? "response_checkpointed"
                : "running",
          progressPhase: progress.phase,
          updatedAt: progress.occurredAt,
        }, "stage_progress");
      },
    },
  );
  const progressedOrder = runtime.store.readOrder(orderId);
  if (!progressedOrder) {
    throw new Error("XUANXUE_AI_PRODUCTION_ORDER_NOT_FOUND");
  }
  const progressedStage = requireXuanxueStage(
    progressedOrder,
    stage.stageId,
  );
  const recoveryAlreadyRecorded =
    progressedStage.status === "recovery_pending"
    || progressedStage.progressPhase === "recovery_pending";
  const terminal = terminalStageFromResult(
    result,
    recoveryAlreadyRecorded,
  );
  return runtime.store.updateStage({
    ...progressedStage,
    ...terminal,
    aiFeedResult: result,
    rawResponseText: result.rawResponseText ?? null,
    rawOutputHash: result.rawOutputHash,
    progressPhase: terminal.status === "completed"
      ? "terminal"
      : terminal.status === "recovery_pending"
        ? "recovery_pending"
        : stage.progressPhase,
    updatedAt: nowIso(),
  }, "stage_terminal");
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
      runnable.map((definition) => executeStage(runtime, orderId, definition)),
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
