import { createHash } from "node:crypto";

import {
  GPT_CHILD_CAPABILITY_CONTRACTS,
  type GptAnyChildCapabilityIntent,
  type GptChildCapabilityId,
  type GptChildCapabilityProof,
  type GptChildCapabilityResult,
  type GptHash,
} from "./contract.js";
import { gptExactCallIdentityHash } from "./contract.js";
import type {
  BrowserAtomicStepRecovery,
  BrowserConfirmedProviderFailureReadbackAuthorization,
  BrowserConfirmedProviderReadbackAuthorization,
  BrowserExecutionBinding,
  BrowserTargetLease,
} from "../../lib/browser/browser-authority-api.js";
import { requireRuntimeLogWrite, type RuntimeLogger } from "../../lib/runtime-logs/index.js";
import { executionFailure } from "../../lib/execution-failure.js";
import {
  dynamicConfirmedFailureReadbackFacade,
  dynamicConfirmedReadbackFacade,
} from "./production-confirmed-readback-facade.js";
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
  controlManifestHash: GptHash;
  expiresAtMonotonic: number;
  commandTtlMs: number;
  abortSignal: AbortSignal;
}>;

const sha256 = (value: string): GptHash =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const confirmedFailureReadbackIdentityHash = (
  authorization: BrowserConfirmedProviderFailureReadbackAuthorization,
): GptHash => sha256(JSON.stringify([
  authorization.schemaVersion,
  authorization.sourceAttemptId,
  authorization.sourceExactCallIdentityHash,
  authorization.sourceActionOrdinal,
  authorization.sourceProductStepId,
  authorization.sourceCallId,
  authorization.sourceChildCapabilityId,
  authorization.sourceTargetRef,
  authorization.sourceDocumentRef,
  authorization.sourceTerminalAt,
  authorization.evidenceRef,
  authorization.evidenceHash,
  authorization.promptHash,
  authorization.turnMarker,
]));

const confirmedReadbackIdentityHash = (
  authorization: BrowserConfirmedProviderReadbackAuthorization,
): GptHash => sha256(JSON.stringify([
  confirmedFailureReadbackIdentityHash({
    ...authorization,
    schemaVersion: "browser-confirmed-provider-failure-readback.v1",
  }),
  authorization.schemaVersion,
  authorization.canonicalConversationUrl,
  authorization.conversationIdentityHash,
]));

export type ProductionGptBrowserCall = {
  browser: BrowserTargetLease;
  facade: BrowserTargetLease;
  providerWaitLog: Readonly<{ callIdentity: string; emittedAt: number }> | null;
};

const PROVIDER_WAIT_LOG_INTERVAL_MS = 30_000;
const recoveredProof = (input: Readonly<{
  intent: GptAnyChildCapabilityIntent;
  browser: BrowserTargetLease;
  readback: GptChildCapabilityResult | null;
  recovery: BrowserAtomicStepRecovery;
  state: "confirmed" | "rejected" | "dispatched";
}>): GptChildCapabilityProof => {
  const timestamp = new Date().toISOString();
  const exactCallIdentityHash = gptExactCallIdentityHash(input.intent);
  const targetRefHash = sha256(input.browser.target.targetRef);
  const documentRefHash = sha256(input.browser.document.documentRef);
  const effectScope = GPT_CHILD_CAPABILITY_CONTRACTS[input.intent.childCapabilityId].replayPolicy
    === "provider-effect-once" ? "provider_effect" as const : "target_local" as const;
  const unsigned = {
    schemaVersion: "gpt-child-capability-proof.v2" as const,
    childCapabilityId: input.intent.childCapabilityId,
    childContractVersion: GPT_CHILD_CAPABILITY_CONTRACTS[input.intent.childCapabilityId].contractVersion,
    childStatus: input.state === "confirmed" ? "success" as const : "failed" as const,
    childReasonCode: input.state === "confirmed" ? "GPT_CHILD_SUCCESS"
      : input.state === "rejected" ? input.recovery.failureCode ?? "BROWSER_POSTCONDITION_FAILED"
        : input.readback?.failureCode ?? "BROWSER_COMMAND_RECEIPT_MISSING",
    exactCallIdentityHash,
    internalDecisionCode: input.state === "confirmed" ? "DONE" as const : "FAIL_CLOSED" as const,
    executionId: input.intent.executionId,
    jobId: input.intent.jobId,
    attemptId: input.intent.attemptId,
    pluginId: input.intent.pluginId,
    pluginVersion: input.intent.pluginVersion,
    productStepId: input.intent.productStepId,
    callId: input.intent.callId,
    inputHash: input.intent.inputHash,
    actionOrdinal: input.intent.actionOrdinal,
    targetRefHash,
    beforeDocumentRefHash: documentRefHash,
    afterDocumentRefHash: documentRefHash,
    authorityRefHashes: Object.freeze([targetRefHash, documentRefHash, input.recovery.authorityHash]),
    factResultIds: Object.freeze([input.recovery.authorityRef]),
    candidateCardinality: input.readback?.proof.candidateCardinality
      ?? Object.freeze({ raw: null, eligible: null }),
    observationRevisionHash: input.readback?.proof.observationRevisionHash ?? null,
    committedMutation: input.recovery.mutationOutcome,
    postconditionResult: input.state === "confirmed" ? "passed" as const
      : input.state === "dispatched" ? "pending" as const : "failed" as const,
    browserFact: Object.freeze({
      exactCallIdentityHash,
      childCapabilityId: input.intent.childCapabilityId,
      effectScope,
      browserOutcome: input.state.toUpperCase() as "DISPATCHED" | "CONFIRMED" | "REJECTED",
      mutationOutcome: input.recovery.mutationOutcome,
      terminalAt: input.recovery.terminalAt,
      evidenceRef: input.recovery.authorityRef,
      evidenceHash: input.recovery.authorityHash,
    }),
    nativeFailureCode: input.state === "rejected"
      ? input.recovery.nativeFailureCode : input.readback?.proof.nativeFailureCode ?? null,
    startedAt: input.readback?.proof.startedAt ?? timestamp,
    endedAt: input.readback?.proof.endedAt ?? timestamp,
  };
  const evidenceHash = sha256(JSON.stringify(unsigned));
  return Object.freeze({
    ...unsigned,
    evidenceRef: input.recovery.authorityRef,
    evidenceHash,
  });
};

export const recoveredGptChildResult = (input: Readonly<{
  intent: GptAnyChildCapabilityIntent;
  browser: BrowserTargetLease;
  readback: GptChildCapabilityResult | null;
  recovery: BrowserAtomicStepRecovery;
  state: "confirmed" | "rejected" | "dispatched";
}>): GptChildCapabilityResult => {
  const proof = recoveredProof(input);
  if (input.state === "confirmed") {
    if (input.readback?.status !== "success") {
      throw executionFailure("failed", "BROWSER_CONFIRMED_READBACK_MISSING");
    }
    return Object.freeze({
      status: "success",
      value: input.readback.value,
      proof,
      failureCode: null,
      failureCause: null,
      failureBrowserEffect: null,
      reasoningRequirementResult: input.readback.reasoningRequirementResult,
    });
  }
  if (input.state === "dispatched" && input.readback?.status !== "failed") {
    throw executionFailure("failed", "BROWSER_DISPATCHED_READBACK_FAILURE_REQUIRED");
  }
  const failureCode = input.state === "dispatched"
    ? input.readback?.failureCode : input.recovery.failureCode;
  if (!failureCode) throw executionFailure("failed", "BROWSER_RECOVERY_FAILURE_CODE_REQUIRED");
  return Object.freeze({
    status: "failed",
    value: null,
    proof,
    failureCode,
    failureCause: input.state === "dispatched"
      ? input.readback!.failureCause
      : Object.freeze({ name: "Error", code: input.recovery.nativeFailureCode }),
    failureBrowserEffect: Object.freeze({
      effectScope: GPT_CHILD_CAPABILITY_CONTRACTS[input.intent.childCapabilityId].replayPolicy === "provider-effect-once"
        ? "provider_effect" as const
        : "target_local" as const,
      childCapabilityId: input.intent.childCapabilityId,
      browserOutcome: input.state === "dispatched" ? "DISPATCHED" as const : "REJECTED" as const,
    }),
    reasoningRequirementResult: input.readback?.reasoningRequirementResult ?? null,
  });
};

export class ProductionGptBrowserLifecycle {
  private readonly browsers = new Map<string, ProductionGptBrowserCall>();
  private confirmedProviderFailureReadback: BrowserConfirmedProviderFailureReadbackAuthorization | null = null;
  private confirmedProviderReadback: BrowserConfirmedProviderReadbackAuthorization | null = null;

  public constructor(
    private readonly browserAuthority: GptBrowserLeaseAuthority,
    private readonly runtimeLogger: RuntimeLogger,
    private readonly sourceHash: GptHash,
    private readonly execution: GptBrowserExecutionInput,
  ) {}

  public authorizeConfirmedProviderFailureReadback(
    authorization: BrowserConfirmedProviderFailureReadbackAuthorization,
  ): void {
    const existing = this.confirmedProviderFailureReadback;
    if (existing && confirmedFailureReadbackIdentityHash(existing)
      !== confirmedFailureReadbackIdentityHash(authorization)) {
      throw executionFailure("failed", "BROWSER_RECONCILIATION_SCOPE_INVALID");
    }
    for (const active of this.browsers.values()) {
      if (active.browser.target.targetRef !== authorization.sourceTargetRef
        || active.browser.document.documentRef !== authorization.sourceDocumentRef) {
        throw executionFailure("failed", "BROWSER_RECONCILIATION_SCOPE_INVALID");
      }
    }
    for (const active of this.browsers.values()) {
      active.facade = dynamicConfirmedFailureReadbackFacade(() => active.browser);
    }
    this.confirmedProviderFailureReadback = Object.freeze({ ...authorization });
  }

  public authorizeConfirmedProviderReadback(
    authorization: BrowserConfirmedProviderReadbackAuthorization,
  ): void {
    const pending = this.confirmedProviderFailureReadback;
    if (pending) {
      const source = Object.freeze({
        schemaVersion: "browser-confirmed-provider-failure-readback.v1" as const,
        sourceAttemptId: authorization.sourceAttemptId,
        sourceExactCallIdentityHash: authorization.sourceExactCallIdentityHash,
        sourceActionOrdinal: authorization.sourceActionOrdinal,
        sourceProductStepId: authorization.sourceProductStepId,
        sourceCallId: authorization.sourceCallId,
        sourceChildCapabilityId: authorization.sourceChildCapabilityId,
        sourceTargetRef: authorization.sourceTargetRef,
        sourceDocumentRef: authorization.sourceDocumentRef,
        sourceTerminalAt: authorization.sourceTerminalAt,
        evidenceRef: authorization.evidenceRef,
        evidenceHash: authorization.evidenceHash,
        promptHash: authorization.promptHash,
        turnMarker: authorization.turnMarker,
      });
      if (confirmedFailureReadbackIdentityHash(pending)
        !== confirmedFailureReadbackIdentityHash(source)) {
        throw executionFailure("failed", "BROWSER_RECONCILIATION_SCOPE_INVALID");
      }
    }
    const existing = this.confirmedProviderReadback;
    if (existing && confirmedReadbackIdentityHash(existing)
      !== confirmedReadbackIdentityHash(authorization)) {
      throw executionFailure("failed", "BROWSER_RECONCILIATION_SCOPE_INVALID");
    }
    this.confirmedProviderReadback = Object.freeze({ ...authorization });
    for (const active of this.browsers.values()) {
      active.facade = dynamicConfirmedReadbackFacade(() => active.browser, authorization);
    }
  }

  public async browserFor(
    sessionKey: string,
    productStepId: string,
    callId: string,
  ): Promise<ProductionGptBrowserCall> {
    if (!sessionKey) throw executionFailure("failed", "GPT_SESSION_KEY_REQUIRED");
    const readbackSource = this.confirmedProviderReadback ?? this.confirmedProviderFailureReadback;
    if (readbackSource && readbackSource.sourceProductStepId !== productStepId) {
      for (const [key, active] of this.browsers) {
        await active.browser.park({
          reason: "gpt-confirmed-provider-readback-complete",
          mode: "normal-provider-wait",
        });
        this.browsers.delete(key);
      }
      this.confirmedProviderFailureReadback = null;
      this.confirmedProviderReadback = null;
    }
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
    if (active.browser.pendingMutationCount() > 0 || active.browser.requiresMutationRecovery()) {
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
    absoluteDeadline: number,
  ): Promise<"navigated" | "reobserve" | "deadline"> {
    if (childCapabilityId !== "wait_for_stable_gpt_text"
      && childCapabilityId !== "wait_for_stable_gpt_image") {
      throw executionFailure("failed", "GPT_CROSS_CONVERSATION_POLL_CHILD_INVALID");
    }
    if (typeof canonicalConversationUrl !== "string" || canonicalConversationUrl.length === 0
      || !Number.isFinite(absoluteDeadline)) {
      throw executionFailure("failed", "GPT_CROSS_CONVERSATION_POLL_WAIT_INVALID");
    }
    if (this.execution.abortSignal.aborted) {
      throw executionFailure("failed", "GPT_RESPONSE_WAIT_ABORTED");
    }
    if (active.browser.pendingMutationCount() > 0 || active.browser.requiresMutationRecovery()) {
      throw executionFailure("failed", "BROWSER_NORMAL_PROVIDER_WAIT_WITH_PENDING_MUTATION");
    }
    const remaining = Math.floor(absoluteDeadline - Date.now());
    if (remaining < 25 || remaining > 3_600_000) return "deadline";
    const eligibility = productionGptCrossConversationPollCadence.reserve(performance.now());
    if (eligibility.kind === "reserved") {
      if (this.execution.abortSignal.aborted) {
        throw executionFailure("failed", "GPT_RESPONSE_WAIT_ABORTED");
      }
      if (Date.now() >= absoluteDeadline) return "deadline";
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
    const callIdentity = `${productStepId}:${callId}:${childCapabilityId}`;
    const emittedAt = performance.now();
    if (active.providerWaitLog?.callIdentity !== callIdentity
      || emittedAt - active.providerWaitLog.emittedAt >= PROVIDER_WAIT_LOG_INTERVAL_MS) {
      requireRuntimeLogWrite(this.runtimeLogger.emitEvent({
        traceId: this.execution.jobId,
        owner: "gpt",
        component: "gpt-child",
        operation: "gpt.child",
        code: "GPT_PROVIDER_WAIT_ACTIVE",
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
    const currentCommandTtlMs = (): number => {
      const remaining = Math.floor(this.execution.expiresAtMonotonic - performance.now());
      const commandTtlMs = Math.min(this.execution.commandTtlMs, remaining);
      if (commandTtlMs < 1) throw executionFailure("failed", "V6_DEADLINE_BUDGET_EXHAUSTED");
      return commandTtlMs;
    };
    currentCommandTtlMs();
    const confirmedProviderReadback = this.confirmedProviderReadback;
    const confirmedProviderFailureReadback = this.confirmedProviderFailureReadback;
    const executionRef = [
      this.execution.jobId,
      this.execution.attemptId,
      this.execution.pluginId,
      this.execution.pluginVersion,
      productStepId,
      callId,
      confirmedProviderReadback?.sourceExactCallIdentityHash
        ?? confirmedProviderFailureReadback?.sourceExactCallIdentityHash ?? "normal",
    ].join(":");
    const binding = {
      ...(confirmedProviderReadback ? {
        kind: "production-reconciliation" as const,
        confirmedProviderReadback,
      } : confirmedProviderFailureReadback ? {
        kind: "production-confirmed-failure-readback" as const,
        confirmedProviderFailureReadback,
      } : { kind: "production" as const }),
      ownerPluginId: this.execution.pluginId,
      pluginVersion: this.execution.pluginVersion,
      jobId: this.execution.jobId,
      productStepId,
      callId,
      attemptId: this.execution.attemptId,
      deviceId: this.execution.deviceId,
      leaseVersion: this.execution.leaseVersion,
      localOrderId: this.execution.jobId,
      contractManifestHash: this.execution.controlManifestHash,
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
