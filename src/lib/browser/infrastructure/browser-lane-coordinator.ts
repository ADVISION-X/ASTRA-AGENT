import type { BrowserTargetLease } from "../exact-target/browser-target-lease.js";
import type { BrowserExactCallMutationFact } from "../exact-target/browser-mutation-store.js";
import type { BrowserExecutionBinding } from "./browser-authority-broker.js";
import { BrowserAuthorityBroker } from "./browser-authority-broker.js";
import { BrowserAuthorityIssuer } from "./browser-authority-issuer.js";
import type { createBrowserInfrastructureState } from "./browser-infrastructure-state.js";
import { BrowserAuthorityWebSocket } from "../transport/browser-authority-websocket.js";
import { browserExecutionFailure } from "../browser-failure.js";
import type { RuntimeLogger } from "../../runtime-logs/index.js";
import { BrowserTargetAcquirer } from "./browser-target-acquirer.js";

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
  private readonly targetAcquirer: BrowserTargetAcquirer;
  private active = false;

  public constructor(
    private readonly resolveBroker: () => BrowserAuthorityBroker,
    websocket: BrowserAuthorityWebSocket,
    issuer: BrowserAuthorityIssuer,
    private readonly infrastructure: LaneState,
    _runtimeLogger: RuntimeLogger,
  ) {
    this.targetAcquirer = new BrowserTargetAcquirer(resolveBroker, websocket, issuer, infrastructure);
  }

  public acquire(
    binding: BrowserExecutionBinding,
    ownerId: string,
    wait: Readonly<{ signal: AbortSignal; remainingMs(): number }>,
  ): Promise<BrowserTargetLease> {
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

  public readState(): "idle" | "busy" | "blocked" { return this.active ? "busy" : "idle"; }
  public waiterCount(): number { return this.queue.length; }
  public reset(reasonCode?: string): void {
    if (reasonCode) {
      this.rejectPending(reasonCode);
      for (const waiter of this.queue.splice(0)) waiter.reject(browserExecutionFailure(new Error(reasonCode)));
    }
    this.targetAcquirer.reset();
    this.active = false;
    void this.pump();
  }
  public hasUnresolvedMutation(): boolean {
    return (this.infrastructure.mutationState?.countDispatched() ?? 0) > 0;
  }
  public hasMutationForJob(jobId: string): boolean {
    return this.infrastructure.mutationState?.hasMutationForJob(jobId) ?? false;
  }
  public countProviderTurnDispatches(jobId: string, attemptId: string): number {
    return this.infrastructure.mutationState?.countProviderTurnDispatches(jobId, attemptId) ?? 0;
  }
  public observeCurrentTargetClaim(_input: Readonly<{ targetRef: string; documentRef: string }>): void {}
  public readExactCallMutationFact(input: Readonly<{
    jobId: string; attemptId: string; ownerPluginId: string; pluginVersion: number;
    exactCallIdentityHash: `sha256:${string}`; actionOrdinal: number;
  }>): BrowserExactCallMutationFact | null {
    return this.infrastructure.mutationState?.readExactCallMutationFact(input) ?? null;
  }

  private nextWaiter(): LaneWaiter | null {
    while (this.queue.length > 0) {
      const waiter = this.queue.shift()!;
      if (!waiter.signal.aborted && waiter.remainingMs() >= 1) return waiter;
      waiter.reject(browserExecutionFailure(new Error(
        waiter.signal.aborted ? "BROWSER_WAIT_ABORTED" : "V6_DEADLINE_BUDGET_EXHAUSTED",
      )));
    }
    return null;
  }

  private async pump(): Promise<void> {
    if (this.active) return;
    const waiter = this.nextWaiter();
    if (!waiter) return;
    waiter.stopWaitingMonitor();
    this.active = true;
    try {
      await this.targetAcquirer.ensureAvailableTarget(waiter);
      if (waiter.signal.aborted || waiter.remainingMs() < 1) throw new Error(
        waiter.signal.aborted ? "BROWSER_WAIT_ABORTED" : "V6_DEADLINE_BUDGET_EXHAUSTED",
      );
      const lease = await this.resolveBroker().acquireOperatorClaimedTargetLease(waiter.binding, waiter.ownerId);
      waiter.resolve(this.withLifecycle(lease));
    } catch (error) {
      this.active = false;
      void this.pump();
      waiter.reject(browserExecutionFailure(error));
    }
  }

  private withLifecycle(lease: BrowserTargetLease): BrowserTargetLease {
    const finish = async (action: () => Promise<void>): Promise<void> => {
      try { await action(); }
      catch (error) {
        this.resolveBroker().revokeOperatorTargetClaim(lease.target.targetRef);
        throw browserExecutionFailure(new Error("BROWSER_TARGET_LIFECYCLE_UNSETTLED", { cause: error }));
      } finally {
        this.active = false;
        void this.pump();
      }
    };
    return { ...lease, park: (input) => finish(() => lease.park(input)), close: (input) => finish(() => lease.close(input)) };
  }

  public resolvePending(targetRef: string): void { this.targetAcquirer.resolvePending(targetRef); }
  public rejectPending(reasonCode: string): void { this.targetAcquirer.rejectPending(reasonCode); }
}
