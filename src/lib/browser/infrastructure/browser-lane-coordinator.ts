import { createHash } from "node:crypto";
import type { BrowserTargetLease, BrowserTargetLeaseWait, BrowserTargetReleaseAuthority } from "../exact-target/browser-target-lease.js";
import { BrowserAuthorityBroker, type BrowserExecutionBinding } from "./browser-authority-broker.js";
import { BrowserAuthorityIssuer } from "./browser-authority-issuer.js";
import type { createBrowserInfrastructureState } from "./browser-infrastructure-state.js";
import { BrowserAuthorityWebSocket } from "../transport/browser-authority-websocket.js";
import { browserExecutionFailure } from "../browser-failure.js";
import { BrowserTargetAcquirer } from "./browser-target-acquirer.js";
import { awaitBrowserPostSubmitQuiet } from "../exact-target/browser-command-postcondition.js";

type LaneWaiterBase = Readonly<{
  jobRefHash: `sha256:${string}`; eligibleAt: number; signal: AbortSignal;
  stopAbortMonitor(): void;
  complete(lease?: BrowserTargetLease): void; reject(error: Error): void;
}>;
type AcquireLaneWaiter = LaneWaiterBase & Readonly<{
  remainingMs(): number;
  kind: "acquire"; binding: BrowserExecutionBinding; ownerId: string;
  targetMode: BrowserTargetLeaseWait["targetMode"]; parentJobId?: string; parentAttemptId?: string;
  requestKind: "interaction" | "provider-observation";
}>;
type ReleaseLaneWaiter = LaneWaiterBase & Readonly<{
  kind: "release"; jobId: string; releaseAuthority: BrowserTargetReleaseAuthority; queueDeadlineAt: number;
}>;
type LaneWaiter = AcquireLaneWaiter | ReleaseLaneWaiter;
type LaneState = ReturnType<typeof createBrowserInfrastructureState>;
const PROVIDER_OBSERVATION_MIN_INTERVAL_MS = 70_000;
const PROVIDER_OBSERVATION_RANDOM_SPAN_MS = 20_001;
const waiterExpiryCode = (waiter: LaneWaiter): string | null => waiter.signal.aborted
  ? "BROWSER_WAIT_ABORTED" : (waiter.kind === "release" ? waiter.queueDeadlineAt - Date.now()
    : waiter.remainingMs()) < 1 ? "V6_DEADLINE_BUDGET_EXHAUSTED" : null;

/** One FIFO admission and one global Provider observation cadence. */
export class BrowserLaneCoordinator {
  private readonly queue: LaneWaiter[] = [];
  private readonly targetAcquirer: BrowserTargetAcquirer;
  private active = false;
  private activeJobRefHash: `sha256:${string}` | null = null;
  private wakeTimer: ReturnType<typeof setTimeout> | null = null;
  private observationNotBefore = 0;

  public constructor(
    private readonly resolveBroker: () => BrowserAuthorityBroker,
    websocket: BrowserAuthorityWebSocket, issuer: BrowserAuthorityIssuer,
    private readonly infrastructure: LaneState,
  ) { this.targetAcquirer = new BrowserTargetAcquirer(resolveBroker, websocket, issuer, infrastructure); }

  public acquire(binding: BrowserExecutionBinding, ownerId: string, wait: BrowserTargetLeaseWait): Promise<BrowserTargetLease> {
    if (this.queue.length >= 10) return Promise.reject(browserExecutionFailure(new Error("BROWSER_BACKPRESSURE")));
    if (!Number.isFinite(wait.eligibleAt)) return Promise.reject(browserExecutionFailure(new Error("BROWSER_TARGET_INVALID")));
    return new Promise<BrowserTargetLease>((resolve, reject) => {
      let settled = false;
      const abort = (): void => this.expireWaiter(waiter);
      const finish = (lease: BrowserTargetLease | undefined, error?: Error): void => {
        if (settled) return;
        settled = true;
        wait.signal.removeEventListener("abort", abort);
        if (lease) resolve(lease);
        else reject(error ?? browserExecutionFailure(new Error("BROWSER_TARGET_INVALID")));
      };
      const waiter: AcquireLaneWaiter = {
        kind: "acquire", binding, ownerId, jobRefHash: binding.jobRefHash, targetMode: wait.targetMode,
        ...(wait.targetMode === "authorized-continuation" ? { parentJobId: wait.parentJobId, parentAttemptId: wait.parentAttemptId } : {}),
        requestKind: wait.targetMode === "confirmed-readback" ? "provider-observation" : "interaction",
        eligibleAt: wait.eligibleAt, signal: wait.signal, remainingMs: wait.remainingMs,
        stopAbortMonitor: () => wait.signal.removeEventListener("abort", abort),
        complete: lease => finish(lease), reject: error => finish(undefined, error),
      };
      this.queue.push(waiter);
      wait.signal.addEventListener("abort", abort, { once: true });
      void this.pump();
    });
  }

  public releaseJobBoundTarget(jobId: string, releaseAuthority: BrowserTargetReleaseAuthority, signal: AbortSignal): Promise<void> {
    if (this.queue.length >= 10) return Promise.reject(browserExecutionFailure(new Error("BROWSER_BACKPRESSURE")));
    const queueDeadlineAt = Date.now() + 30_000;
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const abort = (): void => this.expireWaiter(waiter);
      const finish = (error?: Error): void => {
        if (settled) return;
        settled = true;
        signal.removeEventListener("abort", abort);
        if (error) reject(error); else resolve();
      };
      const waiter: ReleaseLaneWaiter = { kind: "release", jobId, releaseAuthority, queueDeadlineAt,
        jobRefHash: `sha256:${createHash("sha256").update(jobId).digest("hex")}`, eligibleAt: Date.now(), signal,
        stopAbortMonitor: () => signal.removeEventListener("abort", abort),
        complete: () => finish(), reject: error => finish(error) };
      this.queue.push(waiter);
      signal.addEventListener("abort", abort, { once: true });
      void this.pump();
    });
  }

  private expireWaiter(waiter: LaneWaiter): void {
    const code = waiterExpiryCode(waiter), index = this.queue.indexOf(waiter);
    if (!code || index < 0) return;
    this.queue.splice(index, 1);
    waiter.reject(browserExecutionFailure(new Error(code)));
    void this.pump();
  }

  public readState(): "idle" | "busy" | "blocked" { return this.active ? "busy" : "idle"; }
  public reset(reasonCode?: string): void {
    if (this.wakeTimer) clearTimeout(this.wakeTimer);
    this.wakeTimer = null;
    if (reasonCode) {
      this.targetAcquirer.rejectPending(reasonCode);
      for (const waiter of this.queue.splice(0)) waiter.reject(browserExecutionFailure(new Error(reasonCode)));
    }
    this.active = false;
    this.activeJobRefHash = null;
    void this.pump();
  }
  public notifyMutationSettled(): void { void this.pump(); }
  public hasUnresolvedMutation(): boolean { return (this.infrastructure.mutationState?.countDispatched() ?? 0) > 0; }
  public hasMutationForJob(jobId: string): boolean { return this.infrastructure.mutationState?.hasMutationForJob(jobId) ?? false; }
  public purgeJob(jobId: string, authority: "website-admin-deletion"): void { this.infrastructure.mutationState?.purgeJob(jobId, authority); void this.pump(); }
  public countProviderTurnDispatches(jobId: string, attemptId: string): number { return this.infrastructure.mutationState?.countProviderTurnDispatches(jobId, attemptId) ?? 0; }
  public observeCurrentTargetClaim(input: Readonly<{ targetRef: string; documentRef: string; jobRefHash: `sha256:${string}` }>): void {
    if (input.jobRefHash !== this.activeJobRefHash) throw new Error("BROWSER_TARGET_INVALID");
  }
  public readProviderEffectStepCallFact(input: Readonly<{
    jobId: string; attemptId: string; resultRevision: number; productStepId: string; callId: string; childCapabilityId: string;
  }>) { return this.infrastructure.mutationState?.readProviderEffectStepCallFact(input) ?? null; }
  public resolvePending(action: "acquire" | "release", jobRefHash: string): void { this.targetAcquirer.resolvePending(action, jobRefHash); }
  public rejectPending(reasonCode: string, refs?: Readonly<Record<string, string>>): void { this.targetAcquirer.rejectPending(reasonCode, refs); }

  private nextWaiter(): LaneWaiter | null {
    const now = Date.now();
    for (let index = 0; index < this.queue.length;) {
      const waiter = this.queue[index]!;
      const expired = waiterExpiryCode(waiter);
      if (expired) { this.queue.splice(index, 1); waiter.reject(browserExecutionFailure(new Error(expired))); continue; }
      const eligibility = waiter.kind === "acquire" && waiter.requestKind === "provider-observation"
        ? Math.max(waiter.eligibleAt, this.observationNotBefore) : waiter.eligibleAt;
      if (eligibility > now) { index += 1; continue; }
      this.queue.splice(index, 1);
      waiter.stopAbortMonitor();
      return waiter;
    }
    return null;
  }

  private expireQueuedReleases(): void {
    for (const waiter of [...this.queue]) {
      if (waiter.kind !== "release") continue;
      const code = waiterExpiryCode(waiter);
      if (!code) continue;
      this.queue.splice(this.queue.indexOf(waiter), 1);
      waiter.reject(browserExecutionFailure(new Error(code)));
    }
  }

  private async pump(): Promise<void> {
    if (this.active) { this.expireQueuedReleases(); this.scheduleWake(); return; }
    if (this.wakeTimer) clearTimeout(this.wakeTimer);
    this.wakeTimer = null;
    const waiter = this.nextWaiter();
    if (!waiter) { this.scheduleWake(); return; }
    this.active = true;
    this.activeJobRefHash = waiter.jobRefHash;
    this.scheduleWake();
    try {
      const mutations = this.infrastructure.mutationState;
      if (mutations) await awaitBrowserPostSubmitQuiet(() => mutations.latestProviderInputTerminalAt());
      const code = waiter.kind === "release" ? (waiter.signal.aborted ? "BROWSER_WAIT_ABORTED" : null) : waiterExpiryCode(waiter);
      if (code) throw new Error(code);
      if (waiter.kind === "release") {
        await this.targetAcquirer.releaseJobBoundTarget(30_000, waiter.jobRefHash, waiter.releaseAuthority);
        waiter.complete(); this.active = false; this.activeJobRefHash = null; void this.pump();
      } else await this.serveAcquire(waiter);
    } catch (error) {
      this.active = false; this.activeJobRefHash = null;
      waiter.reject(browserExecutionFailure(error));
      void this.pump();
    }
  }

  private async serveAcquire(waiter: AcquireLaneWaiter): Promise<void> {
    if (waiter.targetMode === "authorized-continuation" && waiter.parentJobId === waiter.binding.jobId) {
      throw new Error("BROWSER_PARENT_JOB_SELF_REFERENCE");
    }
    const parent = waiter.targetMode === "authorized-continuation"
      ? this.infrastructure.mutationState?.readUniqueConfirmedConversationUrl(waiter.parentJobId!,
        waiter.parentAttemptId!, waiter.binding.productStepId) : undefined;
    await this.targetAcquirer.ensureAvailableTarget(waiter, parent);
    const code = waiterExpiryCode(waiter);
    if (code) throw new Error(code);
    const lease = await this.resolveBroker().acquireOperatorClaimedTargetLease(waiter.binding, waiter.ownerId);
    waiter.complete(this.withLifecycle(lease));
  }

  private withLifecycle(lease: BrowserTargetLease): BrowserTargetLease {
    const park: BrowserTargetLease["park"] = async input => {
      try { await lease.park(input); }
      catch (error) { throw browserExecutionFailure(new Error("BROWSER_TARGET_LIFECYCLE_UNSETTLED", { cause: error })); }
      finally { this.active = false; this.activeJobRefHash = null; void this.pump(); }
    };
    return new Proxy(lease, { get(target, property) {
      if (property === "park") return park;
      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    } });
  }
  public notifyProviderObservationTerminal(): void {
    this.observationNotBefore = Date.now() + PROVIDER_OBSERVATION_MIN_INTERVAL_MS
      + Math.floor(Math.random() * PROVIDER_OBSERVATION_RANDOM_SPAN_MS);
  }

  private scheduleWake(): void {
    if (this.wakeTimer) clearTimeout(this.wakeTimer);
    this.wakeTimer = null;
    const now = Date.now();
    let nextAt = Number.POSITIVE_INFINITY;
    for (const waiter of this.queue) {
      if (this.active) {
        if (waiter.kind === "release") nextAt = Math.min(nextAt, waiter.queueDeadlineAt);
        continue;
      }
      const expiry = waiter.kind === "release" ? waiter.queueDeadlineAt : now + Math.max(0, waiter.remainingMs());
      const eligibility = waiter.kind === "acquire" && waiter.requestKind === "provider-observation"
        ? Math.max(waiter.eligibleAt, this.observationNotBefore) : waiter.eligibleAt;
      nextAt = Math.min(nextAt, expiry, eligibility);
    }
    if (!Number.isFinite(nextAt)) return;
    this.wakeTimer = setTimeout(() => { this.wakeTimer = null; void this.pump(); }, Math.max(1, Math.ceil(nextAt - now)));
  }


}
