import { createHash } from "node:crypto";

import {
  type GptChildCapabilityId,
  type GptChildBrowserFact,
  type GptHash,
} from "./contract.js";
import type {
  BrowserAtomicStepIdentity,
  BrowserExecutionBinding,
  BrowserTargetLease,
  BrowserTargetLeaseWait,
} from "../../lib/browser/browser-authority-api.js";
import { requireRuntimeLogWrite, type RuntimeLogger } from "../../lib/runtime-logs/index.js";
import { executionFailure, typedExecutionFailure } from "../../lib/execution-failure.js";

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
  confirmedProviderEffect: (GptChildBrowserFact & Readonly<{
    submitIdentity: BrowserAtomicStepIdentity;
    canonicalConversationUrl: string;
    userTurnId: string;
  }>) | null;
  settledResultPayloadHash: GptHash | null;
  recoverySelectionRequired: boolean;
};

export const PROVIDER_OBSERVATION_INTERVAL_MS = 30_000;

const assertConfirmedProviderReadback = (active: ProductionGptBrowserCall): void => {
  const confirmed = active.confirmedProviderEffect;
  const prior = confirmed ? active.browser.readAtomicStepOutcome(confirmed.submitIdentity) : null;
  const payload = prior?.terminalPayload;
  const record = payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Readonly<Record<string, unknown>> : null;
  const identityMatches = prior?.providerEffectIdentityHash === confirmed?.providerEffectIdentityHash
    && prior?.mutationOutcome === confirmed?.mutationOutcome;
  const payloadMatches = record?.canonicalConversationUrl === confirmed?.canonicalConversationUrl
    && record?.userTurnId === confirmed?.userTurnId;
  if (!confirmed || prior?.state !== "confirmed" || !identityMatches || !payloadMatches) {
    throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_READBACK_INVALID");
  }
};

export class ProductionGptBrowserLifecycle {
  private activeBrowser: Readonly<{ sessionKey: string; call: ProductionGptBrowserCall }> | null = null;

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
    targetMode: BrowserTargetLeaseWait["targetMode"] = "fresh",
  ): Promise<ProductionGptBrowserCall> {
    if (!sessionKey) throw executionFailure("failed", "GPT_SESSION_KEY_REQUIRED");
    if (this.activeBrowser?.sessionKey === sessionKey) return this.activeBrowser.call;
    const previous = this.activeBrowser?.call;
    if (previous) {
      if (!previous.confirmedProviderEffect || !previous.settledResultPayloadHash) {
        throw executionFailure("failed", "GPT_BROWSER_SESSION_TRANSITION_UNSETTLED");
      }
      await this.parkActive("gpt-provider-turn-settled");
    }
    const browser = await this.acquireBrowserLease(productStepId, callId, null, targetMode);
    const active: ProductionGptBrowserCall = {
      browser,
      facade: browser,
      providerWaitLog: null,
      confirmedProviderEffect: null,
      settledResultPayloadHash: null,
      recoverySelectionRequired: targetMode === "confirmed-readback",
    };
    active.facade = new Proxy(browser, {
      get: (_target, property) => {
        const value = Reflect.get(active.browser, property, active.browser) as unknown;
        return typeof value === "function" ? value.bind(active.browser) : value;
      },
    });
    this.activeBrowser = Object.freeze({ sessionKey, call: active });
    return active;
  }

  public async recordConfirmedProviderEffect(
    active: ProductionGptBrowserCall,
    effect: GptChildBrowserFact,
    submitIdentity: BrowserAtomicStepIdentity,
    canonicalConversationUrl: string,
    userTurnId: string,
  ): Promise<void> {
    active.confirmedProviderEffect = Object.freeze({ ...effect, submitIdentity,
      canonicalConversationUrl, userTurnId });
    if (active.recoverySelectionRequired) {
      await active.browser.executeDomIntent({
        kind: "selectExactGptConversation", canonicalConversationUrl,
      });
      active.recoverySelectionRequired = false;
    }
  }

  public recordSettledResult(active: ProductionGptBrowserCall, payloadHash: GptHash): void {
    if (!active.confirmedProviderEffect) {
      throw executionFailure("failed", "GPT_SETTLED_PROVIDER_EFFECT_MISSING");
    }
    active.settledResultPayloadHash = payloadHash;
  }

  public decorateSettledResultFailure(error: unknown): unknown {
    const typed = typedExecutionFailure(error);
    if (typed?.code === "RESULT_SETTLED_UNUSABLE") return error;
    const call = this.activeBrowser?.call;
    if (!call?.confirmedProviderEffect || !call.settledResultPayloadHash) return error;
    const effect = call.confirmedProviderEffect!;
    return executionFailure("failed", "RESULT_SETTLED_UNUSABLE", {
      cause: typed ? new Error(typed.code) : error,
      metadata: {
        mutationOutcome: "confirmed",
        evidence: { evidenceRef: effect.evidenceRef, evidenceHash: effect.evidenceHash },
        browserEffect: effect,
        settledResultPayloadHash: call.settledResultPayloadHash!,
      },
    });
  }

  public async waitForProviderObservation(
    active: ProductionGptBrowserCall,
    productStepId: string,
    callId: string,
    childCapabilityId: GptChildCapabilityId,
    observationDeadlineAt: number,
  ): Promise<"reobserve" | "deadline"> {
    if (childCapabilityId !== "checkpoint_gpt_text_response"
      && childCapabilityId !== "checkpoint_gpt_generated_image") {
      throw executionFailure("failed", "GPT_PROVIDER_PROBE_CHILD_INVALID");
    }
    if (!Number.isFinite(observationDeadlineAt)) throw executionFailure("failed", "GPT_PROVIDER_OBSERVATION_DEADLINE_INVALID");
    if (Date.now() >= observationDeadlineAt) return "deadline";
    if (active.browser.pendingMutationCount() > 0) {
      throw executionFailure("failed", "BROWSER_NORMAL_PROVIDER_WAIT_WITH_PENDING_MUTATION");
    }
    assertConfirmedProviderReadback(active);
    this.emitProviderWaitLog(active, productStepId, callId, childCapabilityId);
    const providerRemaining = Math.floor(observationDeadlineAt - Date.now());
    const executionRemaining = Math.floor(
      this.execution.expiresAtMonotonic - performance.now(),
    );
    if (executionRemaining < 1) {
      throw executionFailure("failed", "V6_DEADLINE_BUDGET_EXHAUSTED");
    }
    const waitMs = Math.min(
      PROVIDER_OBSERVATION_INTERVAL_MS, providerRemaining, executionRemaining,
    );
    await new Promise<void>((resolve, reject) => {
      const aborted = () => {
        clearTimeout(timer);
        reject(executionFailure("failed", "GPT_RESPONSE_WAIT_ABORTED"));
      };
      const timer = setTimeout(() => {
        this.execution.abortSignal.removeEventListener("abort", aborted);
        resolve();
      }, waitMs);
      this.execution.abortSignal.addEventListener("abort", aborted, { once: true });
      if (this.execution.abortSignal.aborted) aborted();
    });
    if (providerRemaining <= waitMs && providerRemaining <= executionRemaining) return "deadline";
    if (executionRemaining <= waitMs) {
      throw executionFailure("failed", "V6_DEADLINE_BUDGET_EXHAUSTED");
    }
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
      || emittedAt - active.providerWaitLog.emittedAt >= PROVIDER_OBSERVATION_INTERVAL_MS) {
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

  public async settle(error: unknown | null): Promise<void> {
    try {
      await this.parkActive(error ? "gpt-product-call-failed" : "gpt-product-call-settled");
    } catch (parkError) {
      throw new AggregateError([parkError], "GPT_BROWSER_LIFECYCLE_FAILED");
    }
  }

  private async parkActive(reason: string): Promise<void> {
    const active = this.activeBrowser?.call;
    if (!active) return;
    if (active.browser.pendingMutationCount() > 0) throw new Error("BROWSER_MUTATION_UNSETTLED");
    await active.browser.park({ reason, mode: "product-call-settlement" });
    this.activeBrowser = null;
  }

  private async acquireBrowserLease(
    productStepId: string,
    callId: string,
    probeDeadlineAt: number | null,
    targetMode: BrowserTargetLeaseWait["targetMode"],
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
      targetMode,
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
      targetMode,
    });
  }
}
