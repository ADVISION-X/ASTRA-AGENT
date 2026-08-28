import type { BrowserTargetLease } from "../exact-target/browser-target-lease.js";
import type { BrowserMutationReconciliationScope } from "../exact-target/browser-mutation-store.js";
import type { BrowserExecutionBinding } from "./browser-authority-broker.js";
import { BrowserAuthorityBroker } from "./browser-authority-broker.js";
import { BrowserAuthorityIssuer } from "./browser-authority-issuer.js";
import type { createBrowserInfrastructureState } from "./browser-infrastructure-state.js";
import { BrowserAuthorityWebSocket } from "../transport/browser-authority-websocket.js";
import { browserExecutionFailure } from "../browser-failure.js";
import { BROWSER_COMMAND_DEFAULT_DEADLINE_MS } from "../protocol/generated/browser-protocol.generated.js";

type LaneWaiter = Readonly<{
  binding: BrowserExecutionBinding;
  ownerId: string;
  signal: AbortSignal;
  remainingMs(): number;
  stopWaitingMonitor(): void;
  resolve(lease: BrowserTargetLease): void;
  reject(error: Error): void;
}>;

type LaneState = ReturnType<typeof createBrowserInfrastructureState>;

export class BrowserLaneCoordinator {
  private readonly queue: LaneWaiter[] = [];
  private active = false;
  private unsettled = false;

  public constructor(
    private readonly resolveBroker: () => BrowserAuthorityBroker,
    private readonly websocket: BrowserAuthorityWebSocket,
    private readonly issuer: BrowserAuthorityIssuer,
    private readonly infrastructure: LaneState,
    private readonly emitState: (current: "idle" | "busy" | "review_required") => void,
  ) {}

  public acquire(
    binding: BrowserExecutionBinding,
    ownerId: string,
    wait: Readonly<{ signal: AbortSignal; remainingMs(): number }>,
  ): Promise<BrowserTargetLease> {
    if (binding.kind === "production-reconciliation") return this.acquireReconciliation(binding, ownerId, wait);
    if (this.unsettled) {
      const dispatched = this.hasUnresolvedMutation();
      return Promise.reject(browserExecutionFailure(
        new Error(dispatched ? "BROWSER_MUTATION_UNSETTLED" : "BROWSER_TARGET_LIFECYCLE_UNSETTLED"),
        dispatched ? "dispatched" : "no",
      ));
    }
    if (this.queue.length >= 10) return Promise.reject(browserExecutionFailure(new Error("BROWSER_BACKPRESSURE")));
    return new Promise<BrowserTargetLease>((resolve, reject) => {
      let settled = false;
      let monitor: ReturnType<typeof setInterval> | null = null;
      const finish = <T>(action: (value: T) => void, value: T): void => {
        if (settled) return;
        settled = true;
        if (monitor) clearInterval(monitor);
        action(value);
      };
      const waiter: LaneWaiter = {
        binding, ownerId, signal: wait.signal, remainingMs: wait.remainingMs,
        stopWaitingMonitor: () => { if (monitor) clearInterval(monitor); monitor = null; },
        resolve: (lease) => finish(resolve, lease), reject: (error) => finish(reject, error),
      };
      this.queue.push(waiter);
      monitor = setInterval(() => this.expireWaiter(waiter), 100);
      void this.pump();
    });
  }

  private expireWaiter(waiter: LaneWaiter): void {
    if (!waiter.signal.aborted && waiter.remainingMs() >= 1) return;
    const index = this.queue.indexOf(waiter);
    if (index < 0) return;
    this.queue.splice(index, 1);
    waiter.reject(browserExecutionFailure(new Error(
      waiter.signal.aborted ? "BROWSER_WAIT_ABORTED" : "V6_DEADLINE_BUDGET_EXHAUSTED",
    )));
    void this.pump();
  }

  public readState(): "idle" | "busy" | "unsettled" {
    if (this.unsettled) return "unsettled";
    return this.active ? "busy" : "idle";
  }

  public waiterCount(): number { return this.queue.length; }

  public reset(reasonCode?: string): void {
    if (reasonCode) {
      this.rejectPending(reasonCode);
      for (const waiter of this.queue.splice(0)) waiter.reject(browserExecutionFailure(new Error(reasonCode)));
    }
    this.active = false;
    this.unsettled = false;
  }

  public hasUnresolvedMutation(): boolean {
    return this.infrastructure.mutationState?.reconciliationStates().some(
      (entry) => entry.current === "PREPARED" || entry.current === "DISPATCHED",
    ) ?? false;
  }

  public reconciliationScope(
    input: Readonly<{ jobId: string; ownerPluginId: string }>,
  ): BrowserMutationReconciliationScope | null {
    return this.infrastructure.mutationState?.reconciliationScope(input) ?? null;
  }

  private reconciliationAllowed(
    binding: BrowserExecutionBinding,
    scope: BrowserMutationReconciliationScope | null,
    wait: Readonly<{ signal: AbortSignal; remainingMs(): number }>,
  ): boolean {
    return binding.kind === "production-reconciliation" && scope !== null
      && scope.jobId === binding.jobId && scope.ownerPluginId === binding.ownerPluginId
      && !this.active && this.queue.length === 0 && !wait.signal.aborted && wait.remainingMs() >= 1
      && this.resolveBroker().currentOperatorTargetStatus() === "claimed";
  }

  private async acquireReconciliation(
    binding: BrowserExecutionBinding,
    ownerId: string,
    wait: Readonly<{ signal: AbortSignal; remainingMs(): number }>,
  ): Promise<BrowserTargetLease> {
    const scope = this.reconciliationScope({ jobId: binding.jobId, ownerPluginId: binding.ownerPluginId });
    if (!this.reconciliationAllowed(binding, scope, wait)) {
      throw browserExecutionFailure(new Error("BROWSER_RECONCILIATION_SCOPE_INVALID"), "dispatched");
    }
    this.active = true;
    this.emitState("busy");
    try {
      const lease = await this.resolveBroker().acquireOperatorClaimedTargetLease(binding, ownerId);
      if (lease.target.targetRef !== scope!.targetRef || lease.document.documentRef !== scope!.documentRef) {
        throw new Error("BROWSER_DOCUMENT_INVALID");
      }
      return this.withLifecycle(lease);
    } catch (error) {
      this.active = false;
      this.unsettled = true;
      this.emitState("review_required");
      throw browserExecutionFailure(error, "dispatched");
    }
  }

  private nextWaiter(): LaneWaiter | null {
    let waiter = this.queue.shift();
    while (waiter && (waiter.signal.aborted || waiter.remainingMs() < 1)) {
      waiter.reject(browserExecutionFailure(new Error(
        waiter.signal.aborted ? "BROWSER_WAIT_ABORTED" : "V6_DEADLINE_BUDGET_EXHAUSTED",
      )));
      waiter = this.queue.shift();
    }
    return waiter ?? null;
  }

  private async pump(): Promise<void> {
    if (this.active || this.unsettled) return;
    const waiter = this.nextWaiter();
    if (!waiter) return;
    waiter.stopWaitingMonitor();
    this.active = true;
    this.emitState("busy");
    try {
      if (this.resolveBroker().currentOperatorTargetStatus() === "absent") {
        await this.acquireJobBoundTarget(Math.min(waiter.binding.commandTtlMs, waiter.remainingMs()));
      }
      if (waiter.signal.aborted || waiter.remainingMs() < 1) throw browserExecutionFailure(new Error(
        waiter.signal.aborted ? "BROWSER_WAIT_ABORTED" : "V6_DEADLINE_BUDGET_EXHAUSTED",
      ));
      const lease = await this.resolveBroker().acquireOperatorClaimedTargetLease(waiter.binding, waiter.ownerId);
      waiter.resolve(this.withLifecycle(lease));
    } catch (error) {
      const failure = browserExecutionFailure(error);
      this.unsettled = failure.mutationOutcome === "dispatched";
      this.active = this.unsettled;
      this.emitState(this.unsettled ? "review_required" : "idle");
      if (!this.unsettled) void this.pump();
      waiter.reject(failure);
    }
  }

  private withLifecycle(lease: BrowserTargetLease): BrowserTargetLease {
    return {
      ...lease,
      close: async (input) => {
        try {
          await lease.close(input);
          this.active = false;
          this.unsettled = false;
          this.emitState("idle");
          void this.pump();
        } catch (error) {
          this.unsettled = true;
          this.emitState("review_required");
          throw browserExecutionFailure(new Error("BROWSER_TARGET_LIFECYCLE_UNSETTLED", { cause: error }), "no");
        }
      },
    };
  }

  private async acquireJobBoundTarget(commandTtlMs: number): Promise<void> {
    const current = this.issuer.current();
    if (current.kind === "ABSENT") throw new Error(current.reasonCode);
    if (!Number.isInteger(commandTtlMs) || commandTtlMs < 1 || commandTtlMs > 3_600_000) {
      throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
    }
    if (this.infrastructure.pendingJobBoundTargetAcquisition) throw new Error("BROWSER_BACKPRESSURE");
    const deadlineMs = Math.min(commandTtlMs, BROWSER_COMMAND_DEFAULT_DEADLINE_MS);
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.infrastructure.pendingJobBoundTargetAcquisition?.authorityEpoch !== current.authority.authorityEpoch) return;
        this.infrastructure.pendingJobBoundTargetAcquisition = null;
        reject(new Error("BROWSER_TARGET_ACQUISITION_TIMEOUT"));
      }, deadlineMs);
      this.infrastructure.pendingJobBoundTargetAcquisition = {
        authorityEpoch: current.authority.authorityEpoch, resolve, reject, timeout,
      };
      try { this.websocket.requestPreauthorizedTargetAcquisition(); }
      catch (error) {
        this.rejectPending(error instanceof Error ? error.message : "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
      }
    });
  }

  public resolvePending(): void {
    const pending = this.infrastructure.pendingJobBoundTargetAcquisition;
    if (!pending) return;
    this.infrastructure.pendingJobBoundTargetAcquisition = null;
    clearTimeout(pending.timeout);
    pending.resolve();
  }

  public rejectPending(reasonCode: string): void {
    const pending = this.infrastructure.pendingJobBoundTargetAcquisition;
    if (!pending) return;
    this.infrastructure.pendingJobBoundTargetAcquisition = null;
    clearTimeout(pending.timeout);
    pending.reject(new Error(reasonCode));
  }
}
