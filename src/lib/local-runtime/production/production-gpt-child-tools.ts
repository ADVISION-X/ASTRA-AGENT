import {
  GPT_CHILD_CAPABILITY_CONTRACTS,
  gptExactCallIdentityHash,
  type GptAbilityGroup,
  type GptChildCapabilityIntent,
  type GptChildCapabilityResult,
} from "../../../capabilities/gpt/index.js";
import type { ForensicsPersistenceAbilityGroup } from "../../../capabilities/forensics-persistence/index.js";
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
import type { BrowserConfirmedProviderReadbackAuthorization } from "../../browser/browser-authority-api.js";
import { hashCanonical, sha256, type ProductionHash, type WebsiteAgentTask } from "./contracts.js";
import type {
  ExactGptCallFacts,
  ExactGptContinuationQuery,
  ProductGptCallInput,
  ProductGptFactQuery,
  ProductGptChildResult,
  ProductGptTools,
} from "./plugin.js";
import { ProductionRuntimeStore } from "./store.js";
import {
  childFailureEventIds,
  persistGptChildEvidence,
} from "./gpt-evidence-writer.js";
import {
  ProductionGptBrowserLifecycle,
  recoveredGptChildResult,
  type ProductionGptBrowserCall,
} from "./production-gpt-browser-lifecycle.js";
import {
  isPendingExactEvidence,
  productSafeExactGptCallFacts,
  readProductionGptCallFacts,
  type RuntimeExactGptCallFacts,
} from "./production-gpt-call-facts.js";
import { ProductionGptContinuationReadback } from "./production-gpt-continuation-readback.js";
import { readCompletedGptChildResult } from "./production-gpt-completed-result.js";
import { gptSubmissionLocatorArtifact } from "./gpt-artifact-contract.js";
import {
  throwGptChildFailure,
  type ConfirmedProviderSubmitReceipt,
  type GptChildExecutionInput as ExecutionInput,
  type ProductGptExecution,
} from "./production-gpt-child-support.js";

export type { ProductGptExecution } from "./production-gpt-child-support.js";
export class ProductionGptChildTools {
  private readonly continuationReadback: ProductionGptContinuationReadback;

  public constructor(
    private readonly dataDir: string,
    private readonly sourceHash: ProductionHash,
    private readonly gpt: GptAbilityGroup,
    private readonly evidenceStore: ForensicsPersistenceAbilityGroup,
    private readonly browserAuthority: WorkbenchBrowserAuthority,
    private readonly store: ProductionRuntimeStore,
    private readonly runtimeLogger: RuntimeLogger,
  ) {
    this.continuationReadback = new ProductionGptContinuationReadback(evidenceStore, store);
  }
  public createExecution(input: ExecutionInput): ProductGptExecution {
    const browsers = new ProductionGptBrowserLifecycle(
      this.browserAuthority,
      this.runtimeLogger,
      this.sourceHash,
      input,
    );
    let continuationRef: string | null = input.task.continuation_ref ?? null;
    let confirmedProviderSubmit: ConfirmedProviderSubmitReceipt | null = null;
    const observedCalls = new Map<string, ProductGptCallInput & Readonly<{ sessionKey: string }>>();
    const readCallFacts = async (call: ProductGptFactQuery): Promise<ExactGptCallFacts> => {
      const facts = await this.readCallFacts(input, call);
      const receipt = this.confirmedProviderSubmitReceipt(call, facts);
      if (receipt) {
        if (confirmedProviderSubmit
          && confirmedProviderSubmit.sourceProductStepId === receipt.sourceProductStepId
          && hashCanonical(confirmedProviderSubmit) !== hashCanonical(receipt)) {
          throw executionFailure("failed", "BROWSER_RECONCILIATION_SCOPE_INVALID");
        }
        confirmedProviderSubmit = receipt;
      }
      return productSafeExactGptCallFacts(facts);
    };
    const execute = async (call: Parameters<ProductGptTools["execute"]>[0]): Promise<ProductGptChildResult> => {
      if (input.lease.abort_signal.aborted) {
        throw executionFailure("failed", typeof input.lease.abort_signal.reason === "string"
          ? input.lease.abort_signal.reason : "PRODUCTION_EXECUTION_ABORTED");
      }
      observedCalls.set(hashCanonical(call), call);
      if (call.effectLookupKind === "task_exact_effect") {
        const current = await readCallFacts(call);
        if (!current.mutation && !current.evidence) {
          const prior = await readCallFacts({ ...call, lookupKind: "task_exact_effect" });
          if (prior.mutation || prior.evidence) {
            const span = this.childSpan(input, this.intentFor(input, call));
            const completed = await readCompletedGptChildResult({
              call, facts: prior, span,
              browserMutation: true, evidenceStore: this.evidenceStore,
            });
            if (!completed) throw executionFailure("failed", "GPT_TASK_EXACT_EFFECT_READBACK_MISSING");
            return completed;
          }
        }
      }
      const result = await this.executeOne(input, browsers, call);
      this.authorizeConfirmedProviderReadback(
        browsers,
        call,
        result,
        confirmedProviderSubmit,
      );
      if ((call.child === "persist_gpt_continuation"
        || call.child === "complete_exact_gpt_continuation_reservation_once") && result.value
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
        readContinuationExact: (query: ExactGptContinuationQuery) =>
          this.continuationReadback.readExact(input, query),
        execute,
        readCallFacts,
      }),
      continuationRef: () => continuationRef,
      reconcilePermanentCancellation: async () => {
        for (const call of observedCalls.values()) {
          const facts = await readCallFacts(call);
          if (facts.mutation?.outcome !== "DISPATCHED") continue;
          const remaining = Math.floor(input.lease.expires_at_monotonic - performance.now());
          if (remaining < 1) throw executionFailure("failed", "V6_DEADLINE_BUDGET_EXHAUSTED");
          await this.executeOne(
            input,
            browsers,
            call,
            AbortSignal.timeout(Math.min(20_000, remaining)),
          );
        }
      },
      settle: (error) => browsers.settle(error),
    });
  }
  private intentForAttempt(
    execution: ExecutionInput,
    call: ProductGptCallInput,
    attemptId: string,
  ): GptChildCapabilityIntent {
    const inputHash = hashCanonical(call.input);
    const identity = {
      jobId: execution.task.job_id,
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
  private intentFor(execution: ExecutionInput, call: ProductGptCallInput): GptChildCapabilityIntent {
    return this.intentForAttempt(execution, call, execution.lease.attempt_id);
  }
  private async readCallFacts(
    execution: ExecutionInput,
    query: ProductGptFactQuery,
  ): Promise<RuntimeExactGptCallFacts> {
    const { lookupKind = "current_attempt", ...call } = query;
    if (lookupKind === "current_attempt") {
      return this.readIntentFacts(this.intentFor(execution, call));
    }
    if (call.child !== "submit_exact_gpt_turn_once"
      && call.child !== "fork_exact_gpt_conversation_at_checkpoint") {
      throw executionFailure("failed", "GPT_TASK_EXACT_EFFECT_CHILD_INVALID");
    }
    const currentFacts = await this.readIntentFacts(this.intentFor(execution, call));
    if (currentFacts.mutation || currentFacts.evidence) {
      throw executionFailure("failed", "GPT_TASK_EXACT_EFFECT_CURRENT_ATTEMPT_PRESENT");
    }
    const candidates: RuntimeExactGptCallFacts[] = [];
    for (const attemptId of this.store.attemptIdsForTask(execution.task.job_id)) {
      if (attemptId === execution.lease.attempt_id) continue;
      const facts = await this.readIntentFacts(this.intentForAttempt(execution, call, attemptId));
      if (isPendingExactEvidence(facts.evidence)) {
        throw executionFailure("failed", "GPT_TASK_EXACT_EFFECT_PENDING");
      }
      if (facts.mutation || facts.evidence) candidates.push(facts);
    }
    if (candidates.length > 1) {
      throw executionFailure("failed", "GPT_TASK_EXACT_EFFECT_AMBIGUOUS");
    }
    const facts = candidates[0] ?? currentFacts;
    return facts;
  }

  private confirmedProviderSubmitReceipt(
    call: ProductGptCallInput,
    facts: RuntimeExactGptCallFacts,
  ): ConfirmedProviderSubmitReceipt | null {
    if (call.child !== "submit_exact_gpt_turn_once") return null;
    const mutation = facts.mutation;
    const evidence = facts.evidence;
    if (mutation?.effectScope !== "provider_effect"
      || mutation.outcome !== "CONFIRMED"
      || !mutation.terminalAt
      || evidence?.readbackVerified !== true) return null;
    if (mutation.productStepId !== call.productStepId
      || mutation.callId !== call.callId
      || mutation.childCapabilityId !== call.child
      || mutation.actionOrdinal !== call.actionOrdinal) {
      throw executionFailure("failed", "BROWSER_RECONCILIATION_SCOPE_INVALID");
    }
    const promptHash = call.input.promptHash;
    const turnMarker = call.input.turnMarker;
    if (typeof promptHash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(promptHash)
      || typeof turnMarker !== "string" || !turnMarker) {
      throw executionFailure("failed", "BROWSER_RECONCILIATION_SCOPE_INVALID");
    }
    return Object.freeze({
      sourceAttemptId: mutation.sourceAttemptId,
      sourceExactCallIdentityHash: facts.exactCallIdentityHash,
      sourceActionOrdinal: mutation.actionOrdinal,
      sourceProductStepId: mutation.productStepId,
      sourceCallId: mutation.callId,
      sourceChildCapabilityId: "submit_exact_gpt_turn_once",
      sourceTargetRef: mutation.targetRef,
      sourceDocumentRef: mutation.documentRef,
      sourceTerminalAt: mutation.terminalAt,
      evidenceRef: evidence.evidenceRef,
      evidenceHash: evidence.evidenceHash,
      promptHash: promptHash as ProductionHash,
      turnMarker,
    });
  }

  private authorizeConfirmedProviderReadback(
    browsers: ProductionGptBrowserLifecycle,
    call: ProductGptCallInput,
    result: ProductGptChildResult,
    receipt: ConfirmedProviderSubmitReceipt | null,
  ): void {
    if (!receipt || call.child !== "reconcile_gpt_turn_submission"
      || call.productStepId !== receipt.sourceProductStepId) return;
    const locatorValue = result.value && typeof result.value === "object"
      && !Array.isArray(result.value)
      ? { ...result.value, schemaVersion: "agent-gpt-submission-locator.v1" }
      : result.value;
    const locator = gptSubmissionLocatorArtifact(locatorValue, sha256);
    if (!locator
      || locator.promptHash !== receipt.promptHash
      || locator.turnMarker !== receipt.turnMarker) {
      throw executionFailure("failed", "BROWSER_RECONCILIATION_SCOPE_INVALID");
    }
    const authorization: BrowserConfirmedProviderReadbackAuthorization = Object.freeze({
      schemaVersion: "browser-confirmed-provider-readback.v1",
      ...receipt,
      sourceChildCapabilityId: "submit_exact_gpt_turn_once",
      canonicalConversationUrl: locator.canonicalConversationUrl,
      conversationIdentityHash: locator.conversationIdentityHash,
    });
    // Runtime alone combines the confirmed Browser/Forensics receipt with the durable locator.
    browsers.authorizeConfirmedProviderReadback(authorization);
  }
  private async readIntentFacts(
    intent: GptChildCapabilityIntent,
  ): Promise<RuntimeExactGptCallFacts> {
    return readProductionGptCallFacts({
      browserAuthority: this.browserAuthority,
      evidenceStore: this.evidenceStore,
      store: this.store,
    }, intent);
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
      execution.task.job_id,
      execution.lease.attempt_id,
    );
    if (dispatched >= execution.lease.max_provider_turns) {
      throw executionFailure("failed", "PROVIDER_TURN_BUDGET_EXHAUSTED");
    }
  }

  private async executeOne(
    execution: ExecutionInput,
    browsers: ProductionGptBrowserLifecycle,
    call: Parameters<ProductGptTools["execute"]>[0],
    signal: AbortSignal = execution.lease.abort_signal,
  ): Promise<ProductGptChildResult> {
    const intent = this.intentFor(execution, call);
    const facts = await this.readIntentFacts(intent);
    const contract = GPT_CHILD_CAPABILITY_CONTRACTS[call.child];
    const span = this.childSpan(execution, intent);
    let result: GptChildCapabilityResult;
    let evidenceRef: string;
    let evidenceHash: ProductionHash;
    let resolveDispatched = false;
    try {
      if (facts.mutation?.outcome === "REJECTED") {
        throw executionFailure("failed", "BROWSER_POSTCONDITION_FAILED", {
          evidenceRef: facts.evidence?.evidenceRef ?? null,
          evidenceHash: facts.evidence?.evidenceHash ?? null,
        });
      }
      const browserMutation = contract.requiredTargetKind === "chatgpt"
        && contract.oneObservationOrMutation === "at-most-one-mutation";
      const completed = await readCompletedGptChildResult({ call, facts, span, browserMutation,
        evidenceStore: this.evidenceStore });
      if (completed) return completed;
      const browserCall = contract.requiredTargetKind === "chatgpt"
        ? await browsers.browserFor(call.sessionKey, call.productStepId, call.callId)
        : undefined;
      const browser = browserCall?.facade;
      this.assertProviderTurnBudget(execution, call, facts);
      const atomic = await this.runAtomic(
        browsers,
        intent,
        browserCall,
        signal,
      );
      result = atomic.result;
      resolveDispatched = atomic.resolveDispatched;
      const pendingEvidence = isPendingExactEvidence(facts.evidence);
      if (facts.evidence && (!pendingEvidence || result.proof.postconditionResult === "pending")) {
        evidenceRef = facts.evidence.evidenceRef;
        evidenceHash = facts.evidence.evidenceHash;
      } else {
        const persisted = await persistGptChildEvidence({
          result, intent, evidenceStore: this.evidenceStore,
          jobId: execution.task.job_id, attemptId: execution.lease.attempt_id,
          stepId: call.productStepId, exactCallIdentityHash: facts.exactCallIdentityHash,
          settlesPendingEvidence: pendingEvidence,
        });
        evidenceRef = persisted.evidenceRef;
        evidenceHash = result.proof.evidenceHash;
      }
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
    if (result.status !== "success") throwGptChildFailure(result);
    return Object.freeze({
      value: result.value,
      evidenceRef,
      evidenceHash,
    });
  }

  private async runAtomic(
    browsers: ProductionGptBrowserLifecycle,
    intent: GptChildCapabilityIntent,
    browserCall: ProductionGptBrowserCall | undefined,
    signal: AbortSignal,
  ): Promise<Readonly<{ result: GptChildCapabilityResult; resolveDispatched: boolean }>> {
    const browser = browserCall?.facade;
    const context = {
      dataDir: this.dataDir,
      ...(browser ? { browser } : {}),
      signal,
      continuationStore: this.store,
      ...(browserCall ? {
        yieldForProviderWait: (durationMs: number) => browsers.yieldForProviderWait(
          browserCall, intent.productStepId, intent.callId,
          intent.childCapabilityId, durationMs,
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
        result: recoveredGptChildResult({
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
      result: recoveredGptChildResult({
        intent,
        browser,
        readback,
        authorityRef: recovery.authorityRef,
        state: "confirmed",
      }),
      resolveDispatched: recovery.state === "dispatched",
    };
  }

}
