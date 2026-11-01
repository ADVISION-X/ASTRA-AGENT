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
type AcquireLaneWaiter = LaneWaiterBase & BrowserTargetLeaseWait & Readonly<{
  remainingMs(): number;
  kind: "acquire"; binding: BrowserExecutionBinding; ownerId: string;
}>;
type ReleaseLaneWaiter = LaneWaiterBase & Readonly<{
  kind: "release"; jobId: string; releaseAuthority: BrowserTargetReleaseAuthority; queueDeadlineAt: number;
}>;
type LaneWaiter = AcquireLaneWaiter | ReleaseLaneWaiter;
type LaneState = ReturnType<typeof createBrowserInfrastructureState>;
const waiterExpiryCode = (waiter: LaneWaiter): string | null => waiter.signal.aborted
  ? "BROWSER_WAIT_ABORTED" : (waiter.kind === "release" ? waiter.queueDeadlineAt - Date.now()
    : waiter.remainingMs()) < 1 ? "V6_DEADLINE_BUDGET_EXHAUSTED" : null;

const parentSourceIsExact = (
  source: Extract<BrowserTargetLeaseWait, { targetMode: "authorized-continuation" }>["parentSources"][number], parentJobId: string,
): boolean => !!source && Object.keys(source).sort().join("|") ===
  "callId|childCapabilityId|effectIdentityHash|jobId|productStepId|sourceAttemptId|sourceResultRevision|walAuthorityHash"
  && source.jobId === parentJobId
  && [source.jobId, source.sourceAttemptId, source.productStepId, source.callId].every(value => typeof value === "string" && value.length > 0 && !value.includes("\0"))
  && source.childCapabilityId === "submit_exact_gpt_turn_once"
  && Number.isSafeInteger(source.sourceResultRevision) && source.sourceResultRevision >= 0
  && [source.effectIdentityHash, source.walAuthorityHash].every(value => /^sha256:[a-f0-9]{64}$/u.test(value));

/** One FIFO admission for eligible requests on one physical lane. */
export class BrowserLaneCoordinator {
  private readonly queue: LaneWaiter[] = [];
  private readonly targetAcquirer: BrowserTargetAcquirer;
  private active = false;
  private activeJobRefHash: `sha256:${string}` | null = null;
  private wakeTimer: ReturnType<typeof setTimeout> | null = null;

  public constructor(
    private readonly resolveBroker: () => BrowserAuthorityBroker,
    websocket: BrowserAuthorityWebSocket, issuer: BrowserAuthorityIssuer,
    private readonly infrastructure: LaneState,
  ) { this.targetAcquirer = new BrowserTargetAcquirer(resolveBroker, websocket, issuer, infrastructure); }

  public acquire(binding: BrowserExecutionBinding, ownerId: string, wait: BrowserTargetLeaseWait): Promise<BrowserTargetLease> {
    if (this.queue.length >= 10) return Promise.reject(browserExecutionFailure(new Error("BROWSER_BACKPRESSURE")));
    if (!Number.isFinite(wait.eligibleAt)) return Promise.reject(browserExecutionFailure(new Error("BROWSER_TARGET_INVALID")));
    if (wait.targetMode === "authorized-continuation" && !Array.isArray(wait.parentSources)) {
      return Promise.reject(browserExecutionFailure(new Error("BROWSER_PARENT_IDENTITY_INVALID")));
    }
    if (wait.targetMode !== "authorized-continuation" && ("parentJobId" in wait || "parentSources" in wait)) {
      return Promise.reject(browserExecutionFailure(new Error("BROWSER_PARENT_IDENTITY_INVALID")));
    }
    const selection: BrowserTargetLeaseWait = wait.targetMode === "authorized-continuation"
      ? { ...wait, parentSources: Object.freeze(wait.parentSources.map(source => Object.freeze({ ...source }))) } : wait;
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
        ...selection,
        kind: "acquire", binding, ownerId, jobRefHash: binding.jobRefHash,
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

  private expireQueuedWaiters(): void {
    for (const waiter of [...this.queue]) {
      const code = waiterExpiryCode(waiter);
      if (!code) continue;
      this.queue.splice(this.queue.indexOf(waiter), 1);
      waiter.reject(browserExecutionFailure(new Error(code)));
    }
  }

  private nextWaiter(): LaneWaiter | null {
    this.expireQueuedWaiters();
    const now = Date.now();
    const index = this.queue.findIndex(waiter => waiter.eligibleAt <= now);
    if (index < 0) return null;
    const waiter = this.queue.splice(index, 1)[0]!;
    waiter.stopAbortMonitor();
    return waiter;
  }

  private scheduleWake(): void {
    if (this.wakeTimer) clearTimeout(this.wakeTimer);
    this.wakeTimer = null;
    const now = Date.now();
    let nextAt = Number.POSITIVE_INFINITY;
    for (const waiter of this.queue) {
      const expiresAt = waiter.kind === "release"
        ? waiter.queueDeadlineAt : now + Math.max(0, waiter.remainingMs());
      const wakeAt = this.active ? expiresAt : Math.min(expiresAt, waiter.eligibleAt);
      nextAt = Math.min(nextAt, wakeAt);
    }
    if (!Number.isFinite(nextAt)) return;
    this.wakeTimer = setTimeout(() => {
      this.wakeTimer = null;
      void this.pump();
    }, Math.max(1, Math.ceil(nextAt - now)));
  }

  private async pump(): Promise<void> {
    if (this.active) { this.expireQueuedWaiters(); this.scheduleWake(); return; }
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
    const parent = waiter.targetMode === "authorized-continuation"
      ? this.readParentConversationUrl(waiter) : undefined;
    await this.targetAcquirer.ensureAvailableTarget(waiter, parent);
    const code = waiterExpiryCode(waiter);
    if (code) throw new Error(code);
    const lease = await this.resolveBroker().acquireOperatorClaimedTargetLease(waiter.binding, waiter.ownerId);
    waiter.complete(this.withLifecycle(lease));
  }

  private readParentConversationUrl(
    waiter: Extract<AcquireLaneWaiter, { targetMode: "authorized-continuation" }>,
  ): string {
    if (waiter.parentJobId === waiter.binding.jobId) throw new Error("BROWSER_PARENT_JOB_SELF_REFERENCE");
    if (!waiter.parentJobId || !Array.isArray(waiter.parentSources) || waiter.parentSources.length === 0) {
      throw new Error("BROWSER_PARENT_IDENTITY_INVALID");
    }
    const store = this.infrastructure.mutationState;
    if (!store) throw new Error("BROWSER_PARENT_PROVIDER_EFFECT_MISSING");
    let parentUrl: string | null = null;
    for (const source of waiter.parentSources) {
      if (!parentSourceIsExact(source, waiter.parentJobId)) {
        throw new Error("BROWSER_PARENT_IDENTITY_INVALID");
      }
      const locator = store.readSourceConfirmedProviderEffect(source).conversationLocator;
      if (!locator) throw new Error("BROWSER_PARENT_PROVIDER_EFFECT_INVALID");
      if (parentUrl !== null && parentUrl !== locator.canonicalConversationUrl) {
        throw new Error("BROWSER_PARENT_PROVIDER_EFFECT_AMBIGUOUS");
      }
      parentUrl = locator.canonicalConversationUrl;
    }
    return parentUrl!;
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
}
