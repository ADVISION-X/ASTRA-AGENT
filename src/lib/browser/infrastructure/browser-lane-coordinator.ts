import { createHash } from "node:crypto";
import type {
  BrowserTargetLease,
  BrowserTargetReleaseAuthority,
  BrowserTargetLeaseWait,
} from "../exact-target/browser-target-lease.js";
import type { BrowserExecutionBinding } from "./browser-authority-broker.js";
import { BrowserAuthorityBroker } from "./browser-authority-broker.js";
import { BrowserAuthorityIssuer } from "./browser-authority-issuer.js";
import type { createBrowserInfrastructureState } from "./browser-infrastructure-state.js";
import { BrowserAuthorityWebSocket } from "../transport/browser-authority-websocket.js";
import { browserExecutionFailure } from "../browser-failure.js";
import type { RuntimeLogger } from "../../runtime-logs/index.js";
import { BrowserTargetAcquirer } from "./browser-target-acquirer.js";
import { awaitBrowserPostSubmitQuiet } from "../exact-target/browser-command-postcondition.js";
import { emitBrowserMutationEvent } from "../exact-target/browser-command-runtime-logging.js";

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
  parentJobId?: string;
  parentAttemptId?: string;
  requestKind: "interaction" | "provider-observation";
}>;
type ReleaseLaneWaiter = LaneWaiterBase & Readonly<{
  kind: "release";
  jobId: string;
  releaseAuthority: BrowserTargetReleaseAuthority;
}>;
type LaneWaiter = AcquireLaneWaiter | ReleaseLaneWaiter;
type LaneState = ReturnType<typeof createBrowserInfrastructureState>;
const PROVIDER_OBSERVATION_MIN_INTERVAL_MS = 70_000;
const PROVIDER_OBSERVATION_RANDOM_SPAN_MS = 20_001;
const waiterExpiryCode = (waiter: LaneWaiter): string | null => waiter.signal.aborted
  ? "BROWSER_WAIT_ABORTED" : waiter.remainingMs() < 1 ? "V6_DEADLINE_BUDGET_EXHAUSTED" : null;

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
    private readonly runtimeLogger: RuntimeLogger,
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
        ...(wait.targetMode === "authorized-continuation"
          ? { parentJobId: wait.parentJobId, parentAttemptId: wait.parentAttemptId } : {}),
        requestKind: wait.targetMode === "fresh" || wait.targetMode === "authorized-continuation"
          ? "interaction" : "provider-observation",
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
    const expiryCode = waiterExpiryCode(waiter);
    const index = this.queue.indexOf(waiter);
    if (!expiryCode || index < 0) return;
    this.queue.splice(index, 1);
    waiter.reject(browserExecutionFailure(new Error(expiryCode)));
    void this.pump();
  }

  public readState(): "idle" | "busy" | "blocked" {
    return this.active ? "busy" : this.hasUnresolvedMutation()
      && !this.infrastructure.mutationState?.allDispatchedTargetsSettled()
      ? "blocked" : "idle";
  }
  public reset(reasonCode?: string): void {
    if (this.wakeTimer) clearTimeout(this.wakeTimer);
    this.wakeTimer = null;
    if (reasonCode) {
      this.rejectPending(reasonCode);
      for (const waiter of this.queue.splice(0)) waiter.reject(browserExecutionFailure(new Error(reasonCode)));
    }
    this.active = false;
    this.activeJobRefHash = null;
    void this.pump();
  }
  public hasUnresolvedMutation(): boolean { return (this.infrastructure.mutationState?.countDispatched() ?? 0) > 0; }
  public hasMutationForJob(jobId: string): boolean { return this.infrastructure.mutationState?.hasMutationForJob(jobId) ?? false; }
  public purgeJob(jobId: string): void {
    this.infrastructure.mutationState?.purgeJob(jobId);
    void this.pump();
  }
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
  public readProviderEffectStepCallFact(input: Readonly<{
    jobId: string; attemptId: string; resultRevision: number; productStepId: string;
    callId: string; childCapabilityId: string;
  }>) {
    return this.infrastructure.mutationState?.readProviderEffectStepCallFact(input) ?? null;
  }

  private mayCrossUnresolved(waiter: LaneWaiter): boolean {
    if (this.infrastructure.mutationState?.allDispatchedTargetsSettled()) return true;
    if (waiter.kind === "release") return waiter.releaseAuthority === "website-admin-deletion"
      || waiter.releaseAuthority === "business-admitted"
      || waiter.releaseAuthority === "wait-new-attempt";
    return waiter.binding.kind === "production"
      && Boolean(this.infrastructure.mutationState?.hasMutationForJob(waiter.binding.jobId, true));
  }

  private nextWaiter(): LaneWaiter | null {
    const mutationBlocked = this.hasUnresolvedMutation();
    const now = Date.now();
    for (let index = 0; index < this.queue.length;) {
      const waiter = this.queue[index]!;
      const expiryCode = waiterExpiryCode(waiter);
      if (expiryCode) {
        this.queue.splice(index, 1);
        waiter.reject(browserExecutionFailure(new Error(expiryCode)));
        continue;
      }
      if (mutationBlocked && !this.mayCrossUnresolved(waiter)) {
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

  private takeNextWaiter(): LaneWaiter | null {
    let waiter: LaneWaiter | null = null;
    try {
      waiter = this.nextWaiter();
      if (waiter) waiter.stopAbortMonitor();
      return waiter;
    } catch (error) {
      if (waiter) waiter.reject(browserExecutionFailure(error));
      this.scheduleWake();
      throw error;
    }
  }

  private async pump(): Promise<void> {
    if (this.active) return;
    if (this.wakeTimer) clearTimeout(this.wakeTimer);
    this.wakeTimer = null;
    const waiter = this.takeNextWaiter();
    if (!waiter) {
      this.scheduleWake();
      return;
    }
    this.active = true;
    this.activeJobRefHash = waiter.jobRefHash;
    try {
      const mutations = this.infrastructure.mutationState;
      if (mutations) {
        await awaitBrowserPostSubmitQuiet(() => mutations.latestProviderInputTerminalAt());
      }
      if (waiter.kind === "release") await this.serveRelease(waiter);
      else await this.serveAcquire(waiter);
    } catch (error) {
      this.active = false;
      this.activeJobRefHash = null;
      void this.pump();
      waiter.reject(browserExecutionFailure(error));
    }
  }

  private async serveRelease(waiter: ReleaseLaneWaiter): Promise<void> {
    await this.targetAcquirer.releaseJobBoundTarget(
      waiter.remainingMs(), waiter.jobId, waiter.jobRefHash,
    );
    waiter.complete();
    this.active = false;
    this.activeJobRefHash = null;
    void this.pump();
  }

  /** Settles the single retired target-local mutation of an older fence before any new acquisition. */
  private settleRetiredMutation(waiter: AcquireLaneWaiter): void {
    const mutations = this.infrastructure.mutationState;
    if (!mutations || !this.hasUnresolvedMutation()) return;
    if (mutations.allDispatchedTargetsSettled()) return;
    const mutation = mutations.settleRetiredTargetLocal(waiter.binding);
    if (mutation.effectScope === "provider_effect" && waiter.targetMode !== "bound-observation") {
      throw browserExecutionFailure(new Error("PROVIDER_EFFECT_OUTCOME_UNPROVEN"), "dispatched", {
        effectScope: "provider_effect", childCapabilityId: mutation.childCapabilityId,
        browserOutcome: "DISPATCHED", providerEffectIdentityHash: mutation.logicalMutationId ?? null });
    }
    if (mutation.effectScope === "target_local") emitBrowserMutationEvent({ runtimeLogger: this.runtimeLogger, mutation, outcome: "REJECTED",
      authorityHash: mutations.authorityHash(mutation.commandId) });
  }

  private continuationParentUrl(waiter: AcquireLaneWaiter): string | undefined {
    if (waiter.targetMode !== "authorized-continuation") return undefined;
    if (waiter.parentJobId === waiter.binding.jobId) throw new Error("BROWSER_PARENT_JOB_SELF_REFERENCE");
    return this.infrastructure.mutationState?.readUniqueConfirmedConversationUrl(
      waiter.parentJobId!, waiter.parentAttemptId!, waiter.binding.productStepId,
    );
  }

  private async serveAcquire(waiter: AcquireLaneWaiter): Promise<void> {
    const assertLive = (): void => {
      const expiryCode = waiterExpiryCode(waiter);
      if (expiryCode) throw new Error(expiryCode);
    };
    assertLive();
    this.settleRetiredMutation(waiter);
    const parentConversationUrl = this.continuationParentUrl(waiter);
    await this.targetAcquirer.ensureAvailableTarget(waiter, parentConversationUrl);
    assertLive();
    const lease = await this.resolveBroker().acquireOperatorClaimedTargetLease(waiter.binding, waiter.ownerId);
    waiter.complete(this.withLifecycle(lease, waiter.requestKind));
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
          this.observationNotBefore = Date.now() + PROVIDER_OBSERVATION_MIN_INTERVAL_MS
            + Math.floor(Math.random() * PROVIDER_OBSERVATION_RANDOM_SPAN_MS);
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
    let nextAt = Number.POSITIVE_INFINITY;
    try {
      const mutationBlocked = this.hasUnresolvedMutation();
      for (const waiter of this.queue) {
        const eligibility = mutationBlocked && !this.mayCrossUnresolved(waiter)
          ? now + Math.max(0, waiter.remainingMs())
          : waiter.kind === "acquire" && waiter.requestKind === "provider-observation"
            ? Math.max(waiter.eligibleAt, this.observationNotBefore)
            : waiter.eligibleAt;
        nextAt = Math.min(nextAt, eligibility, now + Math.max(0, waiter.remainingMs()));
      }
    } catch {
      nextAt = now + PROVIDER_OBSERVATION_MIN_INTERVAL_MS;
    }
    const delay = Number.isFinite(nextAt) ? nextAt - now : PROVIDER_OBSERVATION_MIN_INTERVAL_MS;
    if (this.wakeTimer) clearTimeout(this.wakeTimer);
    this.wakeTimer = setTimeout(() => {
      this.wakeTimer = null;
      void this.pump();
    }, Math.max(1, Math.ceil(delay)));
  }
}
