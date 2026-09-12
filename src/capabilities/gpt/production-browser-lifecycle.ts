import { createHash } from "node:crypto";

import {
  type GptChildCapabilityId,
  type GptChildBrowserFact,
  type GptHash,
} from "./contract.js";
import type {
  BrowserExecutionBinding,
  BrowserTargetLease,
  BrowserTargetLeaseWait,
} from "../../lib/browser/browser-authority-api.js";
import { requireRuntimeLogWrite, type RuntimeLogger } from "../../lib/runtime-logs/index.js";
import { executionFailure, failureCode, typedExecutionFailure } from "../../lib/execution-failure.js";

type GptBrowserLeaseAuthority = Readonly<{
  acquireJobBoundTargetLease(
    binding: BrowserExecutionBinding,
    ownerId: string,
    wait: BrowserTargetLeaseWait,
  ): Promise<BrowserTargetLease>;
}>;

export type GptBrowserExecutionInput = Readonly<{
  jobId: string;
  attemptId: string;
  resultRevision: number;
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
  confirmedProviderEffect: GptChildBrowserFact | null;
  settledResultPayloadHash: GptHash | null;
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
    expectedTargetRef?: string,
  ): Promise<ProductionGptBrowserCall> {
    if (!sessionKey) throw executionFailure("failed", "GPT_SESSION_KEY_REQUIRED");
    const current = this.browsers.get(sessionKey);
    if (current) return current;
    const browser = await this.acquireBrowserLease(
      productStepId, callId, "general", null, expectedTargetRef,
    );
    const active: ProductionGptBrowserCall = {
      browser,
      facade: browser,
      providerWaitLog: null,
      confirmedProviderEffect: null,
      settledResultPayloadHash: null,
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

  public recordConfirmedProviderEffect(
    active: ProductionGptBrowserCall,
    effect: GptChildBrowserFact,
  ): void {
    for (const call of this.browsers.values()) {
      call.confirmedProviderEffect = null;
      call.settledResultPayloadHash = null;
    }
    active.confirmedProviderEffect = effect;
  }

  public recordSettledResult(active: ProductionGptBrowserCall, payloadHash: GptHash): void {
    if (!active.confirmedProviderEffect) {
      throw executionFailure("failed", "GPT_SETTLED_PROVIDER_EFFECT_MISSING");
    }
    active.settledResultPayloadHash = payloadHash;
  }

  public decorateSettledResultFailure(error: unknown): unknown {
    if (typedExecutionFailure(error)) return error;
    const settled = [...this.browsers.values()].filter((call) =>
      call.confirmedProviderEffect && call.settledResultPayloadHash);
    if (settled.length !== 1) return error;
    const call = settled[0]!;
    const effect = call.confirmedProviderEffect!;
    return executionFailure("failed", "RESULT_SETTLED_UNUSABLE", {
      cause: error,
      metadata: {
        mutationOutcome: "confirmed",
        evidence: { evidenceRef: effect.evidenceRef, evidenceHash: effect.evidenceHash },
        browserEffect: effect,
        settledResultPayloadHash: call.settledResultPayloadHash!,
      },
    });
  }

  public async yieldForProviderProbe(
    active: ProductionGptBrowserCall,
    productStepId: string,
    callId: string,
    childCapabilityId: GptChildCapabilityId,
    canonicalConversationUrl: string,
    probeDeadlineAt: number,
  ): Promise<"reobserve" | "deadline"> {
    if (childCapabilityId !== "checkpoint_gpt_text_response"
      && childCapabilityId !== "checkpoint_gpt_generated_image") {
      throw executionFailure("failed", "GPT_PROVIDER_PROBE_CHILD_INVALID");
    }
    if (!Number.isFinite(probeDeadlineAt)) throw executionFailure("failed", "GPT_PROVIDER_PROBE_DEADLINE_INVALID");
    if (typeof canonicalConversationUrl !== "string" || canonicalConversationUrl.length === 0) {
      throw executionFailure("failed", "GPT_PROVIDER_CONVERSATION_INPUT_INVALID");
    }
    if (Date.now() >= probeDeadlineAt) return "deadline";
    if (active.browser.pendingMutationCount() > 0) {
      throw executionFailure("failed", "BROWSER_NORMAL_PROVIDER_WAIT_WITH_PENDING_MUTATION");
    }
    this.emitProviderWaitLog(active, productStepId, callId, childCapabilityId);
    const targetRef = active.browser.target.targetRef;
    await active.browser.park({
      reason: "gpt-provider-probe-yield",
      mode: "normal-provider-wait",
      startProviderProbeCooldown: true,
    });
    let reacquired: BrowserTargetLease;
    try {
      reacquired = await this.acquireBrowserLease(
        productStepId, callId, "provider-probe", probeDeadlineAt, targetRef,
      );
    } catch (error) {
      this.forgetParkedBrowser(active);
      if (failureCode(error) === "V6_DEADLINE_BUDGET_EXHAUSTED"
        && Date.now() >= probeDeadlineAt) return "deadline";
      throw error;
    }
    if (reacquired.target.targetRef !== targetRef) {
      const mismatch = executionFailure("failed", "BROWSER_RECONCILIATION_IDENTITY_MISMATCH");
      this.forgetParkedBrowser(active);
      try {
        await reacquired.close({ reason: "gpt-exact-target-reacquire-mismatch" });
      } catch (cleanupError) {
        throw new AggregateError([cleanupError], "GPT_BROWSER_LIFECYCLE_FAILED", { cause: mismatch });
      }
      throw mismatch;
    }
    active.browser = reacquired;
    if (this.execution.abortSignal.aborted || Date.now() >= probeDeadlineAt) {
      await active.browser.park({
        reason: "gpt-provider-probe-deadline",
        mode: "normal-provider-wait",
        startProviderProbeCooldown: false,
      });
      this.forgetParkedBrowser(active);
      if (this.execution.abortSignal.aborted) {
        throw executionFailure("failed", "GPT_RESPONSE_WAIT_ABORTED");
      }
      return "deadline";
    }
    await active.browser.executeDomIntent({ kind: "selectExactGptConversation", canonicalConversationUrl });
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
          stepId: productStepId,
          capabilityCallId: `${callId}:${childCapabilityId}`,
        },
      }));
      active.providerWaitLog = { callIdentity, emittedAt };
    }
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
          startProviderProbeCooldown: false,
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
    purpose: BrowserTargetLeaseWait["purpose"],
    probeDeadlineAt: number | null,
    expectedTargetRef?: string,
  ): Promise<BrowserTargetLease> {
    const remainingMs = (): number => Math.min(
      Math.floor(this.execution.expiresAtMonotonic - performance.now()),
      probeDeadlineAt === null ? Number.MAX_SAFE_INTEGER : Math.floor(probeDeadlineAt - Date.now()),
    );
    const currentCommandTtlMs = (): number => {
      const remaining = remainingMs();
      const commandTtlMs = Math.min(this.execution.commandTtlMs, remaining);
      if (commandTtlMs < 1) throw executionFailure("failed", "V6_DEADLINE_BUDGET_EXHAUSTED");
      return commandTtlMs;
    };
    currentCommandTtlMs();
    const executionRef = [
      this.execution.jobId,
      this.execution.attemptId,
      this.execution.resultRevision,
      productStepId,
      callId,
      "fresh",
    ].join(":");
    const binding = {
      kind: "production" as const,
      jobId: this.execution.jobId,
      resultRevision: this.execution.resultRevision,
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
    `${this.execution.jobId}:${callId}`, {
      signal: this.execution.abortSignal,
      remainingMs,
      purpose,
      ...(expectedTargetRef ? { expectedTargetRef } : {}),
    });
  }
}
