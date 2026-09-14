import { createHash } from "node:crypto";
import type {
  BrowserTargetLease,
  BrowserTargetReleaseAuthority,
  BrowserTargetLeaseWait,
} from "../exact-target/browser-target-lease.js";
import type { BrowserExactCallMutationFact } from "../exact-target/browser-mutation-types.js";
import type { BrowserExecutionBinding } from "./browser-authority-broker.js";
import { BrowserAuthorityBroker } from "./browser-authority-broker.js";
import { BrowserAuthorityIssuer } from "./browser-authority-issuer.js";
import type { createBrowserInfrastructureState } from "./browser-infrastructure-state.js";
import { BrowserAuthorityWebSocket } from "../transport/browser-authority-websocket.js";
import { browserExecutionFailure } from "../browser-failure.js";
import type { RuntimeLogger } from "../../runtime-logs/index.js";
import { BrowserTargetAcquirer } from "./browser-target-acquirer.js";
import { awaitBrowserPostSubmitQuiet } from "../exact-target/browser-command-postcondition.js";

type LaneWaiterBase = Readonly<{
  kind: "acquire" | "release";
  jobRefHash: `sha256:${string}`;
  eligibleAt: number;
  signal: AbortSignal;
  remainingMs(): number;
  stopAbortMonitor(): void;
  complete(lease?: BrowserTargetLease): void;
  reject(error: Error): void;
}>;
type AcquireLaneWaiter = LaneWaiterBase & Readonly<{
  kind: "acquire";
  binding: BrowserExecutionBinding;
  ownerId: string;
  targetMode: BrowserTargetLeaseWait["targetMode"];
  requestKind: "interaction" | "provider-observation";
}>;
type ReleaseLaneWaiter = LaneWaiterBase & Readonly<{
  kind: "release";
  jobId: string;
  releaseAuthority: BrowserTargetReleaseAuthority;
}>;
type LaneWaiter = AcquireLaneWaiter | ReleaseLaneWaiter;
type LaneState = ReturnType<typeof createBrowserInfrastructureState>;

export class BrowserLaneCoordinator {
  private readonly queue: LaneWaiter[] = [];
  private readonly targetAcquirer: BrowserTargetAcquirer;
  private active = false;
  private activeJobRefHash: `sha256:${string}` | null = null;
  private wakeTimer: ReturnType<typeof setTimeout> | null = null;
  private observationNotBefore = 0;

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
    wait: BrowserTargetLeaseWait,
  ): Promise<BrowserTargetLease> {
    if (this.queue.length >= 10) return Promise.reject(browserExecutionFailure(new Error("BROWSER_BACKPRESSURE")));
    if (!Number.isFinite(wait.eligibleAt)) {
      return Promise.reject(browserExecutionFailure(new Error("BROWSER_TARGET_INVALID")));
    }
    return new Promise<BrowserTargetLease>((resolve, reject) => {
      let settled = false;
      const abort = (): void => this.expireWaiter(waiter);
      const finish = <T>(action: (value: T) => void, value: T): void => {
        if (settled) return;
        settled = true;
        wait.signal.removeEventListener("abort", abort);
        action(value);
      };
      const waiter: AcquireLaneWaiter = {
        kind: "acquire", binding, ownerId, jobRefHash: binding.jobRefHash,
        targetMode: wait.targetMode,
        requestKind: wait.targetMode === "fresh" ? "interaction" : "provider-observation",
        eligibleAt: wait.eligibleAt,
        signal: wait.signal, remainingMs: wait.remainingMs,
        stopAbortMonitor: () => wait.signal.removeEventListener("abort", abort),
        complete: (lease) => lease
          ? finish(resolve, lease)
          : finish(reject, browserExecutionFailure(new Error("BROWSER_TARGET_INVALID"))),
        reject: (error) => finish(reject, error),
      };
      this.queue.push(waiter);
      wait.signal.addEventListener("abort", abort, { once: true });
      void this.pump();
    });
  }

  public releaseJobBoundTarget(
    jobId: string,
    releaseAuthority: BrowserTargetReleaseAuthority,
    signal: AbortSignal,
  ): Promise<void> {
    if (this.queue.length >= 10) return Promise.reject(browserExecutionFailure(new Error("BROWSER_BACKPRESSURE")));
    const deadlineAt = Date.now() + 30_000;
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const abort = (): void => this.expireWaiter(waiter);
      const finish = (action: () => void): void => {
        if (settled) return;
        settled = true;
        signal.removeEventListener("abort", abort);
        action();
      };
      const jobRefHash = `sha256:${createHash("sha256").update(jobId).digest("hex")}` as const;
      const waiter: ReleaseLaneWaiter = {
        kind: "release", jobId, jobRefHash, releaseAuthority, eligibleAt: Date.now(), signal,
        remainingMs: () => deadlineAt - Date.now(),
        stopAbortMonitor: () => signal.removeEventListener("abort", abort),
        complete: () => finish(resolve),
        reject: (error) => finish(() => reject(error)),
      };
      this.queue.push(waiter);
      signal.addEventListener("abort", abort, { once: true });
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

  public readState(): "idle" | "busy" | "blocked" {
    return this.active ? "busy" : this.hasUnresolvedMutation() ? "blocked" : "idle";
  }
  public waiterCount(): number { return this.queue.length; }
  public reset(reasonCode?: string): void {
    if (this.wakeTimer) clearTimeout(this.wakeTimer);
    this.wakeTimer = null;
    if (reasonCode) {
      this.rejectPending(reasonCode);
      for (const waiter of this.queue.splice(0)) waiter.reject(browserExecutionFailure(new Error(reasonCode)));
    }
    this.targetAcquirer.reset();
    this.active = false;
    this.activeJobRefHash = null;
    void this.pump();
  }
  public hasUnresolvedMutation(): boolean {
    return (this.infrastructure.mutationState?.countDispatched() ?? 0) > 0;
  }
  public hasMutationForJob(jobId: string): boolean {
    return this.infrastructure.mutationState?.hasMutationForJob(jobId) ?? false;
  }
  public hasUnresolvedMutationForJob(jobId: string): boolean {
    return this.infrastructure.mutationState?.hasUnresolvedMutationForJob(jobId) ?? false;
  }
  public purgeJob(jobId: string): void { this.infrastructure.mutationState?.purgeJob(jobId); }
  public countProviderTurnDispatches(jobId: string, attemptId: string): number {
    return this.infrastructure.mutationState?.countProviderTurnDispatches(jobId, attemptId) ?? 0;
  }
  public observeCurrentTargetClaim(input: Readonly<{
    targetRef: string;
    documentRef: string;
    jobRefHash: `sha256:${string}`;
  }>): void {
    if (this.activeJobRefHash !== input.jobRefHash) throw new Error("BROWSER_TARGET_INVALID");
  }
  public readExactCallMutationFact(input: Readonly<{
    jobId: string; attemptId: string;
    exactCallIdentityHash: `sha256:${string}`; actionOrdinal: number;
  }>): BrowserExactCallMutationFact | null {
    return this.infrastructure.mutationState?.readExactCallMutationFact(input) ?? null;
  }

  private nextWaiter(): LaneWaiter | null {
    const mutationBlocked = this.hasUnresolvedMutation();
    const now = Date.now();
    for (let index = 0; index < this.queue.length;) {
      const waiter = this.queue[index]!;
      if (waiter.signal.aborted || waiter.remainingMs() < 1) {
        this.queue.splice(index, 1);
        waiter.reject(browserExecutionFailure(new Error(
          waiter.signal.aborted ? "BROWSER_WAIT_ABORTED" : "V6_DEADLINE_BUDGET_EXHAUSTED",
        )));
        continue;
      }
      const exactPermanentCleanup = waiter.kind === "release"
        && (waiter.releaseAuthority === "website-permanent-revocation"
          || waiter.releaseAuthority === "website-admin-deletion")
        && this.hasUnresolvedMutationForJob(waiter.jobId);
      if (mutationBlocked && !exactPermanentCleanup) {
        index += 1;
        continue;
      }
      const eligibleAt = waiter.kind === "acquire" && waiter.requestKind === "provider-observation"
        ? Math.max(waiter.eligibleAt, this.observationNotBefore)
        : waiter.eligibleAt;
      if (eligibleAt > now) {
        index += 1;
        continue;
      }
      this.queue.splice(index, 1);
      return waiter;
    }
    return null;
  }

  private async pump(): Promise<void> {
    if (this.active) return;
    if (this.wakeTimer) clearTimeout(this.wakeTimer);
    this.wakeTimer = null;
    const waiter = this.nextWaiter();
    if (!waiter) {
      this.scheduleWake();
      return;
    }
    waiter.stopAbortMonitor();
    this.active = true;
    this.activeJobRefHash = waiter.jobRefHash;
    try {
      const mutations = this.infrastructure.mutationState;
      if (mutations) {
        await awaitBrowserPostSubmitQuiet(() => mutations.latestProviderInputTerminalAt());
      }
      if (waiter.kind === "release") {
        await this.targetAcquirer.releaseJobBoundTarget(waiter.remainingMs(), waiter.jobRefHash);
        waiter.complete();
        this.active = false;
        this.activeJobRefHash = null;
        void this.pump();
        return;
      }
      await this.targetAcquirer.ensureAvailableTarget(waiter);
      if (waiter.signal.aborted || waiter.remainingMs() < 1) throw new Error(
        waiter.signal.aborted ? "BROWSER_WAIT_ABORTED" : "V6_DEADLINE_BUDGET_EXHAUSTED",
      );
      const lease = await this.resolveBroker().acquireOperatorClaimedTargetLease(waiter.binding, waiter.ownerId);
      waiter.complete(this.withLifecycle(lease, waiter.requestKind));
    } catch (error) {
      this.active = false;
      this.activeJobRefHash = null;
      void this.pump();
      waiter.reject(browserExecutionFailure(error));
    }
  }

  private withLifecycle(
    lease: BrowserTargetLease,
    requestKind: "interaction" | "provider-observation",
  ): BrowserTargetLease {
    const finish = async (action: () => Promise<void>): Promise<void> => {
      try {
        await action();
      } catch (error) {
        throw browserExecutionFailure(
          new Error("BROWSER_TARGET_LIFECYCLE_UNSETTLED", { cause: error }),
        );
      } finally {
        if (requestKind === "provider-observation") {
          this.observationNotBefore = Date.now() + 60_000;
        }
        this.active = false;
        this.activeJobRefHash = null;
        void this.pump();
      }
    };
    const park: BrowserTargetLease["park"] = (input) => finish(() => lease.park(input));
    return new Proxy(lease, {
      get(target, property) {
        if (property === "park") return park;
        const value = Reflect.get(target, property, target) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  }

  public resolvePending(action: "acquire" | "release", jobRefHash: string): void {
    this.targetAcquirer.resolvePending(action, jobRefHash);
  }
  public rejectPending(reasonCode: string): void { this.targetAcquirer.rejectPending(reasonCode); }

  private scheduleWake(): void {
    if (this.active || this.queue.length === 0) return;
    const now = Date.now();
    const mutationBlocked = this.hasUnresolvedMutation();
    let nextAt = Number.POSITIVE_INFINITY;
    for (const waiter of this.queue) {
      const exactPermanentCleanup = waiter.kind === "release"
        && (waiter.releaseAuthority === "website-permanent-revocation"
          || waiter.releaseAuthority === "website-admin-deletion")
        && this.hasUnresolvedMutationForJob(waiter.jobId);
      const eligibility = mutationBlocked && !exactPermanentCleanup
        ? now + Math.max(0, waiter.remainingMs())
        : waiter.kind === "acquire" && waiter.requestKind === "provider-observation"
          ? Math.max(waiter.eligibleAt, this.observationNotBefore)
          : waiter.eligibleAt;
      nextAt = Math.min(nextAt, eligibility, now + Math.max(0, waiter.remainingMs()));
    }
    const delay = Math.max(1, Math.ceil(nextAt - now));
    this.wakeTimer = setTimeout(() => {
      this.wakeTimer = null;
      void this.pump();
    }, delay);
  }
}
