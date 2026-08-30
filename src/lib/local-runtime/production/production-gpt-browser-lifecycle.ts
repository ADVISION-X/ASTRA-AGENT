import {
  type GptChildCapabilityIntent,
  type GptChildCapabilityProof,
  type GptChildCapabilityResult,
} from "../../../capabilities/gpt/index.js";
import type { BrowserTargetLease } from "../../browser/browser-authority-api.js";
import { requireRuntimeLogWrite, type RuntimeLogger } from "../../runtime-logs/index.js";
import { executionFailure } from "../../typed-failure.js";
import type { WorkbenchBrowserAuthority } from "../workbench-browser-authority-support.js";
import { sha256, type ProductionHash, type WebsiteAgentTask } from "./contracts.js";
import type { ProductionExecutionLease } from "./executor.js";

type BrowserExecutionInput = Readonly<{
  task: WebsiteAgentTask;
  pluginId: string;
  pluginVersion: number;
  lease: ProductionExecutionLease;
}>;

export type ProductionGptBrowserCall = {
  browser: BrowserTargetLease;
  facade: BrowserTargetLease;
  providerWaitLog: Readonly<{ callIdentity: string; emittedAt: number }> | null;
};

const PROVIDER_WAIT_LOG_INTERVAL_MS = 30_000;

const recoveredProof = (input: Readonly<{
  intent: GptChildCapabilityIntent;
  browser: BrowserTargetLease;
  readback: GptChildCapabilityResult | null;
  authorityRef: string;
  state: "confirmed" | "rejected";
}>): GptChildCapabilityProof => {
  const timestamp = new Date().toISOString();
  const unsigned = {
    schemaVersion: "gpt-child-capability-proof.v2" as const,
    childCapabilityId: input.intent.childCapabilityId,
    executionId: input.intent.executionId,
    jobId: input.intent.jobId,
    attemptId: input.intent.attemptId,
    pluginId: input.intent.pluginId,
    pluginVersion: input.intent.pluginVersion,
    productStepId: input.intent.productStepId,
    callId: input.intent.callId,
    inputHash: input.intent.inputHash,
    actionOrdinal: input.intent.actionOrdinal,
    targetRefHash: sha256(input.browser.target.targetRef),
    beforeDocumentRefHash: sha256(input.browser.document.documentRef),
    afterDocumentRefHash: sha256(input.browser.document.documentRef),
    candidateCount: input.readback?.proof.candidateCount ?? null,
    observedSemantics: Object.freeze([
      ...(input.readback?.proof.observedSemantics ?? []),
      `browser-wal-${input.state}`,
    ]),
    committedMutation: "confirmed" as const,
    postconditionResult: input.state === "confirmed" ? "passed" as const : "failed" as const,
    startedAt: input.readback?.proof.startedAt ?? timestamp,
    endedAt: input.readback?.proof.endedAt ?? timestamp,
  };
  const evidenceHash = sha256(JSON.stringify(unsigned));
  return Object.freeze({
    ...unsigned,
    evidenceRef: input.authorityRef,
    evidenceHash,
  });
};

export const recoveredGptChildResult = (input: Readonly<{
  intent: GptChildCapabilityIntent;
  browser: BrowserTargetLease;
  readback: GptChildCapabilityResult | null;
  authorityRef: string;
  state: "confirmed" | "rejected";
}>): GptChildCapabilityResult => Object.freeze({
  status: input.state === "confirmed" ? "success" : "failed",
  value: input.state === "confirmed" ? input.readback?.value ?? null : null,
  proof: recoveredProof(input),
  failureCode: input.state === "confirmed" ? null : "BROWSER_POSTCONDITION_FAILED",
});

export class ProductionGptBrowserLifecycle {
  private readonly browsers = new Map<string, ProductionGptBrowserCall>();

  public constructor(
    private readonly browserAuthority: WorkbenchBrowserAuthority,
    private readonly runtimeLogger: RuntimeLogger,
    private readonly sourceHash: ProductionHash,
    private readonly execution: BrowserExecutionInput,
  ) {}

  public async browserFor(
    sessionKey: string,
    productStepId: string,
    callId: string,
  ): Promise<ProductionGptBrowserCall> {
    if (!sessionKey) throw executionFailure("failed", "GPT_SESSION_KEY_REQUIRED");
    const current = this.browsers.get(sessionKey);
    if (current) return current;
    const browser = await this.acquireBrowserLease(productStepId, callId);
    const active: ProductionGptBrowserCall = {
      browser,
      facade: browser,
      providerWaitLog: null,
    };
    active.facade = new Proxy(browser, {
      get: (_target, property) => {
        const value = Reflect.get(active.browser, property, active.browser) as unknown;
        return typeof value === "function" ? value.bind(active.browser) : value;
      },
    });
    this.browsers.set(sessionKey, active);
    return active;
  }

  public async yieldForProviderWait(
    active: ProductionGptBrowserCall,
    productStepId: string,
    callId: string,
    childCapabilityId: GptChildCapabilityIntent["childCapabilityId"],
    durationMs: number,
  ): Promise<void> {
    if (!Number.isInteger(durationMs) || durationMs < 25 || durationMs > 5_000) {
      throw executionFailure("failed", "GPT_PROVIDER_WAIT_SLICE_INVALID");
    }
    if (active.browser.pendingMutationCount() > 0 || active.browser.requiresMutationRecovery()) {
      throw executionFailure("failed", "BROWSER_NORMAL_PROVIDER_WAIT_WITH_PENDING_MUTATION");
    }
    const callIdentity = `${productStepId}:${callId}:${childCapabilityId}`;
    const emittedAt = performance.now();
    if (active.providerWaitLog?.callIdentity !== callIdentity
      || emittedAt - active.providerWaitLog.emittedAt >= PROVIDER_WAIT_LOG_INTERVAL_MS) {
      requireRuntimeLogWrite(this.runtimeLogger.emitEvent({
        traceId: this.execution.task.job_id,
        owner: "gpt",
        component: "gpt-child",
        operation: "gpt.child",
        code: "GPT_PROVIDER_WAIT_ACTIVE",
        typedIdentity: {
          kind: "gpt-call",
          jobId: this.execution.task.job_id,
          attemptId: this.execution.lease.attempt_id,
          pluginId: this.execution.pluginId,
          pluginVersion: this.execution.pluginVersion,
          stepId: productStepId,
          capabilityCallId: `${callId}:${childCapabilityId}`,
        },
      }));
      active.providerWaitLog = { callIdentity, emittedAt };
    }
    const targetRef = active.browser.target.targetRef;
    await active.browser.park({
      reason: "gpt-normal-provider-wait-yield",
      mode: "normal-provider-wait",
    });
    await this.waitForDelay(durationMs);
    const reacquired = await this.acquireBrowserLease(productStepId, callId);
    if (reacquired.target.targetRef !== targetRef) {
      const mismatch = executionFailure("failed", "BROWSER_RECONCILIATION_IDENTITY_MISMATCH");
      try {
        await reacquired.close({ reason: "gpt-exact-target-reacquire-mismatch" });
      } catch (cleanupError) {
        throw new AggregateError(
          [cleanupError],
          "GPT_BROWSER_LIFECYCLE_FAILED",
          { cause: mismatch },
        );
      }
      throw mismatch;
    }
    active.browser = reacquired;
  }

  public async settle(error: unknown | null): Promise<void> {
    const failures: unknown[] = [];
    for (const [key, call] of this.browsers) {
      try {
        const unresolved = call.browser.pendingMutationCount() > 0
          || call.browser.requiresMutationRecovery();
        if (unresolved) await call.browser.park({
          reason: "gpt-mutation-reconciliation-required",
          mode: "recovery",
        });
        else await call.browser.park({
          reason: error ? "gpt-product-call-failed" : "gpt-product-call-settled",
          mode: "normal-provider-wait",
        });
      } catch (closeError) {
        failures.push(closeError);
      } finally {
        this.browsers.delete(key);
      }
    }
    if (failures.length > 0) throw new AggregateError(failures, "GPT_BROWSER_LIFECYCLE_FAILED");
  }

  private async acquireBrowserLease(
    productStepId: string,
    callId: string,
  ): Promise<BrowserTargetLease> {
    const remaining = Math.floor(this.execution.lease.expires_at_monotonic - performance.now());
    const commandTtlMs = Math.min(this.execution.lease.command_ttl_ms, remaining);
    if (commandTtlMs < 1) throw executionFailure("failed", "V6_DEADLINE_BUDGET_EXHAUSTED");
    const executionRef = [
      this.execution.task.job_id,
      this.execution.lease.attempt_id,
      this.execution.pluginId,
      this.execution.pluginVersion,
      productStepId,
      callId,
    ].join(":");
    return this.browserAuthority.acquireJobBoundTargetLease({
      kind: "production",
      ownerPluginId: this.execution.pluginId,
      pluginVersion: this.execution.pluginVersion,
      jobId: this.execution.task.job_id,
      productStepId,
      attemptId: this.execution.lease.attempt_id,
      deviceId: this.execution.lease.device_id,
      leaseVersion: this.execution.lease.lease_version,
      localOrderId: this.execution.task.job_id,
      contractManifestHash: this.execution.lease.control_manifest_hash,
      executionRef,
      jobRefHash: sha256(this.execution.task.job_id),
      executionRefHash: sha256(executionRef),
      writerLeaseEpoch: this.execution.lease.lease_version,
      writerFenceHash: this.execution.lease.execution_fence_hash,
      candidateHash: this.sourceHash,
      commandTtlMs,
    }, `${this.execution.pluginId}:${this.execution.task.job_id}:${callId}`, {
      signal: this.execution.lease.abort_signal,
      remainingMs: () => Math.floor(
        this.execution.lease.expires_at_monotonic - performance.now(),
      ),
    });
  }

  private async waitForDelay(durationMs: number): Promise<void> {
    const signal = this.execution.lease.abort_signal;
    const remaining = Math.floor(this.execution.lease.expires_at_monotonic - performance.now());
    if (remaining < 1) throw executionFailure("failed", "V6_DEADLINE_BUDGET_EXHAUSTED");
    const delay = Math.min(durationMs, remaining);
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (action: () => void): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
        action();
      };
      const onAbort = () => finish(() => reject(executionFailure("failed", "GPT_RESPONSE_WAIT_ABORTED")));
      const timer = setTimeout(() => finish(resolve), delay);
      signal.addEventListener("abort", onAbort, { once: true });
      if (signal.aborted) onAbort();
    });
    if (delay < durationMs) throw executionFailure("failed", "V6_DEADLINE_BUDGET_EXHAUSTED");
  }
}
