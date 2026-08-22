import {
  executeXuanxueAiProductionOrder,
  type XuanxueAiProductionExecutionObserver,
  type XuanxueAiProductionRuntime,
} from "./xuanxue-ai-production.flow.js";
import {
  type XuanxueAiOrderRecord,
} from "./xuanxue-ai-production.schema.js";
import type { XuanxueAiExecutionDeadlineBudget } from "./xuanxue-ai-production.runtime.js";

interface ScheduledOrder {
  readonly orderId: string;
  readonly promise: Promise<XuanxueAiOrderRecord>;
  readonly resolve: (record: XuanxueAiOrderRecord) => void;
  readonly observers: Set<XuanxueAiProductionExecutionObserver>;
  deadlineBudget?: XuanxueAiExecutionDeadlineBudget;
}

export const resolveXuanxueAiProductionWindow = (): 1 => 1;

const terminal = (record: XuanxueAiOrderRecord): boolean =>
  record.status === "completed"
  || record.status === "cancelled"
  || record.status === "review_required"
  || record.status === "failed";

const permanentExecutionDefect = (reason: string): boolean =>
  /(?:PROFILE_MISMATCH|IDENTITY_CONFLICT|SOURCE_TASK_CONFLICT|ORDER_NOT_FOUND|STAGE_MISSING|DEPENDENCY_HASH_MISMATCH|INPUT_.*INVALID|REQUEST_.*INVALID)/u
    .test(reason);

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
    const parent = record.order.conversationParent;
    if (!parent || parent.relation !== "same_conversation") return null;
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

  async execute(
    orderId: string,
    observer?: XuanxueAiProductionExecutionObserver,
    deadlineBudget?: XuanxueAiExecutionDeadlineBudget,
  ): Promise<XuanxueAiOrderRecord> {
    const alreadyScheduled = this.scheduled.get(orderId);
    if (alreadyScheduled) {
      if (observer) alreadyScheduled.observers.add(observer);
      if (deadlineBudget) alreadyScheduled.deadlineBudget = deadlineBudget;
      return alreadyScheduled.promise;
    }
    const existing = this.runtime.store.readOrder(orderId);
    if (!existing) {
      return Promise.reject(
        new Error("XUANXUE_AI_PRODUCTION_ORDER_NOT_FOUND"),
      );
    }
    if (terminal(existing)) return Promise.resolve(existing);
    const intervention = this.runtime.store.readIntervention(orderId);
    if (intervention.state.endsWith("_requested")) {
      const acknowledged = this.runtime.store.acknowledgeInterventionAtSafePoint(
        orderId,
        "scheduler-dequeue",
      );
      if (acknowledged?.state === "taken_over") {
        await this.runtime.aiInputGateway.releaseProviderTargetForOperator?.(
          `xuanxue-ai-production:${orderId}`,
        );
      }
      return Promise.resolve(this.runtime.store.readOrder(orderId)!);
    }
    if (intervention.state !== "running") return Promise.resolve(existing);
    const lane = this.continuationLaneKey(existing);
    if (lane) {
      for (const predecessor of this.runtime.store.listRecoverableOrders()) {
        if (
          this.continuationLaneKey(predecessor) === lane
          && precedes(predecessor, existing)
        ) this.register(predecessor.order.orderId);
      }
    }
    const scheduled = this.register(orderId, deadlineBudget);
    if (observer) scheduled.observers.add(observer);
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

  private register(
    orderId: string,
    deadlineBudget?: XuanxueAiExecutionDeadlineBudget,
  ): ScheduledOrder {
    const existing = this.scheduled.get(orderId);
    if (existing) {
      if (deadlineBudget) existing.deadlineBudget = deadlineBudget;
      return existing;
    }
    let resolve!: (record: XuanxueAiOrderRecord) => void;
    const promise = new Promise<XuanxueAiOrderRecord>((accept) => {
      resolve = accept;
    });
    const scheduled = {
      orderId,
      promise,
      resolve,
      observers: new Set<XuanxueAiProductionExecutionObserver>(),
      ...(deadlineBudget ? { deadlineBudget } : {}),
    };
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
        {
          onAttachmentUploadCompleted: async (input) => {
            for (const observer of scheduled.observers) {
              await observer.onAttachmentUploadCompleted?.(input);
            }
          },
        },
        scheduled.deadlineBudget,
      );
    } catch (error) {
      reason = error instanceof Error ? error.message : String(error);
      const existing = this.runtime.store.readOrder(scheduled.orderId);
      if (!existing) throw error;
      if (reason.startsWith("XUANXUE_AI_INTERVENTION_STOPPED:")) {
        scheduled.resolve(existing);
        return;
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
