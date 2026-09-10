import { createHash } from "node:crypto";

import {
  type GptChildCapabilityId,
  type GptHash,
} from "./contract.js";
import type {
  BrowserExecutionBinding,
  BrowserTargetLease,
} from "../../lib/browser/browser-authority-api.js";
import { requireRuntimeLogWrite, type RuntimeLogger } from "../../lib/runtime-logs/index.js";
import { executionFailure } from "../../lib/execution-failure.js";
import { productionGptCrossConversationPollCadence } from "./provider-wait-cross-conversation-cadence.js";

type GptBrowserLeaseAuthority = Readonly<{
  acquireJobBoundTargetLease(
    binding: BrowserExecutionBinding,
    ownerId: string,
    wait: Readonly<{ signal: AbortSignal; remainingMs(): number }>,
  ): Promise<BrowserTargetLease>;
}>;

export type GptBrowserExecutionInput = Readonly<{
  jobId: string;
  attemptId: string;
  pluginId: string;
  pluginVersion: number;
  deviceId: string;
  leaseVersion: number;
  executionFenceHash: GptHash;
  capabilityManifestHash: GptHash;
  expiresAtMonotonic: number;
  commandTtlMs: number;
  abortSignal: AbortSignal;
}>;

const sha256 = (value: string): GptHash =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

export type ProductionGptBrowserCall = {
  browser: BrowserTargetLease;
  facade: BrowserTargetLease;
  providerWaitLog: Readonly<{ callIdentity: string; emittedAt: number }> | null;
};

const PROVIDER_WAIT_LOG_INTERVAL_MS = 30_000;

export class ProductionGptBrowserLifecycle {
  private readonly browsers = new Map<string, ProductionGptBrowserCall>();

  public constructor(
    private readonly browserAuthority: GptBrowserLeaseAuthority,
    private readonly runtimeLogger: RuntimeLogger,
    private readonly sourceHash: GptHash,
    private readonly execution: GptBrowserExecutionInput,
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
    childCapabilityId: GptChildCapabilityId,
    durationMs: number,
  ): Promise<void> {
    if (!Number.isInteger(durationMs) || durationMs < 25 || durationMs > 5_000) {
      throw executionFailure("failed", "GPT_PROVIDER_WAIT_SLICE_INVALID");
    }
    if (active.browser.pendingMutationCount() > 0) {
      throw executionFailure("failed", "BROWSER_NORMAL_PROVIDER_WAIT_WITH_PENDING_MUTATION");
    }
    this.emitProviderWaitLog(active, productStepId, callId, childCapabilityId);
    await this.yieldAndReacquire(
      active, productStepId, callId, durationMs, "gpt-normal-provider-wait-yield",
    );
  }

  public async navigateCrossConversationPoll(
    active: ProductionGptBrowserCall,
    productStepId: string,
    callId: string,
    childCapabilityId: GptChildCapabilityId,
    canonicalConversationUrl: string,
    probeDeadlineAt: number,
  ): Promise<"navigated" | "reobserve" | "deadline"> {
    if (childCapabilityId !== "checkpoint_gpt_text_response"
      && childCapabilityId !== "checkpoint_gpt_generated_image") {
      throw executionFailure("failed", "GPT_CROSS_CONVERSATION_POLL_CHILD_INVALID");
    }
    if (typeof canonicalConversationUrl !== "string" || canonicalConversationUrl.length === 0
      || !Number.isFinite(probeDeadlineAt)) {
      throw executionFailure("failed", "GPT_CROSS_CONVERSATION_POLL_WAIT_INVALID");
    }
    if (this.execution.abortSignal.aborted) {
      throw executionFailure("failed", "GPT_RESPONSE_WAIT_ABORTED");
    }
    if (active.browser.pendingMutationCount() > 0) {
      throw executionFailure("failed", "BROWSER_NORMAL_PROVIDER_WAIT_WITH_PENDING_MUTATION");
    }
    const remaining = Math.floor(probeDeadlineAt - Date.now());
    if (remaining < 25 || remaining > 3_600_000) return "deadline";
    const eligibility = productionGptCrossConversationPollCadence.reserve(performance.now());
    if (eligibility.kind === "reserved") {
      if (this.execution.abortSignal.aborted) {
        throw executionFailure("failed", "GPT_RESPONSE_WAIT_ABORTED");
      }
      if (Date.now() >= probeDeadlineAt) return "deadline";
      const navigation = (() => {
        try {
          return active.browser.navigate({
            url: canonicalConversationUrl,
            title: "poll exact GPT conversation",
          });
        } finally {
          productionGptCrossConversationPollCadence.bindDispatch(performance.now());
        }
      })();
      await navigation;
      return "navigated";
    }
    this.emitProviderWaitLog(active, productStepId, callId, childCapabilityId);
    if (eligibility.durationMs >= remaining) {
      await this.parkUntilProviderDeadline(
        active, remaining, "gpt-cross-conversation-poll-wait",
      );
      return "deadline";
    }
    await this.yieldAndReacquire(
      active,
      productStepId,
      callId,
      eligibility.durationMs,
      "gpt-cross-conversation-poll-wait",
    );
    return "reobserve";
  }

  private emitProviderWaitLog(
    active: ProductionGptBrowserCall,
    productStepId: string,
    callId: string,
    childCapabilityId: GptChildCapabilityId,
  ): void {
    this.emitWaitLog(active, productStepId, callId, childCapabilityId, "GPT_PROVIDER_WAIT_ACTIVE");
  }

  private emitWaitLog(
    active: ProductionGptBrowserCall,
    productStepId: string,
    callId: string,
    childCapabilityId: GptChildCapabilityId,
    code: "GPT_PROVIDER_WAIT_ACTIVE",
  ): void {
    const callIdentity = `${productStepId}:${callId}:${childCapabilityId}`;
    const emittedAt = performance.now();
    if (active.providerWaitLog?.callIdentity !== callIdentity
      || emittedAt - active.providerWaitLog.emittedAt >= PROVIDER_WAIT_LOG_INTERVAL_MS) {
      requireRuntimeLogWrite(this.runtimeLogger.emitEvent({
        traceId: this.execution.jobId,
        owner: "gpt",
        component: "gpt-child",
        operation: "gpt.child",
        code,
        typedIdentity: {
          kind: "gpt-call",
          jobId: this.execution.jobId,
          attemptId: this.execution.attemptId,
          pluginId: this.execution.pluginId,
          pluginVersion: this.execution.pluginVersion,
          stepId: productStepId,
          capabilityCallId: `${callId}:${childCapabilityId}`,
        },
      }));
      active.providerWaitLog = { callIdentity, emittedAt };
    }
  }

  private async yieldAndReacquire(
    active: ProductionGptBrowserCall,
    productStepId: string,
    callId: string,
    durationMs: number,
    reason: "gpt-normal-provider-wait-yield" | "gpt-cross-conversation-poll-wait",
  ): Promise<void> {
    const targetRef = active.browser.target.targetRef;
    await active.browser.park({
      reason,
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

  private async parkUntilProviderDeadline(
    active: ProductionGptBrowserCall,
    durationMs: number,
    reason: "gpt-cross-conversation-poll-wait",
  ): Promise<void> {
    await active.browser.park({ reason, mode: "normal-provider-wait" });
    this.forgetParkedBrowser(active);
    await this.waitForDelay(durationMs);
  }

  private forgetParkedBrowser(active: ProductionGptBrowserCall): void {
    for (const [sessionKey, candidate] of this.browsers) {
      if (candidate !== active) continue;
      this.browsers.delete(sessionKey);
      return;
    }
    throw executionFailure("failed", "GPT_PARKED_BROWSER_CALL_MISSING");
  }

  public async settle(error: unknown | null): Promise<void> {
    const failures: unknown[] = [];
    for (const [key, call] of this.browsers) {
      try {
        await call.browser.park({
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
    const currentCommandTtlMs = (): number => {
      const remaining = Math.floor(this.execution.expiresAtMonotonic - performance.now());
      const commandTtlMs = Math.min(this.execution.commandTtlMs, remaining);
      if (commandTtlMs < 1) throw executionFailure("failed", "V6_DEADLINE_BUDGET_EXHAUSTED");
      return commandTtlMs;
    };
    currentCommandTtlMs();
    const executionRef = [
      this.execution.jobId,
      this.execution.attemptId,
      this.execution.pluginId,
      this.execution.pluginVersion,
      productStepId,
      callId,
      "fresh",
    ].join(":");
    const binding = {
      kind: "production" as const,
      ownerPluginId: this.execution.pluginId,
      pluginVersion: this.execution.pluginVersion,
      jobId: this.execution.jobId,
      productStepId,
      callId,
      attemptId: this.execution.attemptId,
      deviceId: this.execution.deviceId,
      leaseVersion: this.execution.leaseVersion,
      localOrderId: this.execution.jobId,
      contractManifestHash: this.execution.capabilityManifestHash,
      executionRef,
      jobRefHash: sha256(this.execution.jobId),
      executionRefHash: sha256(executionRef),
      writerLeaseEpoch: this.execution.leaseVersion,
      writerFenceHash: this.execution.executionFenceHash,
      candidateHash: this.sourceHash,
      get commandTtlMs() { return currentCommandTtlMs(); },
    };
    return this.browserAuthority.acquireJobBoundTargetLease(binding,
    `${this.execution.pluginId}:${this.execution.jobId}:${callId}`, {
      signal: this.execution.abortSignal,
      remainingMs: () => Math.floor(
        this.execution.expiresAtMonotonic - performance.now(),
      ),
    });
  }

  private async waitForDelay(durationMs: number): Promise<void> {
    const signal = this.execution.abortSignal;
    const remaining = Math.floor(this.execution.expiresAtMonotonic - performance.now());
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
