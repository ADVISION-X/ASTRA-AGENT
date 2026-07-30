import {
  executeXuanxueAiProductionOrder,
  type XuanxueAiProductionRuntime,
} from "./xuanxue-ai-production.flow.js";
import {
  isXuanxueAiRequiredContinuationProduct,
  xuanxueAiRequiredContinuationProfiles,
  type XuanxueAiOrderRecord,
} from "./xuanxue-ai-production.schema.js";
import { requireXuanxueStage } from "./xuanxue-ai-production-feed.js";

interface ScheduledOrder {
  readonly orderId: string;
  readonly promise: Promise<XuanxueAiOrderRecord>;
  readonly resolve: (record: XuanxueAiOrderRecord) => void;
}

const DEFAULT_PRODUCTION_WINDOW = 10;
const ABSOLUTE_PRODUCTION_WINDOW = 64;

export const resolveXuanxueAiProductionWindow = (): number => {
  const raw = process.env.XUANXUE_AI_PRODUCTION_MAX_IN_FLIGHT?.trim();
  if (!raw) return DEFAULT_PRODUCTION_WINDOW;
  const value = Number(raw);
  if (
    !Number.isInteger(value)
    || value < 1
    || value > ABSOLUTE_PRODUCTION_WINDOW
  ) {
    throw new Error(
      "XUANXUE_AI_PRODUCTION_MAX_IN_FLIGHT must be an integer "
      + `between 1 and ${ABSOLUTE_PRODUCTION_WINDOW}.`,
    );
  }
  return value;
};

const terminal = (record: XuanxueAiOrderRecord): boolean =>
  record.status === "completed"
  || record.status === "cancelled"
  || record.status === "review_required"
  || record.status === "failed";

const permanentExecutionDefect = (reason: string): boolean =>
  /(?:PROFILE_MISMATCH|IDENTITY_CONFLICT|SOURCE_TASK_CONFLICT|ORDER_NOT_FOUND|STAGE_MISSING|DEPENDENCY_HASH_MISMATCH|INPUT_.*INVALID|REQUEST_.*INVALID)/u
    .test(reason);

const continuationRebuildDefect = (reason: string): boolean =>
  /(?:PARENT_LOCAL|PARENT_PROFILE|PARENT_.*PROOF|CONTINUATION_.*INVALID)/u
    .test(reason);

const rebuildContinuationParent = async (
  runtime: XuanxueAiProductionRuntime,
  child: XuanxueAiOrderRecord,
): Promise<void> => {
  const parentRef = child.order.continuationParent;
  if (
    !parentRef
    || !isXuanxueAiRequiredContinuationProduct(child.order.productId)
  ) {
    throw new Error(
      "XUANXUE_AI_PRODUCTION_PARENT_REBUILD_BINDING_MISSING",
    );
  }
  const expected =
    xuanxueAiRequiredContinuationProfiles[child.order.productId];
  const parent = runtime.store.readOrder(parentRef.jobId);
  if (!parent) {
    throw new Error(
      "XUANXUE_AI_PRODUCTION_PARENT_REPLAY_PAYLOAD_REQUIRED",
    );
  }
  if (
    parent.order.productId !== expected.productId
    || parentRef.stageId !== expected.stageId
  ) {
    throw new Error(
      "XUANXUE_AI_PRODUCTION_PARENT_REBUILD_PROFILE_INVALID",
    );
  }
  if (parent.status === "completed") {
    runtime.store.resetOrderForParentConversationRebuild(
      parent.order.orderId,
    );
  }
  const rebuilt = await executeXuanxueAiProductionOrder(
    runtime,
    parent.order.orderId,
  );
  const rebuiltStage = requireXuanxueStage(
    rebuilt,
    parentRef.stageId,
  );
  const providerPageUrl =
    rebuiltStage.aiFeedResult?.providerProof.webChatUrl;
  if (
    rebuilt.status !== "completed"
    || rebuiltStage.status !== "completed"
    || !rebuiltStage.rawOutputHash
    || !providerPageUrl?.startsWith("https://chatgpt.com/")
  ) {
    throw new Error(
      "XUANXUE_AI_PRODUCTION_PARENT_REBUILD_INCOMPLETE",
    );
  }
  runtime.store.recordParentConversationRebuild({
    parentJobId: parentRef.jobId,
    parentStageId: parentRef.stageId,
    originalRawOutputHash: parentRef.rawOutputHash,
    rebuiltRawOutputHash: rebuiltStage.rawOutputHash,
    providerPageUrl,
    rebuiltAt: new Date().toISOString(),
  });
};

const precedes = (
  left: XuanxueAiOrderRecord,
  right: XuanxueAiOrderRecord,
): boolean => left.createdAt < right.createdAt
  || (
    left.createdAt === right.createdAt
    && left.order.orderId < right.order.orderId
  );

export class XuanxueAiProductionCoordinator {
  private readonly active = new Map<string, Promise<void>>();
  private readonly activeContinuationLanes = new Map<string, string>();
  private readonly scheduled = new Map<string, ScheduledOrder>();
  private readonly waiting: string[] = [];
  private readonly productionWindow: number;
  private pumpPromise: Promise<void> | null = null;
  private accepting = true;

  constructor(private readonly runtime: XuanxueAiProductionRuntime) {
    this.productionWindow = resolveXuanxueAiProductionWindow();
  }

  private continuationLaneKey(
    record: XuanxueAiOrderRecord,
  ): string | null {
    const parent = record.order.continuationParent;
    if (!parent) return null;
    const parentOrder = this.runtime.store.readOrder(parent.jobId);
    const parentStage = parentOrder?.stages.find(
      (stage) => stage.stageId === parent.stageId,
    );
    const exactUrl =
      parentStage?.aiFeedResult?.providerProof.webChatUrl;
    return typeof exactUrl === "string"
      && exactUrl.startsWith("https://chatgpt.com/")
      ? `gpt-chat:${exactUrl}`
      : `parent-stage:${parent.jobId}:${parent.stageId}`;
  }

  execute(orderId: string): Promise<XuanxueAiOrderRecord> {
    const existing = this.runtime.store.readOrder(orderId);
    if (!existing) {
      return Promise.reject(
        new Error("XUANXUE_AI_PRODUCTION_ORDER_NOT_FOUND"),
      );
    }
    if (terminal(existing)) return Promise.resolve(existing);
    const lane = this.continuationLaneKey(existing);
    if (lane) {
      for (const predecessor of this.runtime.store.listRecoverableOrders()) {
        if (
          this.continuationLaneKey(predecessor) === lane
          && precedes(predecessor, existing)
        ) this.register(predecessor.order.orderId);
      }
    }
    const scheduled = this.register(orderId);
    this.requestPump();
    return scheduled.promise;
  }

  activeCount(): number {
    return this.active.size;
  }

  availableCapacity(): number {
    return Math.max(0, this.productionWindow - this.active.size);
  }

  async close(): Promise<void> {
    this.accepting = false;
    await this.pumpPromise;
    await Promise.all([...this.active.values()]);
  }

  private register(orderId: string): ScheduledOrder {
    const existing = this.scheduled.get(orderId);
    if (existing) return existing;
    let resolve!: (record: XuanxueAiOrderRecord) => void;
    const promise = new Promise<XuanxueAiOrderRecord>((accept) => {
      resolve = accept;
    });
    const scheduled = { orderId, promise, resolve };
    this.scheduled.set(orderId, scheduled);
    this.waiting.push(orderId);
    return scheduled;
  }

  private requestPump(): void {
    if (!this.accepting || this.pumpPromise) return;
    const pump = this.pump();
    this.pumpPromise = pump;
    pump.finally(() => {
      if (this.pumpPromise !== pump) return;
      this.pumpPromise = null;
      if (
        this.accepting
        && this.waiting.length > 0
        && this.active.size < this.productionWindow
        && this.hasRunnableWaiting()
      ) this.requestPump();
    });
  }

  private async pump(): Promise<void> {
    while (
      this.accepting
      && this.active.size < this.productionWindow
      && this.waiting.length > 0
    ) {
      const orderId = this.takeNextRunnableOrderId();
      if (!orderId) {
        if (this.active.size === 0) {
          this.deferOrdersBehindRecoverableParentLane();
        }
        return;
      }
      const scheduled = this.scheduled.get(orderId);
      if (!scheduled || this.active.has(orderId)) continue;
      const record = this.runtime.store.readOrder(orderId);
      const lane = record ? this.continuationLaneKey(record) : null;
      if (lane) this.activeContinuationLanes.set(lane, orderId);
      const tracked = this.run(scheduled).finally(() => {
        this.active.delete(orderId);
        if (
          lane
          && this.activeContinuationLanes.get(lane) === orderId
        ) this.activeContinuationLanes.delete(lane);
        this.scheduled.delete(orderId);
        this.requestPump();
      });
      this.active.set(orderId, tracked);
    }
  }

  private takeNextRunnableOrderId(): string | null {
    const index = this.waiting.findIndex((orderId) =>
      this.orderCanRun(orderId));
    if (index < 0) return null;
    return this.waiting.splice(index, 1)[0] ?? null;
  }

  private hasRunnableWaiting(): boolean {
    return this.waiting.some((orderId) => this.orderCanRun(orderId));
  }

  private orderCanRun(orderId: string): boolean {
    const record = this.runtime.store.readOrder(orderId);
    if (!record) return true;
    const lane = this.continuationLaneKey(record);
    if (!lane) return true;
    if (this.activeContinuationLanes.has(lane)) return false;
    return !this.runtime.store.listRecoverableOrders().some(
      (candidate) =>
        candidate.order.orderId !== orderId
        && this.continuationLaneKey(candidate) === lane
        && precedes(candidate, record),
    );
  }

  private deferOrdersBehindRecoverableParentLane(): void {
    const now = new Date().toISOString();
    for (const orderId of this.waiting.splice(0)) {
      const scheduled = this.scheduled.get(orderId);
      const record = this.runtime.store.readOrder(orderId);
      if (!scheduled || !record) continue;
      const deferred = this.runtime.store.updateOrder({
        orderId,
        status: "recovery_pending",
        failureReason:
          "XUANXUE_AI_PRODUCTION_PARENT_LANE_PREDECESSOR_RECOVERY_PENDING",
        updatedAt: now,
        eventType: "order_parent_lane_deferred",
      });
      this.scheduled.delete(orderId);
      scheduled.resolve(deferred);
    }
  }

  private async run(scheduled: ScheduledOrder): Promise<void> {
    let record: XuanxueAiOrderRecord;
    let reason: string | null = null;
    try {
      record = await executeXuanxueAiProductionOrder(
        this.runtime,
        scheduled.orderId,
      );
    } catch (error) {
      reason = error instanceof Error ? error.message : String(error);
      const existing = this.runtime.store.readOrder(scheduled.orderId);
      if (!existing) throw error;
      if (continuationRebuildDefect(reason)) {
        try {
          await rebuildContinuationParent(this.runtime, existing);
          record = await executeXuanxueAiProductionOrder(
            this.runtime,
            scheduled.orderId,
          );
          scheduled.resolve(record);
          return;
        } catch (rebuildError) {
          reason = rebuildError instanceof Error
            ? rebuildError.message
            : String(rebuildError);
        }
      }
      const permanent = permanentExecutionDefect(reason);
      record = this.runtime.store.updateOrder({
        orderId: scheduled.orderId,
        status: "recovery_pending",
        failureReason: reason.slice(0, 1_000),
        updatedAt: new Date().toISOString(),
        eventType: permanent
          ? "order_internal_defect_deferred"
          : "order_execution_deferred",
      });
    }
    scheduled.resolve(record);
  }
}
