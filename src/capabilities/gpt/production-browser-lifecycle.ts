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
import { assertBrowserAtomicStepIdentity } from "../../lib/browser/browser-authority-api.js";
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
  providerContinuationParentJobId?: string;
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
  settledConversationRenameTaken: boolean;
  settledRenameTransportRevoked: boolean;
  recoverySelectionRequired: boolean;
};

export const PROVIDER_OBSERVATION_INTERVAL_MS = 60_000;

const ATOMIC_BROWSER_COMMANDS = new Set<PropertyKey>([
  "executeDomIntent",
  "observeCapability",
  "captureScreenshot",
  "attachFile",
  "readAuthenticatedMedia",
  "wait",
  "park",
]);

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
  ): Promise<ProductionGptBrowserCall> {
    return this.browserForMode(sessionKey, productStepId, callId,
      this.execution.providerContinuationParentJobId ? "authorized-continuation" : "fresh");
  }

  public async browserForConfirmedReadback(
    sessionKey: string,
    productStepId: string,
    callId: string,
  ): Promise<ProductionGptBrowserCall> {
    return this.browserForMode(sessionKey, productStepId, callId, "confirmed-readback");
  }

  private async browserForMode(
    sessionKey: string,
    productStepId: string,
    callId: string,
    targetMode: "fresh" | "authorized-continuation" | "confirmed-readback",
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
    const browser = await this.acquireBrowserLease(
      productStepId, callId, null, targetMode, Date.now(),
    );
    const active: ProductionGptBrowserCall = {
      browser,
      facade: browser,
      providerWaitLog: null,
      confirmedProviderEffect: null,
      settledResultPayloadHash: null,
      settledConversationRenameTaken: false,
      settledRenameTransportRevoked: false,
      recoverySelectionRequired: targetMode === "confirmed-readback",
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

  public takeSettledConversationCleanup(nextSessionKey?: string): Readonly<{
    sessionKey: string;
    canonicalConversationUrl: string;
    terminalAt: string;
  }> | null {
    const active = this.activeBrowser;
    const confirmed = active?.call.confirmedProviderEffect;
    if (!active || active.call.settledConversationRenameTaken
      || (nextSessionKey !== undefined && active.sessionKey === nextSessionKey)
      || !confirmed?.terminalAt || !active.call.settledResultPayloadHash) return null;
    active.call.settledConversationRenameTaken = true;
    return Object.freeze({
      sessionKey: active.sessionKey,
      canonicalConversationUrl: confirmed.canonicalConversationUrl,
      terminalAt: confirmed.terminalAt,
    });
  }

  public recordSettledRenameTransportRevocation(sessionKey: string): void {
    const active = this.activeBrowser;
    if (!active || active.sessionKey !== sessionKey
      || !active.call.settledConversationRenameTaken
      || active.call.browser.pendingMutationCount() !== 0) return;
    active.call.settledRenameTransportRevoked = true;
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
    const eligibleAt = Math.min(Date.now() + PROVIDER_OBSERVATION_INTERVAL_MS, observationDeadlineAt);
    await active.facade.park({
      reason: "gpt-provider-observation-wait",
      mode: "product-call-settlement",
    });
    try {
      active.browser = await this.acquireBrowserLease(
        productStepId, callId, observationDeadlineAt, "bound-observation", eligibleAt,
      );
      return "reobserve";
    } catch (error) {
      if (this.activeBrowser?.call === active) this.activeBrowser = null;
      if (Date.now() >= observationDeadlineAt) return "deadline";
      throw error;
    }
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
    const current = this.activeBrowser;
    if (!current) return;
    let released = false;
    try {
      await current.call.browser.park({ reason, mode: "product-call-settlement" });
      released = true;
    } catch (error) {
      if (!current.call.settledRenameTransportRevoked
        || current.call.browser.pendingMutationCount() !== 0) throw error;
      released = true;
    } finally {
      if (released) this.activeBrowser = null;
    }
  }

  private async acquireBrowserLease(
    productStepId: string,
    callId: string,
    probeDeadlineAt: number | null,
    targetMode: BrowserTargetLeaseWait["targetMode"],
    eligibleAt: number,
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
    const wait = {
      signal: this.execution.abortSignal,
      remainingMs,
      eligibleAt,
    };
    return this.browserAuthority.acquireJobBoundTargetLease(binding,
    `${this.execution.jobId}:${callId}`, targetMode === "authorized-continuation" ? {
      ...wait,
      targetMode,
      parentJobId: this.execution.providerContinuationParentJobId!,
    } : {
      ...wait,
      targetMode,
    });
  }
}
