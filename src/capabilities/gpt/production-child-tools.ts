import { createHash } from "node:crypto";

import {
  GPT_CHILD_CAPABILITY_CONTRACTS,
  type GptAbilityGroup,
  type GptAnyChildCapabilityIntent,
  type GptChildCapabilityId,
  type GptChildCapabilityIntent,
  type GptChildCapabilityResult,
} from "./contract.js";
import { gptExactCallIdentityHash } from "./contract.js";
import {
  RuntimeFailureImpact,
  requireRuntimeLogWrite,
  runtimeFailureFromError,
  withRuntimeLogCause,
  type RuntimeLogger,
  type RuntimeSpanHandle,
} from "../../lib/runtime-logs/index.js";
import { executionFailure, failureCode, typedExecutionFailure } from "../../lib/execution-failure.js";
import { gptExecutionFailure } from "./execution-fault.js";
import type { BrowserTargetLease } from "../../lib/browser/browser-authority-api.js";
import type {
  ExactGptCallFacts,
  ExactGptContinuationQuery,
  ProductGptCallInput,
  ProductGptFactQuery,
  ProductGptChildResult,
  ProductGptTools,
} from "./product-api.js";
import type { GptHash } from "./contract.js";
import { persistGptChildEvidence } from "./evidence-writer.js";
import { ProductionGptBrowserLifecycle } from "./production-browser-lifecycle.js";
import { executeProductionGptAtomicCall } from "./production-atomic-call.js";
import {
  isPendingExactEvidence,
  productSafeExactGptCallFacts,
  readProductionGptCallFacts,
  type GptExactCallFactsWithBrowserBinding,
} from "./production-call-facts.js";
import {
  GptContinuationReadback,
} from "./continuation-readback.js";
import { readCompletedGptChildResult } from "./completed-result.js";
import {
  authorizeConfirmedProviderFailureReadback,
  authorizeConfirmedProviderReadback,
  confirmedProviderSubmitReceipt,
  mergeConfirmedProviderSubmitReceipt,
  readConfirmedProviderSubmitFailureReceipt,
  type ConfirmedProviderSubmitReceipt,
} from "./confirmed-provider-readback.js";
import { readTaskExactGptCallFacts } from "./task-exact-effect.js";
import type {
  GptEvidenceStorePort,
  GptProductionBrowserAuthority,
  GptProductionRuntimePort,
} from "./production-ports.js";
import {
  childFailureEventIds,
  throwGptChildFailure,
  type GptProductionExecutionInput as ExecutionInput,
  type ProductGptExecution,
} from "./production-child-support.js";

export type { ProductGptExecution } from "./production-child-support.js";

const sha256 = (value: string | Uint8Array): GptHash =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
const hashCanonical = (value: unknown): GptHash => {
  const canonical = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(canonical);
    if (input && typeof input === "object") return Object.fromEntries(
      Object.entries(input as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonical(nested)]),
    );
    return typeof input === "string" ? input.normalize("NFC") : input;
  };
  return sha256(JSON.stringify(canonical(value)));
};

const throwRejectedMutation = (
  facts: GptExactCallFactsWithBrowserBinding,
  intent: GptChildCapabilityIntent,
): never => {
  const mutation = facts.mutation;
  if (!mutation || mutation.outcome !== "REJECTED") {
    throw executionFailure("failed", "BROWSER_MUTATION_REJECTION_INVALID");
  }
  const rejectedFailureCode = mutation.failureCode ?? "BROWSER_POSTCONDITION_FAILED";
  const nativeFailureCode = mutation.nativeFailureCode;
  const nativeCause = nativeFailureCode
    ? Object.assign(new Error(nativeFailureCode), { code: nativeFailureCode }) : undefined;
  const browserFact = Object.freeze({
    exactCallIdentityHash: facts.exactCallIdentityHash,
    childCapabilityId: intent.childCapabilityId,
    effectScope: mutation.effectScope,
    browserOutcome: "REJECTED" as const,
    mutationOutcome: mutation.mutationOutcome,
    terminalAt: mutation.terminalAt,
    evidenceRef: mutation.authorityRef,
    evidenceHash: mutation.authorityHash,
  });
  throw gptExecutionFailure(rejectedFailureCode, {
    mutationOutcome: mutation.mutationOutcome,
    evidence: Object.freeze({
      evidenceRef: mutation.authorityRef,
      evidenceHash: mutation.authorityHash,
    }),
    browserEffect: Object.freeze({
      effectScope: mutation.effectScope,
      childCapabilityId: intent.childCapabilityId,
      browserOutcome: "REJECTED",
    }),
    proofFacts: Object.freeze({
      decision: "FAIL_CLOSED",
      factResultIds: Object.freeze([mutation.authorityRef]),
      candidateCardinality: Object.freeze({ raw: null, eligible: null }),
      authorityRefHashes: Object.freeze([mutation.authorityHash]),
      observationRevisionHash: null,
      mutationOutcome: mutation.mutationOutcome,
      browserFact,
      nativeFailureCode,
    }),
    cause: nativeCause,
  });
};

export class ProductionGptChildTools {
  private readonly continuationReadback: GptContinuationReadback;

  public constructor(
    private readonly dataDir: string,
    private readonly sourceHash: GptHash,
    private readonly gpt: GptAbilityGroup,
    private readonly evidenceStore: GptEvidenceStorePort,
    private readonly browserAuthority: GptProductionBrowserAuthority,
    private readonly runtime: GptProductionRuntimePort,
    private readonly runtimeLogger: RuntimeLogger,
  ) {
    this.continuationReadback = new GptContinuationReadback(evidenceStore, runtime.continuationReadback);
  }
  public createExecution(input: ExecutionInput): ProductGptExecution {
    const browsers = new ProductionGptBrowserLifecycle(
      this.browserAuthority,
      this.runtimeLogger,
      this.sourceHash,
      {
        jobId: input.jobId,
        attemptId: input.attemptId,
        pluginId: input.pluginId,
        pluginVersion: input.pluginVersion,
        deviceId: input.deviceId,
        leaseVersion: input.leaseVersion,
        executionFenceHash: input.executionFenceHash,
        controlManifestHash: input.controlManifestHash,
        get expiresAtMonotonic() { return input.expiresAtMonotonic; },
        get commandTtlMs() { return input.commandTtlMs; },
        abortSignal: input.abortSignal,
      },
    );
    let continuationRef: string | null = input.continuationRef;
    let confirmedProviderSubmit: ConfirmedProviderSubmitReceipt | null = null;
    const observedCalls = new Map<string, ProductGptCallInput & Readonly<{ sessionKey: string }>>();
    const readCallFacts = async (call: ProductGptFactQuery): Promise<ExactGptCallFacts> => {
      const facts = await this.readCallFacts(input, call);
      confirmedProviderSubmit = mergeConfirmedProviderSubmitReceipt(
        confirmedProviderSubmit,
        confirmedProviderSubmitReceipt(call, facts),
      );
      return productSafeExactGptCallFacts(facts);
    };
    const readConfirmedSubmitFailure: ProductGptTools["readConfirmedSubmitFailure"] = async (call) => {
      const receipt = await readConfirmedProviderSubmitFailureReceipt({
        call,
        intent: this.intentFor(input, call),
        browserAuthority: this.browserAuthority,
        evidenceStore: this.evidenceStore,
      });
      if (!receipt) return null;
      confirmedProviderSubmit = mergeConfirmedProviderSubmitReceipt(
        confirmedProviderSubmit,
        receipt.provider,
      );
      authorizeConfirmedProviderFailureReadback({ browsers, receipt: receipt.provider });
      return receipt.product;
    };
    const execute = async <K extends GptChildCapabilityId>(
      call: ProductGptCallInput<K> & Readonly<{ sessionKey: string }>,
    ): Promise<ProductGptChildResult<K>> => {
      this.assertExecutionActive(input);
      observedCalls.set(hashCanonical(call), call);
      const completed = await this.completedTaskExactEffect(input, call, readCallFacts);
      if (completed) {
        authorizeConfirmedProviderReadback({ browsers, call, result: completed, receipt: confirmedProviderSubmit });
        return completed;
      }
      const result = await this.executeOne(input, browsers, call);
      authorizeConfirmedProviderReadback({ browsers, call, result, receipt: confirmedProviderSubmit });
      if ((call.child === "persist_gpt_continuation"
        || call.child === "complete_exact_gpt_continuation_reservation_once") && result.value
        && typeof result.value === "object" && !Array.isArray(result.value)) {
        const value = Reflect.get(result.value, "continuationRef");
        if (value !== null && (typeof value !== "string" || value.length === 0)) {
          throw executionFailure("failed", "GPT_CONTINUATION_REF_INVALID");
        }
        continuationRef = value as string | null;
      }
      return result as ProductGptChildResult<K>;
    };
    return Object.freeze({
      tools: Object.freeze({
        attemptId: input.attemptId,
        readContinuationExact: (query: ExactGptContinuationQuery) =>
          this.continuationReadback.readExact({
            jobId: input.jobId,
            continuationRef: input.continuationRef,
            ownerRef: input.ownerRef,
            subjectRef: input.subjectRef,
            authorizationRef: input.authorizationRef,
            pluginId: input.pluginId,
            pluginVersion: input.pluginVersion,
          }, query),
        execute,
        readCallFacts,
        readConfirmedSubmitFailure,
      }),
      continuationRef: () => continuationRef,
      reconcilePermanentCancellation: () => this.reconcileObservedCalls(
        input, browsers, observedCalls, readCallFacts,
      ),
      settle: (error) => browsers.settle(error),
    });
  }

  private async completedTaskExactEffect<K extends GptChildCapabilityId>(
    input: ExecutionInput,
    call: ProductGptCallInput<K> & Readonly<{ sessionKey: string }>,
    readCallFacts: (query: ProductGptFactQuery) => Promise<ExactGptCallFacts>,
  ): Promise<ProductGptChildResult<K> | null> {
    if (call.effectLookupKind !== "task_exact_effect") return null;
    const current = await readCallFacts(call);
    if (current.mutation || current.evidence) return null;
    const prior = await readCallFacts({ ...call, lookupKind: "task_exact_effect" });
    if (!prior.mutation && !prior.evidence) return null;
    const span = this.childSpan(input, this.intentFor(input, call));
    const completed = await readCompletedGptChildResult({
      call, facts: prior, evidenceStore: this.evidenceStore,
      onSuccess: () => { requireRuntimeLogWrite(span.terminal({ outcome: "succeeded" })); },
    });
    if (!completed) throw executionFailure("failed", "GPT_TASK_EXACT_EFFECT_READBACK_MISSING");
    return completed as ProductGptChildResult<K>;
  }
  private assertExecutionActive(input: ExecutionInput): void {
    if (!input.abortSignal.aborted) return;
    throw executionFailure("failed", typeof input.abortSignal.reason === "string"
      ? input.abortSignal.reason : "PRODUCTION_EXECUTION_ABORTED");
  }

  private async reconcileObservedCalls(
    input: ExecutionInput,
    browsers: ProductionGptBrowserLifecycle,
    observedCalls: ReadonlyMap<string, ProductGptCallInput & Readonly<{ sessionKey: string }>>,
    readCallFacts: (call: ProductGptFactQuery) => Promise<ExactGptCallFacts>,
  ): Promise<void> {
    for (const call of observedCalls.values()) {
      const facts = await readCallFacts(call);
      if (facts.mutation?.outcome !== "DISPATCHED") continue;
      const remaining = Math.floor(input.expiresAtMonotonic - performance.now());
      if (remaining < 1) throw executionFailure("failed", "V6_DEADLINE_BUDGET_EXHAUSTED");
      await this.executeOne(
        input, browsers, call, AbortSignal.timeout(Math.min(20_000, remaining)),
      );
    }
  }
  private intentForAttempt<K extends GptChildCapabilityId>(
    execution: ExecutionInput,
    call: ProductGptCallInput<K>,
    attemptId: string,
  ): GptChildCapabilityIntent<K> {
    const inputHash = hashCanonical(call.input);
    const identity = {
      jobId: execution.jobId,
      attemptId,
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
  private intentFor<K extends GptChildCapabilityId>(
    execution: ExecutionInput,
    call: ProductGptCallInput<K>,
  ): GptChildCapabilityIntent<K> {
    return this.intentForAttempt(execution, call, execution.attemptId);
  }
  private async readCallFacts(
    execution: ExecutionInput,
    query: ProductGptFactQuery,
  ): Promise<GptExactCallFactsWithBrowserBinding> {
    return readTaskExactGptCallFacts({
      query,
      currentAttemptId: execution.attemptId,
      attemptIds: this.runtime.attemptIdsForTask(execution.jobId),
      intentForAttempt: (call, attemptId) => this.intentForAttempt(execution, call, attemptId),
      readIntentFacts: (intent) => this.readIntentFacts(intent),
    });
  }
  private async readIntentFacts(
    intent: GptChildCapabilityIntent,
  ): Promise<GptExactCallFactsWithBrowserBinding> {
    return readProductionGptCallFacts({
      browserAuthority: this.browserAuthority,
      evidenceStore: this.evidenceStore,
      store: this.runtime.continuationStore,
    }, intent as GptAnyChildCapabilityIntent);
  }

  private childSpan(input: ExecutionInput, intent: GptChildCapabilityIntent): RuntimeSpanHandle {
    return requireRuntimeLogWrite(this.runtimeLogger.startSpan({
      traceId: input.jobId,
      parentSpanId: input.parentSpanId,
      boundaryId: intent.executionId,
      owner: "gpt",
      component: "gpt-child",
      operation: "gpt.child",
      typedIdentity: {
        kind: "gpt-call",
        jobId: input.jobId,
        attemptId: input.attemptId,
        pluginId: input.pluginId,
        pluginVersion: input.pluginVersion,
        stepId: intent.productStepId,
        capabilityCallId: `${intent.callId}:${intent.childCapabilityId}`,
      },
    }));
  }

  private terminalize(span: RuntimeSpanHandle, result: GptChildCapabilityResult): void {
    const native = result.failureCause ? Object.assign(new Error(result.failureCause.name), {
      name: result.failureCause.name,
      ...(result.failureCause.code ? { code: result.failureCause.code } : {}),
    }) : undefined;
    const failure = executionFailure("failed", result.failureCode ?? "GPT_CHILD_FAILED", {
      ...(native ? { cause: native } : {}),
    });
    const terminal = result.status === "success"
      ? requireRuntimeLogWrite(span.terminal({ outcome: "succeeded" }))
      : requireRuntimeLogWrite(span.terminal({
        outcome: "failed",
        failure: runtimeFailureFromError({
          error: failure,
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
        code: failureCode(failure, "GPT_CHILD_RUNTIME_FAILED"),
        responsibleOwner: "gpt",
        impact: RuntimeFailureImpact.BLOCKING,
      }),
    }));
    const propagated = error instanceof AggregateError && error.cause !== undefined
      ? error : failure;
    throw withRuntimeLogCause(propagated, terminal.eventId);
  }

  private assertProviderTurnBudget(
    execution: ExecutionInput,
    call: ProductGptCallInput,
    facts: ExactGptCallFacts,
  ): void {
    if (call.child !== "submit_exact_gpt_turn_once"
      || facts.mutation !== null || facts.evidence !== null) return;
    const dispatched = this.browserAuthority.countProviderTurnDispatches(
      execution.jobId,
      execution.attemptId,
    );
    if (dispatched >= execution.maxProviderTurns) {
      throw executionFailure("failed", "PROVIDER_TURN_BUDGET_EXHAUSTED");
    }
  }

  private async executeOne<K extends GptChildCapabilityId>(
    execution: ExecutionInput,
    browsers: ProductionGptBrowserLifecycle,
    call: ProductGptCallInput<K> & Readonly<{ sessionKey: string }>,
    signal: AbortSignal = execution.abortSignal,
  ): Promise<ProductGptChildResult<K>> {
    const intent = this.intentFor(execution, call);
    const facts = await this.readIntentFacts(intent);
    const contract = GPT_CHILD_CAPABILITY_CONTRACTS[call.child];
    const span = this.childSpan(execution, intent);
    let result: GptChildCapabilityResult;
    let evidenceRef: string;
    let evidenceHash: GptHash;
    let resolveDispatched = false;
    try {
      if (facts.mutation?.outcome === "REJECTED") throwRejectedMutation(facts, intent);
      const completed = await readCompletedGptChildResult({
        call, facts, evidenceStore: this.evidenceStore,
        onSuccess: () => {
          requireRuntimeLogWrite(span.terminal({ outcome: "succeeded" }));
        },
      });
      if (completed) return completed as ProductGptChildResult<K>;
      const browserCall = contract.requiredTargetKind === "chatgpt"
        ? await browsers.browserFor(call.sessionKey, call.productStepId, call.callId)
        : undefined;
      const browser = browserCall?.facade;
      this.assertProviderTurnBudget(execution, call, facts);
      const atomic = await executeProductionGptAtomicCall({
        dataDir: this.dataDir,
        gpt: this.gpt,
        store: this.runtime.continuationStore,
        browsers,
        intent: intent as GptAnyChildCapabilityIntent,
        browserCall,
        signal,
      });
      result = atomic.result;
      resolveDispatched = atomic.resolveDispatched;
      const pendingEvidence = isPendingExactEvidence(facts.evidence);
      if (facts.evidence && (!pendingEvidence || result.proof.postconditionResult === "pending")) {
        evidenceRef = facts.evidence.evidenceRef;
        evidenceHash = facts.evidence.evidenceHash;
      } else {
        const persisted = await persistGptChildEvidence({
          result, intent, evidenceStore: this.evidenceStore,
          jobId: execution.jobId, attemptId: execution.attemptId,
          stepId: call.productStepId, exactCallIdentityHash: facts.exactCallIdentityHash,
          settlesPendingEvidence: pendingEvidence,
        });
        evidenceRef = persisted.evidenceRef;
        evidenceHash = result.proof.evidenceHash;
      }
      await this.resolveDispatchedMutation({
        execution, browser, result, evidenceRef, resolveDispatched,
      });
    } catch (error) {
      return this.terminalizeError(span, error);
    }
    this.terminalize(span, result);
    if (result.status !== "success") throwGptChildFailure(result);
    return Object.freeze({
      value: result.value as ProductGptChildResult<K>["value"],
      evidenceRef,
      evidenceHash,
    });
  }

  private async resolveDispatchedMutation(input: Readonly<{
    execution: ExecutionInput;
    browser: BrowserTargetLease | undefined;
    result: GptChildCapabilityResult;
    evidenceRef: string;
    resolveDispatched: boolean;
  }>): Promise<void> {
    if (!input.resolveDispatched || !input.browser || input.result.status !== "success") return;
    await input.browser.resolvePendingMutation({
      schemaVersion: "grasseye.browser.outcome-resolution.v1",
      ownerPluginId: input.execution.pluginId,
      outcome: "TERMINAL_SUCCESS",
      mutationOutcome: "dispatched",
      positiveEvidenceRef: `${input.evidenceRef}#positive-postcondition`,
      negativeEvidenceRef: `${input.evidenceRef}#negative-postcondition-absent`,
      uniqueTargetRef: input.browser.target.targetRef,
      boundedAt: new Date().toISOString(),
    });
  }

}
