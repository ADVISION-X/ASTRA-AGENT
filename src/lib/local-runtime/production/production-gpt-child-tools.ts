import { createHash } from "node:crypto";

import {
  GPT_CHILD_CAPABILITY_CONTRACTS,
  gptContinuationIdentityHash,
  gptExactCallIdentityHash,
  type GptAbilityGroup,
  type GptChildCapabilityIntent,
  type GptChildCapabilityProof,
  type GptChildCapabilityResult,
} from "../../../capabilities/gpt/index.js";
import type { ForensicsPersistenceAbilityGroup } from "../../../capabilities/forensics-persistence/index.js";
import type { BrowserTargetLease } from "../../browser/browser-authority-api.js";
import {
  RuntimeFailureImpact,
  requireRuntimeLogWrite,
  runtimeFailureFromError,
  withRuntimeLogCause,
  type RuntimeLogger,
  type RuntimeSpanHandle,
} from "../../runtime-logs/index.js";
import { executionFailure, failureCode, typedExecutionFailure } from "../../typed-failure.js";
import type { WorkbenchBrowserAuthority } from "../workbench-browser-authority-support.js";
import { hashCanonical, type ProductionHash, type WebsiteAgentTask } from "./contracts.js";
import type {
  ExactGptCallFacts,
  ProductGptCallInput,
  ProductGptChildResult,
  ProductGptTools,
} from "./plugin.js";
import type { ProductionExecutionLease } from "./executor.js";
import { ProductionRuntimeStore } from "./store.js";
import {
  childFailureEventIds,
  persistGptChildEvidence,
  persistedEvidenceRefs,
} from "./gpt-evidence-writer.js";

type ExecutionInput = Readonly<{
  task: WebsiteAgentTask;
  pluginId: string;
  pluginVersion: number;
  lease: ProductionExecutionLease;
  parentSpanId: string;
}>;

type ActiveBrowserCall = {
  sessionKey: string;
  browser: BrowserTargetLease;
  facade: BrowserTargetLease;
};

export type ProductGptExecution = Readonly<{
  tools: ProductGptTools;
  continuationRef(): string | null;
  settle(error: unknown | null): Promise<void>;
}>;

const hashText = (value: string): ProductionHash =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const objectRecord = (value: unknown): Readonly<Record<string, unknown>> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>> : null;

const stringArray = (value: unknown): readonly string[] | null =>
  Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0)
    ? Object.freeze([...value]) as readonly string[] : null;

const throwChildFailure = (result: GptChildCapabilityResult): never => {
  const error = executionFailure("failed", result.failureCode ?? "GPT_CHILD_FAILED", {
    mutationOutcome: result.proof.committedMutation,
    evidenceRef: persistedEvidenceRefs.get(result) ?? null,
    evidenceHash: result.proof.evidenceHash,
  });
  const causeEventId = childFailureEventIds.get(result);
  throw causeEventId ? withRuntimeLogCause(error, causeEventId) : error;
};

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
    targetRefHash: hashText(input.browser.target.targetRef),
    beforeDocumentRefHash: hashText(input.browser.document.documentRef),
    afterDocumentRefHash: hashText(input.browser.document.documentRef),
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
  const evidenceHash = hashText(JSON.stringify(unsigned));
  return Object.freeze({
    ...unsigned,
    evidenceRef: input.authorityRef,
    evidenceHash,
  });
};

const recoveredResult = (input: Readonly<{
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

export class ProductionGptChildTools {
  public constructor(
    private readonly dataDir: string,
    private readonly sourceHash: ProductionHash,
    private readonly gpt: GptAbilityGroup,
    private readonly evidenceStore: ForensicsPersistenceAbilityGroup,
    private readonly browserAuthority: WorkbenchBrowserAuthority,
    private readonly store: ProductionRuntimeStore,
    private readonly runtimeLogger: RuntimeLogger,
  ) {}

  public createExecution(input: ExecutionInput): ProductGptExecution {
    const browsers = new Map<string, ActiveBrowserCall>();
    let continuationRef: string | null = input.task.continuation_ref ?? null;
    const execute = async (call: Parameters<ProductGptTools["execute"]>[0]): Promise<ProductGptChildResult> => {
      const result = await this.executeOne(input, browsers, call);
      if (call.child === "persist_gpt_continuation" && result.value
        && typeof result.value === "object" && !Array.isArray(result.value)) {
        const value = Reflect.get(result.value, "continuationRef");
        if (value !== null && (typeof value !== "string" || value.length === 0)) {
          throw executionFailure("failed", "GPT_CONTINUATION_REF_INVALID");
        }
        continuationRef = value as string | null;
      }
      return result;
    };
    return Object.freeze({
      tools: Object.freeze({
        attemptId: input.lease.attempt_id,
        execute,
        readCallFacts: (call: Parameters<ProductGptTools["readCallFacts"]>[0]) =>
          this.readCallFacts(input, call),
      }),
      continuationRef: () => continuationRef,
      settle: (error) => this.settleBrowsers(browsers, error),
    });
  }

  private intentFor(
    execution: ExecutionInput,
    call: ProductGptCallInput,
  ): GptChildCapabilityIntent {
    const inputHash = hashCanonical(call.input);
    const identity = {
      jobId: execution.task.job_id,
      attemptId: execution.lease.attempt_id,
      pluginId: execution.pluginId,
      pluginVersion: execution.pluginVersion,
      productStepId: call.productStepId,
      callId: call.callId,
      childCapabilityId: call.child,
      inputHash,
    } as const;
    return Object.freeze({
      ...identity,
      executionId: `gpt-call:${gptExactCallIdentityHash(identity).slice(7)}`,
      actionOrdinal: call.actionOrdinal,
      input: call.input,
    });
  }

  private async readCallFacts(
    execution: ExecutionInput,
    call: ProductGptCallInput,
  ): Promise<ExactGptCallFacts> {
    return this.readIntentFacts(execution, this.intentFor(execution, call));
  }

  private async readIntentFacts(
    execution: ExecutionInput,
    intent: GptChildCapabilityIntent,
  ): Promise<ExactGptCallFacts> {
    const exactCallIdentityHash = gptExactCallIdentityHash(intent);
    const mutation = this.browserAuthority.readExactCallMutationFact({
      jobId: intent.jobId,
      attemptId: intent.attemptId,
      ownerPluginId: intent.pluginId,
      pluginVersion: intent.pluginVersion,
      exactCallIdentityHash,
      actionOrdinal: intent.actionOrdinal,
    });
    const storedEvidence = await this.evidenceStore.readExactCallEvidence({
      missionId: intent.jobId,
      runId: intent.attemptId,
      exactCallIdentityHash,
    });
    let evidence: ExactGptCallFacts["evidence"] = null;
    if (storedEvidence) {
      const record = storedEvidence.record;
      const payload = objectRecord(record.payload);
      const artifactRefs = stringArray(record.artifactRefs ?? []);
      const evidenceHash = payload?.source_evidence_hash;
      if (record.missionId !== intent.jobId
        || record.runId !== intent.attemptId
        || record.stepId !== intent.productStepId
        || record.sourceAbilityGroupId !== "gpt"
        || record.sourceChildCapabilityId !== intent.childCapabilityId
        || record.idempotencyKey !== `gpt-call-evidence:v1:${exactCallIdentityHash}`
        || payload?.exact_call_identity_hash !== exactCallIdentityHash
        || payload?.action_ordinal !== intent.actionOrdinal
        || payload?.plugin_version !== intent.pluginVersion
        || typeof evidenceHash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(evidenceHash)
        || artifactRefs === null) {
        throw executionFailure("failed", "FORENSICS_EXACT_CALL_EVIDENCE_INVALID");
      }
      evidence = Object.freeze({
        owner: "forensics-persistence",
        evidenceRef: storedEvidence.recordRef,
        evidenceHash: evidenceHash as ProductionHash,
        readbackVerified: true,
        artifactRefs,
      });
    }
    const continuationRef = intent.childCapabilityId === "persist_gpt_continuation"
      ? `gpt-continuation:${exactCallIdentityHash.slice(7)}`
      : this.continuationRefFromInput(intent.input);
    let continuation: ExactGptCallFacts["continuation"] = null;
    if (continuationRef) {
      const stored = this.store.readGptContinuation(continuationRef);
      if (stored) {
        if (stored.conversation_identity_hash !== gptContinuationIdentityHash(stored.provider)) {
          throw executionFailure("failed", "GPT_CONTINUATION_IDENTITY_INVALID");
        }
        continuation = Object.freeze({
          owner: "gpt-session-controller",
          continuationRef,
          conversationIdentityHash: stored.conversation_identity_hash,
          laneVersion: stored.lane_version,
          contentReadbackVerified: true,
        });
      }
    }
    return Object.freeze({
      exactCallIdentityHash,
      mutation: mutation ? Object.freeze({
        owner: "browser",
        effectScope: mutation.effectScope,
        outcome: mutation.outcome,
        terminalAt: mutation.terminalAt,
      }) : null,
      evidence,
      continuation,
    });
  }

  private continuationRefFromInput(input: Readonly<Record<string, unknown>>): string | null {
    if (typeof input.continuationRef === "string" && input.continuationRef.length > 0) {
      return input.continuationRef;
    }
    const lane = objectRecord(input.lane);
    return typeof lane?.continuation_ref === "string" && lane.continuation_ref.length > 0
      ? lane.continuation_ref : null;
  }

  private childSpan(input: ExecutionInput, intent: GptChildCapabilityIntent): RuntimeSpanHandle {
    return requireRuntimeLogWrite(this.runtimeLogger.startSpan({
      traceId: input.task.job_id,
      parentSpanId: input.parentSpanId,
      boundaryId: intent.executionId,
      owner: "gpt",
      component: "gpt-child",
      operation: "gpt.child",
      typedIdentity: {
        kind: "gpt-call",
        jobId: input.task.job_id,
        attemptId: input.lease.attempt_id,
        pluginId: input.pluginId,
        pluginVersion: input.pluginVersion,
        stepId: intent.productStepId,
        capabilityCallId: `${intent.callId}:${intent.childCapabilityId}`,
      },
    }));
  }

  private terminalize(span: RuntimeSpanHandle, result: GptChildCapabilityResult): void {
    const terminal = result.status === "success"
      ? requireRuntimeLogWrite(span.terminal({ outcome: "succeeded" }))
      : requireRuntimeLogWrite(span.terminal({
        outcome: "failed",
        failure: runtimeFailureFromError({
          error: new Error(result.failureCode ?? "GPT_CHILD_FAILED"),
          code: result.failureCode ?? "GPT_CHILD_FAILED",
          responsibleOwner: "gpt",
          impact: RuntimeFailureImpact.BLOCKING,
        }),
      }));
    childFailureEventIds.set(result, terminal.eventId);
  }

  private terminalizeError(span: RuntimeSpanHandle, error: unknown): never {
    const failure = typedExecutionFailure(error) ?? executionFailure(
      "failed",
      failureCode(error, "GPT_CHILD_RUNTIME_FAILED"),
      { cause: error },
    );
    const terminal = requireRuntimeLogWrite(span.terminal({
      outcome: "failed",
      failure: runtimeFailureFromError({
        error: failure,
        code: "GPT_CHILD_RUNTIME_FAILED",
        responsibleOwner: "gpt",
        impact: RuntimeFailureImpact.BLOCKING,
      }),
    }));
    throw withRuntimeLogCause(failure, terminal.eventId);
  }

  private async executeOne(
    execution: ExecutionInput,
    browsers: Map<string, ActiveBrowserCall>,
    call: Parameters<ProductGptTools["execute"]>[0],
  ): Promise<ProductGptChildResult> {
    const intent = this.intentFor(execution, call);
    const facts = await this.readIntentFacts(execution, intent);
    const contract = GPT_CHILD_CAPABILITY_CONTRACTS[call.child];
    const span = this.childSpan(execution, intent);
    if (facts.mutation?.outcome === "REJECTED") {
      return this.terminalizeError(span, executionFailure("failed", "BROWSER_POSTCONDITION_FAILED", {
        evidenceRef: facts.evidence?.evidenceRef ?? null,
        evidenceHash: facts.evidence?.evidenceHash ?? null,
      }));
    }
    if (facts.evidence && call.child === "persist_gpt_continuation") {
      if (!facts.continuation) {
        return this.terminalizeError(span, executionFailure("failed", "GPT_CONTINUATION_IDENTITY_INVALID"));
      }
      requireRuntimeLogWrite(span.terminal({ outcome: "succeeded" }));
      return Object.freeze({
        value: { continuationRef: facts.continuation.continuationRef },
        evidenceRef: facts.evidence.evidenceRef,
        evidenceHash: facts.evidence.evidenceHash,
      });
    }
    if (facts.evidence && (call.child === "advance_gpt_continuation_lane"
      || call.child === "release_gpt_continuation_lane")) {
      requireRuntimeLogWrite(span.terminal({ outcome: "succeeded" }));
      return Object.freeze({
        value: call.child === "advance_gpt_continuation_lane" ? { advanced: true } : { released: true },
        evidenceRef: facts.evidence.evidenceRef,
        evidenceHash: facts.evidence.evidenceHash,
      });
    }
    const browserMutation = contract.requiredTargetKind === "chatgpt"
      && contract.oneObservationOrMutation === "at-most-one-mutation";
    if (facts.evidence && browserMutation && facts.mutation?.outcome !== "DISPATCHED") {
      requireRuntimeLogWrite(span.terminal({ outcome: "succeeded" }));
      return Object.freeze({
        value: null,
        evidenceRef: facts.evidence.evidenceRef,
        evidenceHash: facts.evidence.evidenceHash,
      });
    }
    const browserCall = contract.requiredTargetKind === "chatgpt"
      ? await this.browserFor(execution, browsers, call.sessionKey, call.productStepId, call.callId)
      : undefined;
    const browser = browserCall?.facade;
    if (call.child === "submit_exact_gpt_turn_once"
      && facts.mutation === null && facts.evidence === null
      && this.browserAuthority.countProviderTurnDispatches(
        execution.task.job_id,
        execution.lease.attempt_id,
      ) >= execution.lease.max_provider_turns) {
      throw executionFailure("failed", "PROVIDER_TURN_BUDGET_EXHAUSTED");
    }
    let result: GptChildCapabilityResult;
    let evidenceRef: string;
    let resolveDispatched = false;
    try {
      const atomic = await this.runAtomic(execution, intent, browserCall, execution.lease.abort_signal);
      result = atomic.result;
      resolveDispatched = atomic.resolveDispatched;
      evidenceRef = facts.evidence?.evidenceRef ?? await persistGptChildEvidence({
        result, intent, evidenceStore: this.evidenceStore,
        jobId: execution.task.job_id, attemptId: execution.lease.attempt_id,
        stepId: call.productStepId, exactCallIdentityHash: facts.exactCallIdentityHash,
      });
      if (resolveDispatched && browser && result.status === "success") {
        await browser.resolvePendingMutation({
          schemaVersion: "grasseye.browser.outcome-resolution.v1",
          ownerPluginId: execution.pluginId,
          outcome: "TERMINAL_SUCCESS",
          positiveEvidenceRef: `${evidenceRef}#positive-postcondition`,
          negativeEvidenceRef: `${evidenceRef}#negative-postcondition-absent`,
          uniqueTargetRef: browser.target.targetRef,
          boundedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      return this.terminalizeError(span, error);
    }
    this.terminalize(span, result);
    if (result.status !== "success") throwChildFailure(result);
    return Object.freeze({
      value: result.value,
      evidenceRef,
      evidenceHash: facts.evidence?.evidenceHash ?? result.proof.evidenceHash,
    });
  }

  private async runAtomic(
    execution: ExecutionInput,
    intent: GptChildCapabilityIntent,
    browserCall: ActiveBrowserCall | undefined,
    signal: AbortSignal,
  ): Promise<Readonly<{ result: GptChildCapabilityResult; resolveDispatched: boolean }>> {
    const browser = browserCall?.facade;
    const context = {
      dataDir: this.dataDir,
      ...(browser ? { browser } : {}),
      signal,
      continuationStore: this.store,
      ...(browserCall ? {
        yieldForProviderWait: (durationMs: number) => this.yieldForProviderWait(
          execution, browserCall, intent.productStepId, intent.callId, durationMs,
        ),
      } : {}),
    };
    if (!browser) return { result: await this.gpt.execute(intent, context), resolveDispatched: false };
    const atomicIdentity = {
      productStepId: intent.productStepId,
      callId: intent.callId,
      childCapabilityId: intent.childCapabilityId,
      inputHash: intent.inputHash,
      actionOrdinal: intent.actionOrdinal,
      replayPolicy: GPT_CHILD_CAPABILITY_CONTRACTS[intent.childCapabilityId].replayPolicy,
    } as const;
    const recovery = browser.readAtomicStepRecovery(atomicIdentity);
    if (!recovery) {
      return {
        result: await browser.runAtomicStep(
          atomicIdentity,
          () => this.gpt.execute(intent, context),
        ),
        resolveDispatched: false,
      };
    }
    if (recovery.state === "rejected") {
      return {
        result: recoveredResult({
          intent,
          browser,
          readback: null,
          authorityRef: recovery.authorityRef,
          state: "rejected",
        }),
        resolveDispatched: false,
      };
    }
    const readback = await browser.runAtomicStep(
      atomicIdentity,
      () => this.gpt.execute(intent, { ...context, mutationMode: "readback" }),
    );
    if (readback.status !== "success") return { result: readback, resolveDispatched: false };
    return {
      result: recoveredResult({
        intent,
        browser,
        readback,
        authorityRef: recovery.authorityRef,
        state: "confirmed",
      }),
      resolveDispatched: recovery.state === "dispatched",
    };
  }

  private async browserFor(
    input: ExecutionInput,
    browsers: Map<string, ActiveBrowserCall>,
    sessionKey: string,
    productStepId: string,
    callId: string,
  ): Promise<ActiveBrowserCall> {
    if (!sessionKey) throw executionFailure("failed", "GPT_SESSION_KEY_REQUIRED");
    const current = browsers.get(sessionKey);
    if (current) return current;
    const browser = await this.acquireBrowserLease(input, productStepId, callId);
    const active = {
      sessionKey,
      browser,
      facade: null as unknown as BrowserTargetLease,
    };
    active.facade = new Proxy({} as BrowserTargetLease, {
      get: (_target, property) => {
        const value = Reflect.get(active.browser, property, active.browser) as unknown;
        return typeof value === "function" ? value.bind(active.browser) : value;
      },
    });
    browsers.set(sessionKey, active);
    return active;
  }

  private async acquireBrowserLease(
    input: ExecutionInput,
    productStepId: string,
    callId: string,
  ): Promise<BrowserTargetLease> {
    const remaining = Math.floor(input.lease.expires_at_monotonic - performance.now());
    const commandTtlMs = Math.min(input.lease.command_ttl_ms, remaining);
    if (commandTtlMs < 1) throw executionFailure("failed", "V6_DEADLINE_BUDGET_EXHAUSTED");
    const executionRef = [
      input.task.job_id,
      input.lease.attempt_id,
      input.pluginId,
      input.pluginVersion,
      productStepId,
      callId,
    ].join(":");
    const browser = await this.browserAuthority.acquireJobBoundTargetLease({
      kind: "production",
      ownerPluginId: input.pluginId,
      pluginVersion: input.pluginVersion,
      jobId: input.task.job_id,
      productStepId,
      attemptId: input.lease.attempt_id,
      deviceId: input.lease.device_id,
      leaseVersion: input.lease.lease_version,
      localOrderId: input.task.job_id,
      contractManifestHash: input.lease.control_manifest_hash,
      executionRef,
      jobRefHash: hashText(input.task.job_id),
      executionRefHash: hashText(executionRef),
      writerLeaseEpoch: input.lease.lease_version,
      writerFenceHash: input.lease.execution_fence_hash,
      candidateHash: this.sourceHash,
      commandTtlMs,
    }, `${input.pluginId}:${input.task.job_id}:${callId}`, {
      signal: input.lease.abort_signal,
      remainingMs: () => Math.floor(input.lease.expires_at_monotonic - performance.now()),
    });
    return browser;
  }

  private async yieldForProviderWait(
    input: ExecutionInput,
    active: ActiveBrowserCall,
    productStepId: string,
    callId: string,
    durationMs: number,
  ): Promise<void> {
    if (!Number.isInteger(durationMs) || durationMs < 25 || durationMs > 5_000) {
      throw executionFailure("failed", "GPT_PROVIDER_WAIT_SLICE_INVALID");
    }
    if (active.browser.pendingMutationCount() > 0 || active.browser.requiresMutationRecovery()) {
      throw executionFailure("failed", "BROWSER_NORMAL_PROVIDER_WAIT_WITH_PENDING_MUTATION");
    }
    const targetRef = active.browser.target.targetRef;
    await active.browser.park({
      reason: "gpt-normal-provider-wait-yield",
      mode: "normal-provider-wait",
    });
    await this.waitForDelay(input.lease.abort_signal, input.lease.expires_at_monotonic, durationMs);
    const reacquired = await this.acquireBrowserLease(input, productStepId, callId);
    if (reacquired.target.targetRef !== targetRef) {
      await reacquired.close({ reason: "gpt-exact-target-reacquire-mismatch" }).catch(() => undefined);
      throw executionFailure("failed", "BROWSER_RECONCILIATION_IDENTITY_MISMATCH");
    }
    active.browser = reacquired;
  }

  private async waitForDelay(
    signal: AbortSignal,
    expiresAtMonotonic: number,
    durationMs: number,
  ): Promise<void> {
    const remaining = Math.floor(expiresAtMonotonic - performance.now());
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

  private async settleBrowsers(
    browsers: Map<string, ActiveBrowserCall>,
    error: unknown | null,
  ): Promise<void> {
    const failures: unknown[] = [];
    for (const [key, call] of browsers) {
      try {
        const unresolved = call.browser.pendingMutationCount() > 0
          || call.browser.requiresMutationRecovery();
        if (unresolved) await call.browser.park({
          reason: "gpt-mutation-reconciliation-required",
          mode: "recovery",
        });
        else await call.browser.close({ reason: error ? "gpt-product-call-failed" : "gpt-product-call-settled" });
      } catch (closeError) {
        failures.push(closeError);
      } finally {
        browsers.delete(key);
      }
    }
    if (failures.length > 0) {
      throw new AggregateError(error ? [error, ...failures] : failures, "GPT_BROWSER_LIFECYCLE_FAILED");
    }
  }
}
