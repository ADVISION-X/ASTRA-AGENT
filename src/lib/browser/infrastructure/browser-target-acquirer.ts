import type { BrowserExecutionBinding } from "./browser-authority-broker.js";
import { BrowserAuthorityBroker } from "./browser-authority-broker.js";
import { BrowserAuthorityIssuer } from "./browser-authority-issuer.js";
import type { createBrowserInfrastructureState } from "./browser-infrastructure-state.js";
import { BrowserAuthorityWebSocket } from "../transport/browser-authority-websocket.js";
import { BROWSER_COMMAND_DEFAULT_DEADLINE_MS } from "../protocol/generated/browser-protocol.generated.js";

type ReconciliationBinding = Extract<BrowserExecutionBinding, { kind: "production-reconciliation" }>;
type TargetRecovery = Readonly<{
  state: "DISPATCHED" | "CONFIRMED" | "REJECTED";
  effectScope: "target_local" | "provider_effect";
  targetRef: string;
}>;
type TargetWaiter = Readonly<{
  binding: BrowserExecutionBinding;
  remainingMs(): number;
}>;
type LaneState = ReturnType<typeof createBrowserInfrastructureState>;

export type BrowserTargetAcquisition = Readonly<{
  replacementBinding: ReconciliationBinding | null;
  confirmedProviderTargetReplaced: boolean;
}>;

const replacementKey = (binding: ReconciliationBinding): string => [
  binding.jobId,
  binding.confirmedProviderReadback.sourceAttemptId,
  binding.confirmedProviderReadback.sourceExactCallIdentityHash,
  binding.confirmedProviderReadback.evidenceHash,
].join(":");

export class BrowserTargetAcquirer {
  private readonly confirmedReadbackReplacementTargets = new Map<string, string>();

  public constructor(
    private readonly resolveBroker: () => BrowserAuthorityBroker,
    private readonly websocket: BrowserAuthorityWebSocket,
    private readonly issuer: BrowserAuthorityIssuer,
    private readonly infrastructure: LaneState,
  ) {}

  public reset(): void { this.confirmedReadbackReplacementTargets.clear(); }

  public async ensureAvailableTarget(
    waiter: TargetWaiter,
    recovery: TargetRecovery | null,
    rejectLostTargetLocalDocument: () => never,
  ): Promise<BrowserTargetAcquisition> {
    const replacementBinding = waiter.binding.kind === "production-reconciliation" ? waiter.binding : null;
    if (this.resolveBroker().currentOperatorTargetStatus() !== "absent") {
      return { replacementBinding, confirmedProviderTargetReplaced: false };
    }
    const knownTarget = replacementBinding
      ? this.confirmedReadbackReplacementTargets.get(replacementKey(replacementBinding)) ?? null : null;
    const ttl = Math.min(waiter.binding.commandTtlMs, waiter.remainingMs());
    try {
      await this.acquireJobBoundTarget(ttl, knownTarget ?? recovery?.targetRef ?? null);
      return { replacementBinding, confirmedProviderTargetReplaced: false };
    } catch (error) {
      const targetAbsent = error instanceof Error
        && error.message === "BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT";
      if (recovery?.state === "DISPATCHED" && recovery.effectScope === "target_local" && targetAbsent) {
        rejectLostTargetLocalDocument();
      }
      const replaceable = replacementBinding && recovery?.state === "CONFIRMED"
        && recovery.effectScope === "provider_effect" && targetAbsent;
      if (!replaceable) throw error;
      await this.acquireJobBoundTarget(Math.min(waiter.binding.commandTtlMs, waiter.remainingMs()), null);
      return { replacementBinding, confirmedProviderTargetReplaced: true };
    }
  }

  public recordReplacementTarget(
    binding: ReconciliationBinding,
    targetRef: string,
    replaced: boolean,
  ): string {
    const key = replacementKey(binding);
    const known = this.confirmedReadbackReplacementTargets.get(key);
    if (!replaced && known !== targetRef) throw new Error("BROWSER_DOCUMENT_INVALID");
    if (this.confirmedReadbackReplacementTargets.size >= 100 && !known) {
      const oldest = this.confirmedReadbackReplacementTargets.keys().next().value as string | undefined;
      if (oldest) this.confirmedReadbackReplacementTargets.delete(oldest);
    }
    this.confirmedReadbackReplacementTargets.set(key, targetRef);
    return key;
  }

  public clearReplacementTarget(key: string): void {
    this.confirmedReadbackReplacementTargets.delete(key);
  }

  private async acquireJobBoundTarget(commandTtlMs: number, targetRef: string | null): Promise<void> {
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
        authorityEpoch: current.authority.authorityEpoch, expectedTargetRef: targetRef, resolve, reject, timeout,
      };
      try { this.websocket.requestPreauthorizedTargetAcquisition(targetRef ?? undefined); }
      catch (error) {
        this.rejectPending(error instanceof Error ? error.message : "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
      }
    });
  }

  public resolvePending(targetRef: string): void {
    const pending = this.infrastructure.pendingJobBoundTargetAcquisition;
    if (!pending) return;
    if (pending.expectedTargetRef !== null && pending.expectedTargetRef !== targetRef) {
      this.rejectPending("BROWSER_RECONCILIATION_IDENTITY_MISMATCH");
      return;
    }
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
