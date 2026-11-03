import { createHash } from "node:crypto";

import {
  type GptChildCapabilityId,
  type GptChildBrowserFact,
  type GptHash,
  type GptProviderObservationWaitReason,
} from "./contract.js";
import type {
  BrowserAtomicStepIdentity,
  BrowserExecutionBinding,
  BrowserTargetLease,
  BrowserTargetLeaseWait,
} from "../../lib/browser/browser-authority-api.js";
import { assertBrowserAtomicStepIdentity, browserExactCallIdentityHash } from "../../lib/browser/browser-authority-api.js";
import { requireRuntimeLogWrite, type RuntimeLogger } from "../../lib/runtime-logs/index.js";
import { executionFailure, failureCode } from "../../lib/execution-failure.js";
import type { GptProductionBrowserAuthority, GptProductionExecutionInput } from "./production-ports.js";

type GptBrowserLeaseAuthority = Readonly<{
  readSourceConfirmedProviderEffect?: GptProductionBrowserAuthority["readSourceConfirmedProviderEffect"];
  acquireJobBoundTargetLease(
    binding: BrowserExecutionBinding,
    ownerId: string,
    wait: BrowserTargetLeaseWait,
  ): Promise<BrowserTargetLease>;
}>;

export type GptBrowserExecutionInput = Pick<GptProductionExecutionInput,
  "jobId" | "attemptId" | "resultRevision" | "deviceId" | "leaseVersion"
  | "deliveryPriorityReplayCalls"
  | "domainRejectionRevision"
  | "executionFenceHash" | "capabilityManifestHash" | "expiresAtMonotonic"
  | "commandTtlMs" | "abortSignal" | "providerContinuationParent">;

const sha256 = (value: string): GptHash =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

export type ProductionGptBrowserCall = {
  browser: BrowserTargetLease;
  facade: BrowserTargetLease;
  providerWaitLog: Readonly<{ callIdentity: string; emittedAt: number }> | null;
  confirmedProviderEffect: (GptChildBrowserFact & Readonly<{
    submitIdentity: BrowserAtomicStepIdentity;
    canonicalConversationUrl: string | null;
    userTurnId: string;
    sourceReadback?: NonNullable<NonNullable<GptProductionExecutionInput["readbackOnlyCalls"]>[number]["source"]>;
  }>) | null;
  settledResultPayloadHash: GptHash | null;
  recoverySelectionRequired: boolean;
};

export const PROVIDER_OBSERVATION_MIN_INTERVAL_MS = 70_000;

const ATOMIC_BROWSER_COMMANDS = new Set<PropertyKey>([
  "executeDomIntent",
  "readSubmittedConversationUrl",
  "observeCapability",
  "captureScreenshot",
  "attachFile",
  "readAuthenticatedMedia",
  "wait",
  "park",
]);

const confirmedReadbackIdentityMatches = (
  confirmed: NonNullable<ProductionGptBrowserCall["confirmedProviderEffect"]>,
  old: ReturnType<NonNullable<GptBrowserLeaseAuthority["readSourceConfirmedProviderEffect"]>> | null,
  prior: ReturnType<BrowserTargetLease["readAtomicStepOutcome"]> | null,
  exactCallIdentityHash: GptHash,
): boolean => {
  const source = confirmed.sourceReadback;
  return old ? old.exactCallIdentityHash === exactCallIdentityHash
    && old.authorityHash === confirmed.evidenceHash && old.authorityRef === confirmed.evidenceRef
    && old.actionOrdinal === confirmed.submitIdentity.actionOrdinal && old.inputHash === confirmed.submitIdentity.inputHash
    && source?.effectIdentityHash === confirmed.providerEffectIdentityHash
    : prior?.state === "confirmed" && prior.providerEffectIdentityHash === confirmed.providerEffectIdentityHash
      && prior.mutationOutcome === confirmed.mutationOutcome;
};

const assertConfirmedProviderReadback = (active: ProductionGptBrowserCall,
  browserAuthority: GptBrowserLeaseAuthority, jobId: string, attemptId: string): void => {
  const confirmed = active.confirmedProviderEffect;
  if (!confirmed) throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_READBACK_INVALID");
  const source = confirmed.sourceReadback;
  if (source && !browserAuthority.readSourceConfirmedProviderEffect) {
    throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_READBACK_INVALID");
  }
  const old = source ? browserAuthority.readSourceConfirmedProviderEffect!({
    jobId, ...source, productStepId: confirmed.submitIdentity.productStepId,
    callId: confirmed.submitIdentity.callId, childCapabilityId: confirmed.submitIdentity.childCapabilityId,
  }) : null;
  const prior = source ? null : active.browser.readAtomicStepOutcome(confirmed.submitIdentity);
  const payload = old?.terminalPayload ?? prior?.terminalPayload;
  const record = payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Readonly<Record<string, unknown>> : null;
  const identityMatches = confirmedReadbackIdentityMatches(confirmed, old, prior, browserExactCallIdentityHash({
    jobId, attemptId, writerFenceHash: active.browser.writerFenceHash, ...confirmed.submitIdentity }));
  const locator = old?.conversationLocator ?? prior?.conversationLocator;
  if (!identityMatches || !confirmed.canonicalConversationUrl || locator?.canonicalConversationUrl !== confirmed.canonicalConversationUrl
    || record?.userTurnId !== confirmed.userTurnId) {
    throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_READBACK_INVALID");
  }
};

export class ProductionGptBrowserLifecycle {
  private activeBrowser: Readonly<{ sessionKey: string; call: ProductionGptBrowserCall }> | null = null;
  private settledConversation: Readonly<{ sessionKey: string; canonicalConversationUrl: string;
    providerEffectIdentityHash: GptHash }> | null = null;

  public constructor(
    private readonly browserAuthority: GptBrowserLeaseAuthority,
    private readonly runtimeLogger: RuntimeLogger,
    private readonly sourceHash: GptHash,
    private readonly execution: GptBrowserExecutionInput,
  ) {}

  public async browserFor(sessionKey: string, productStepId: string, callId: string,
    freshConversation = false): Promise<ProductionGptBrowserCall> {
    if (freshConversation) { this.assertProviderTurnSettled(); this.settledConversation = null; }
    const settled = this.settledConversation?.sessionKey === sessionKey ? this.settledConversation : null;
    const mode = freshConversation ? "fresh"
      : this.execution.providerContinuationParent && !settled ? "authorized-continuation" : "confirmed-readback";
    return this.browserForMode(sessionKey, productStepId, callId, mode, settled?.providerEffectIdentityHash);
  }

  public async browserForConfirmedReadback(
    sessionKey: string,
    productStepId: string,
    callId: string,
    expectedProviderEffectIdentityHash?: GptHash,
  ): Promise<ProductionGptBrowserCall> {
    return this.browserForMode(sessionKey, productStepId, callId, "confirmed-readback", expectedProviderEffectIdentityHash);
  }

  public async browserForRateLimitRecovery(
    sessionKey: string,
    productStepId: string,
    callId: string,
  ): Promise<ProductionGptBrowserCall> {
    return this.browserForMode(sessionKey, productStepId, callId, "bound-observation");
  }

  private async browserForMode(
    sessionKey: string,
    productStepId: string,
    callId: string,
    targetMode: "fresh" | "authorized-continuation" | "confirmed-readback" | "bound-observation",
    expectedProviderEffectIdentityHash?: GptHash,
  ): Promise<ProductionGptBrowserCall> {
    if (!sessionKey) throw executionFailure("failed", "GPT_SESSION_KEY_REQUIRED");
    const current = this.activeBrowser;
    if (current?.sessionKey === sessionKey && !(targetMode === "fresh" && current.call.settledResultPayloadHash)) {
      const active = current.call;
      if (expectedProviderEffectIdentityHash && active.confirmedProviderEffect
        && active.confirmedProviderEffect.providerEffectIdentityHash !== expectedProviderEffectIdentityHash) {
        this.assertProviderTurnSettled();
        active.confirmedProviderEffect = null; active.settledResultPayloadHash = null;
        active.recoverySelectionRequired = true;
      }
      return active;
    }
    const previous = this.activeBrowser?.call;
    if (previous) {
      if (!previous.confirmedProviderEffect || !previous.settledResultPayloadHash) {
        throw executionFailure("failed", "GPT_BROWSER_SESSION_TRANSITION_UNSETTLED");
      }
      await this.parkActive("gpt-provider-turn-settled");
    }
    const browser = await this.acquireBrowserLease(
      productStepId, callId, null, targetMode, Date.now(), expectedProviderEffectIdentityHash,
    );
    const active: ProductionGptBrowserCall = {
      browser,
      facade: browser,
      providerWaitLog: null,
      confirmedProviderEffect: null,
      settledResultPayloadHash: null,
      recoverySelectionRequired: targetMode === "confirmed-readback" && this.settledConversation?.sessionKey === sessionKey,
    };
    let atomicIdentity: BrowserAtomicStepIdentity | null = null;
    active.facade = new Proxy(browser, {
      get: (_target, property) => {
        if (property === "runAtomicStep") {
          return async <T>(identity: BrowserAtomicStepIdentity, action: () => Promise<T>): Promise<T> => {
            assertBrowserAtomicStepIdentity(identity);
            if (atomicIdentity !== null) throw new Error("BROWSER_ATOMIC_STEP_IDENTITY_INVALID");
            atomicIdentity = Object.freeze({ ...identity });
            try {
              return await action();
            } finally {
              atomicIdentity = null;
            }
          };
        }
        const current = active.browser;
        const value = Reflect.get(current, property, current) as unknown;
        if (typeof value !== "function") return value;
        const bound = value.bind(current) as (...args: unknown[]) => unknown;
        if (!ATOMIC_BROWSER_COMMANDS.has(property) || atomicIdentity === null) return bound;
        const identity = atomicIdentity;
        return (...args: unknown[]) => current.runAtomicStep(
          identity,
          async () => bound(...args),
        );
      },
    });
    this.activeBrowser = Object.freeze({ sessionKey, call: active });
    return active;
  }

  public assertProviderTurnSettled(): void {
    const active = this.activeBrowser?.call;
    if (active?.confirmedProviderEffect && !active.settledResultPayloadHash) {
      throw executionFailure("failed", "GPT_BROWSER_SESSION_TRANSITION_UNSETTLED");
    }
  }

  public async recordConfirmedProviderEffect(active: ProductionGptBrowserCall, effect: GptChildBrowserFact,
    submitIdentity: BrowserAtomicStepIdentity, canonicalConversationUrl: string | null, userTurnId: string): Promise<void> {
    const prior = active.confirmedProviderEffect;
    if (prior?.providerEffectIdentityHash !== effect.providerEffectIdentityHash) active.settledResultPayloadHash = null;
    active.confirmedProviderEffect = Object.freeze({ ...effect, submitIdentity, canonicalConversationUrl, userTurnId });
    if (canonicalConversationUrl && prior?.canonicalConversationUrl !== canonicalConversationUrl) {
      active.recoverySelectionRequired = true;
    }
  }

  public recordSettledResult(activeOrEffect: ProductionGptBrowserCall | GptHash, payloadHash: GptHash,
    conversation?: Readonly<{ sessionKey: string; canonicalConversationUrl: string | null }>): void {
    const current = this.activeBrowser;
    const effectHash = typeof activeOrEffect === "string" ? activeOrEffect : activeOrEffect.confirmedProviderEffect?.providerEffectIdentityHash;
    if (!effectHash) throw executionFailure("failed", "GPT_SETTLED_PROVIDER_EFFECT_MISSING");
    const active = typeof activeOrEffect === "string"
      ? current?.call.confirmedProviderEffect?.providerEffectIdentityHash === effectHash ? current.call : null : activeOrEffect;
    const settled = conversation ?? (current?.call === active ? {
      sessionKey: current.sessionKey, canonicalConversationUrl: active?.confirmedProviderEffect?.canonicalConversationUrl ?? null,
    } : null);
    if (!settled?.sessionKey || !settled.canonicalConversationUrl
      || this.settledConversation?.sessionKey === settled.sessionKey
        && this.settledConversation.canonicalConversationUrl !== settled.canonicalConversationUrl) {
      throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH");
    }
    this.settledConversation = Object.freeze({ ...settled, canonicalConversationUrl: settled.canonicalConversationUrl,
      providerEffectIdentityHash: effectHash });
    if (active) { active.settledResultPayloadHash = payloadHash; active.recoverySelectionRequired = true; }
  }

  public async selectSettledConversation(active: ProductionGptBrowserCall): Promise<void> {
    if (!active.recoverySelectionRequired) return;
    const current = this.activeBrowser;
    const settled = this.settledConversation?.sessionKey === current?.sessionKey ? this.settledConversation : null;
    const url = active.confirmedProviderEffect?.canonicalConversationUrl ?? settled?.canonicalConversationUrl;
    if (!current || current.call !== active || !url) {
      throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH");
    }
    await active.facade.executeDomIntent({ kind: "selectExactGptConversation", canonicalConversationUrl: url });
    active.recoverySelectionRequired = false;
  }

  public async waitForProviderObservation(
    active: ProductionGptBrowserCall,
    productStepId: string,
    callId: string,
    childCapabilityId: GptChildCapabilityId,
    observationDeadlineAt: number,
    reason: GptProviderObservationWaitReason,
  ): Promise<"reobserve" | "deadline"> {
    if (childCapabilityId !== "checkpoint_gpt_text_response"
      && childCapabilityId !== "checkpoint_gpt_generated_image") {
      throw executionFailure("failed", "GPT_PROVIDER_PROBE_CHILD_INVALID");
    }
    if (!Number.isFinite(observationDeadlineAt)) throw executionFailure("failed", "GPT_PROVIDER_OBSERVATION_DEADLINE_INVALID");
    const current = this.activeBrowser;
    if (!current || current.call !== active) {
      throw executionFailure("failed", "GPT_BROWSER_SESSION_TRANSITION_UNSETTLED");
    }
    if (Date.now() >= observationDeadlineAt) return "deadline";
    if (active.browser.pendingMutationCount() > 0) {
      throw executionFailure("failed", "BROWSER_NORMAL_PROVIDER_WAIT_WITH_PENDING_MUTATION");
    }
    assertConfirmedProviderReadback(active, this.browserAuthority, this.execution.jobId, this.execution.attemptId);
    const eligibleAt = Date.now() + PROVIDER_OBSERVATION_MIN_INTERVAL_MS;
    if (eligibleAt > observationDeadlineAt) return "deadline";
    this.emitProviderWaitLog(active, productStepId, callId, childCapabilityId, reason);
    try {
      await active.facade.park({ reason: "gpt-provider-observation-wait", mode: "product-call-settlement" });
    } finally {
      if (this.activeBrowser === current) this.activeBrowser = null;
    }
    try {
      active.browser = await this.acquireBrowserLease(
        productStepId, callId, observationDeadlineAt, "confirmed-readback", eligibleAt,
        active.confirmedProviderEffect!.providerEffectIdentityHash!,
      );
    } catch (error) {
      if (failureCode(error) === "V6_DEADLINE_BUDGET_EXHAUSTED"
        && !this.execution.abortSignal.aborted && Date.now() >= observationDeadlineAt) return "deadline";
      throw error;
    }
    this.activeBrowser = current;
    await active.facade.executeDomIntent({ kind: "selectExactGptConversation",
      canonicalConversationUrl: active.confirmedProviderEffect!.canonicalConversationUrl! });
    return "reobserve";
  }

  private emitProviderWaitLog(
    active: ProductionGptBrowserCall,
    productStepId: string,
    callId: string,
    childCapabilityId: GptChildCapabilityId,
    reason: GptProviderObservationWaitReason,
  ): void {
    const textCodes = {
      "initial-observation": "GPT_PROVIDER_WAIT_INITIAL_OBSERVATION",
      "exact-user-turn-unavailable": "GPT_PROVIDER_WAIT_EXACT_USER_TURN_UNAVAILABLE",
      "adjacent-assistant-missing": "GPT_PROVIDER_WAIT_ADJACENT_ASSISTANT_MISSING",
      "stop-present": "GPT_PROVIDER_WAIT_STOP_PRESENT",
      "stopped-empty-confirming": "GPT_PROVIDER_WAIT_STOPPED_EMPTY_CONFIRMING",
    } as const;
    if (childCapabilityId === "checkpoint_gpt_generated_image"
      && reason === "generated-image-source-pending") {
      this.emitWaitLog(active, productStepId, callId, childCapabilityId, "GPT_PROVIDER_WAIT_ACTIVE");
      return;
    }
    if (childCapabilityId !== "checkpoint_gpt_text_response" || !(reason in textCodes)) {
      throw executionFailure("failed", "GPT_PROVIDER_WAIT_REASON_INVALID");
    }
    this.emitWaitLog(active, productStepId, callId, childCapabilityId,
      textCodes[reason as keyof typeof textCodes]);
  }

  private emitWaitLog(
    active: ProductionGptBrowserCall,
    productStepId: string,
    callId: string,
    childCapabilityId: GptChildCapabilityId,
    code: "GPT_PROVIDER_WAIT_ACTIVE"
      | "GPT_PROVIDER_WAIT_INITIAL_OBSERVATION"
      | "GPT_PROVIDER_WAIT_EXACT_USER_TURN_UNAVAILABLE"
      | "GPT_PROVIDER_WAIT_ADJACENT_ASSISTANT_MISSING"
      | "GPT_PROVIDER_WAIT_STOP_PRESENT"
      | "GPT_PROVIDER_WAIT_STOPPED_EMPTY_CONFIRMING",
  ): void {
    const callIdentity = `${productStepId}:${callId}:${childCapabilityId}:${code}`;
    const emittedAt = performance.now();
    if (active.providerWaitLog?.callIdentity !== callIdentity
      || emittedAt - active.providerWaitLog.emittedAt >= PROVIDER_OBSERVATION_MIN_INTERVAL_MS) {
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

  private async parkActive(reason: string): Promise<void> {
    const current = this.activeBrowser;
    if (!current) return;
    try {
      await current.call.browser.park({ reason, mode: "product-call-settlement" });
    } finally {
      if (this.activeBrowser === current) this.activeBrowser = null;
    }
  }

  public async settle(error: unknown | null): Promise<void> {
    try {
      await this.parkActive(error ? "gpt-product-call-failed" : "gpt-product-call-settled");
    } catch (parkError) {
      throw new AggregateError([parkError], "GPT_BROWSER_LIFECYCLE_FAILED");
    } finally {
      this.settledConversation = null;
    }
  }

  private async acquireBrowserLease(
    productStepId: string,
    callId: string,
    probeDeadlineAt: number | null,
    targetMode: BrowserTargetLeaseWait["targetMode"],
    eligibleAt: number,
    providerEffectIdentityHash?: GptHash,
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
      domainRejectionRevision: this.execution.domainRejectionRevision ?? false,
      deliveryPriorityReplayCalls: this.execution.deliveryPriorityReplayCalls ?? [],
      get commandTtlMs() { return currentCommandTtlMs(); },
    };
    const wait = {
      signal: this.execution.abortSignal,
      remainingMs,
      eligibleAt,
    };
    return this.browserAuthority.acquireJobBoundTargetLease(binding,
    `${this.execution.jobId}:${callId}`, targetMode === "authorized-continuation" ? {
      ...wait,
      targetMode,
      parentJobId: this.execution.providerContinuationParent!.jobId,
      parentSources: this.execution.providerContinuationParent!.sources,
    } : targetMode === "confirmed-readback" ? {
      ...wait,
      targetMode,
      ...(providerEffectIdentityHash ? { providerEffectIdentityHash } : {}),
    } : { ...wait, targetMode });
  }
}
