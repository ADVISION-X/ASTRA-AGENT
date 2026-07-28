import {
  executeXuanxueAiProductionOrder,
  type XuanxueAiProductionRuntime,
} from "./xuanxue-ai-production.flow.js";
import type { XuanxueAiOrderRecord } from "./xuanxue-ai-production.schema.js";

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
  || record.status === "review_required"
  || record.status === "failed";

const permanentExecutionDefect = (reason: string): boolean =>
  /(?:PROFILE_MISMATCH|IDENTITY_CONFLICT|SOURCE_TASK_CONFLICT|ORDER_NOT_FOUND|STAGE_MISSING|DEPENDENCY_HASH_MISMATCH|INPUT_.*INVALID|REQUEST_.*INVALID)/u
    .test(reason);

export class XuanxueAiProductionCoordinator {
  private readonly active = new Map<string, Promise<void>>();
  private readonly scheduled = new Map<string, ScheduledOrder>();
  private readonly waiting: string[] = [];
  private readonly productionWindow: number;
  private pumpPromise: Promise<void> | null = null;
  private accepting = true;

  constructor(private readonly runtime: XuanxueAiProductionRuntime) {
    this.productionWindow = resolveXuanxueAiProductionWindow();
  }

  resumeRecoverableOrders(): void {
    for (const record of this.runtime.store.listRecoverableOrders()) {
      this.register(record.order.orderId);
    }
    this.requestPump();
  }

  execute(orderId: string): Promise<XuanxueAiOrderRecord> {
    const existing = this.runtime.store.readOrder(orderId);
    if (!existing) {
      return Promise.reject(
        new Error("XUANXUE_AI_PRODUCTION_ORDER_NOT_FOUND"),
      );
    }
    if (terminal(existing)) return Promise.resolve(existing);
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
      ) this.requestPump();
    });
  }

  private async pump(): Promise<void> {
    while (
      this.accepting
      && this.active.size < this.productionWindow
      && this.waiting.length > 0
    ) {
      const orderId = this.waiting.shift()!;
      const scheduled = this.scheduled.get(orderId);
      if (!scheduled || this.active.has(orderId)) continue;
      const tracked = this.run(scheduled).finally(() => {
        this.active.delete(orderId);
        this.scheduled.delete(orderId);
        this.requestPump();
      });
      this.active.set(orderId, tracked);
    }
  }

  private async run(scheduled: ScheduledOrder): Promise<void> {
    let record: XuanxueAiOrderRecord;
    try {
      record = await executeXuanxueAiProductionOrder(
        this.runtime,
        scheduled.orderId,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const existing = this.runtime.store.readOrder(scheduled.orderId);
      if (!existing) throw error;
      const permanent = permanentExecutionDefect(reason);
      record = this.runtime.store.updateOrder({
        orderId: scheduled.orderId,
        status: permanent ? "failed" : "recovery_pending",
        failureReason: reason.slice(0, 1_000),
        updatedAt: new Date().toISOString(),
        eventType: permanent
          ? "order_execution_failed"
          : "order_execution_deferred",
      });
    }
    scheduled.resolve(record);
  }
}
