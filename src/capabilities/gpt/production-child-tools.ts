import {
  GPT_CHILD_CAPABILITY_CONTRACTS,
  type GptAbilityGroup,
  type GptAnyChildCapabilityIntent,
  type GptChildBrowserFact,
  type GptChildCapabilityId,
  type GptChildCapabilityIntent,
  type GptChildCapabilityResult,
} from "./contract.js";
import { gptExactCallIdentityHash } from "./contract.js";
import { gptCanonicalHash } from "./contract.js";
import {
  RuntimeFailureImpact,
  requireRuntimeLogWrite,
  runtimeLogCauseEventId,
  runtimeFailureFromError,
  withRuntimeLogCause,
  type RuntimeLogger,
  type RuntimeSpanHandle,
} from "../../lib/runtime-logs/index.js";
import { executionFailure, failureCode, typedExecutionFailure } from "../../lib/execution-failure.js";
import {
  browserExactCallIdentityHash,
  type BrowserExactCallMutationFact,
  type BrowserTargetLease,
} from "../../lib/browser/browser-authority-api.js";
import type { ProductGptCallInput, ProductGptChildResult } from "./product-api.js";
import type { GptHash } from "./contract.js";
import { persistGptEvidenceArtifacts, readPersistedGptTextResponse } from "./evidence-artifacts.js";
import {
  ProductionGptBrowserLifecycle,
  type ProductionGptBrowserCall,
} from "./production-browser-lifecycle.js";
import { executeProductionGptAtomicCall, productionGptAtomicIdentity } from "./production-atomic-call.js";
import { gptExecutionFailure } from "./execution-fault.js";
import type {
  GptEvidenceStorePort,
  GptProductionBrowserAuthority,
} from "./production-ports.js";
import {
  throwGptChildFailure,
  type GptProductionExecutionInput as ExecutionInput,
  type ProductGptExecution,
} from "./production-child-support.js";

export type { ProductGptExecution } from "./production-child-support.js";

const confirmedSubmitEffect = (
  prior: BrowserExactCallMutationFact,
  exactCallIdentityHash: GptHash,
  childCapabilityId: "submit_exact_gpt_turn_once",
): GptChildBrowserFact => {
  if (prior.effectScope !== "provider_effect" || prior.outcome !== "CONFIRMED"
    || prior.mutationOutcome !== "confirmed"
    || !prior.providerEffectIdentityHash || !prior.terminalAt) {
    throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH");
  }
  return Object.freeze({ exactCallIdentityHash, providerEffectIdentityHash: prior.providerEffectIdentityHash,
    childCapabilityId, effectScope: "provider_effect", browserOutcome: "CONFIRMED",
    mutationOutcome: "confirmed", terminalAt: prior.terminalAt,
    evidenceRef: prior.authorityRef, evidenceHash: prior.authorityHash });
};

const recordConfirmedSubmission = async (
  call: ProductGptCallInput,
  result: GptChildCapabilityResult,
  intent: GptAnyChildCapabilityIntent,
  execution: ExecutionInput,
  browsers: ProductionGptBrowserLifecycle,
  browserCall: ProductionGptBrowserCall | undefined,
): Promise<void> => {
  if (call.child !== "submit_exact_gpt_turn_once" || result.status !== "success") return;
  const effect = result.proof.browserFact;
  if (effect?.effectScope !== "provider_effect" || effect.browserOutcome !== "CONFIRMED"
    || !effect.providerEffectIdentityHash) {
    throw executionFailure("failed", "GPT_PROVIDER_EFFECT_IDENTITY_MISSING");
  }
  const submitted = result.value as Readonly<Record<string, unknown>>;
  if (typeof submitted.canonicalConversationUrl !== "string" || typeof submitted.userTurnId !== "string") {
    throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_READBACK_INVALID");
  }
  if (!browserCall) throw executionFailure("failed", "GPT_BROWSER_REQUIRED");
  await browsers.recordConfirmedProviderEffect(
    browserCall, effect, productionGptAtomicIdentity(intent, execution.resultRevision),
    submitted.canonicalConversationUrl, submitted.userTurnId,
  );
};

const recordSettledProviderResult = (
  call: ProductGptCallInput,
  value: unknown,
  browsers: ProductionGptBrowserLifecycle,
  browserCall: ProductionGptBrowserCall | undefined,
): void => {
  const readsConfirmedEffect = call.child === "checkpoint_gpt_text_response"
    || call.child === "checkpoint_gpt_generated_image";
  if (!readsConfirmedEffect || !browserCall) return;
  const row = value as Readonly<Record<string, unknown>>;
  const payloadHash = call.child === "checkpoint_gpt_text_response" ? row.semanticTextHash : row.sha256;
  if (typeof payloadHash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(payloadHash)) {
    throw executionFailure("failed", "GPT_SETTLED_RESULT_PAYLOAD_HASH_INVALID");
  }
  browsers.recordSettledResult(browserCall, payloadHash as GptHash);
};

const productChildResult = <K extends GptChildCapabilityId>(input: Readonly<{
  execution: ExecutionInput;
  intent: GptChildCapabilityIntent<K>;
  value: unknown;
  browserFact: GptChildBrowserFact | null;
  evidenceRef: string;
  evidenceHash: GptHash;
  artifactRefs: readonly string[];
}>): ProductGptChildResult<K> => Object.freeze({
  value: input.value as ProductGptChildResult<K>["value"],
  evidenceRef: input.evidenceRef,
  evidenceHash: input.evidenceHash,
  sourceAttemptId: input.execution.attemptId,
  exactCallIdentityHash: gptExactCallIdentityHash(input.intent),
  artifactRefs: input.artifactRefs,
  effectReceipt: input.browserFact ? Object.freeze({
    effectScope: input.browserFact.effectScope,
    providerEffectIdentityHash: input.browserFact.providerEffectIdentityHash,
    outcome: input.browserFact.browserOutcome,
    mutationOutcome: input.browserFact.mutationOutcome,
    terminalAt: input.browserFact.terminalAt,
    evidenceRef: input.browserFact.evidenceRef,
    evidenceHash: input.browserFact.evidenceHash,
  }) : null,
});

export class ProductionGptChildTools {
  public constructor(
    private readonly dataDir: string,
    private readonly sourceHash: GptHash,
    private readonly gpt: GptAbilityGroup,
    private readonly evidenceStore: GptEvidenceStorePort,
    private readonly browserAuthority: GptProductionBrowserAuthority,
    private readonly runtimeLogger: RuntimeLogger,
  ) {}
  private browserLifecycle(input: ExecutionInput): ProductionGptBrowserLifecycle {
    return new ProductionGptBrowserLifecycle(
      this.browserAuthority,
      this.runtimeLogger,
      this.sourceHash,
      {
        jobId: input.jobId,
        attemptId: input.attemptId,
        resultRevision: input.resultRevision,
        deviceId: input.deviceId,
        leaseVersion: input.leaseVersion,
        executionFenceHash: input.executionFenceHash,
        capabilityManifestHash: input.capabilityManifestHash,
        get expiresAtMonotonic() { return input.expiresAtMonotonic; },
        get commandTtlMs() { return input.commandTtlMs; },
        abortSignal: input.abortSignal,
      },
    );
  }
  public createExecution(input: ExecutionInput): ProductGptExecution {
    const browsers = this.browserLifecycle(input);
    const execute = async <K extends GptChildCapabilityId>(
      call: ProductGptCallInput<K> & Readonly<{ sessionKey: string }>,
    ): Promise<ProductGptChildResult<K>> => {
      this.assertExecutionActive(input);
      const result = await this.executeOne(
        input, browsers, call, input.abortSignal,
      );
      return result as ProductGptChildResult<K>;
    };
    return Object.freeze({
      tools: Object.freeze({
        jobId: input.jobId,
        attemptId: input.attemptId,
        execute,
        readConfirmedSubmit: async (
          call: ProductGptCallInput<"submit_exact_gpt_turn_once"> & Readonly<{ sessionKey: string }>,
        ): Promise<ProductGptChildResult<"submit_exact_gpt_turn_once"> | null> => {
          this.assertExecutionActive(input);
          const intent = this.intentFor(input, call);
          const atomicIdentity = productionGptAtomicIdentity(
            intent as GptAnyChildCapabilityIntent, input.resultRevision,
          );
          const exactCallIdentityHash = browserExactCallIdentityHash({
            jobId: input.jobId, attemptId: input.attemptId,
            writerFenceHash: input.executionFenceHash,
            ...atomicIdentity,
          });
          const prior = this.browserAuthority.readExactCallMutationFact({
            jobId: input.jobId, attemptId: input.attemptId,
            exactCallIdentityHash, actionOrdinal: call.actionOrdinal,
          });
          if (!prior) return null;
          if (prior.productStepId !== call.productStepId || prior.callId !== call.callId
            || prior.childCapabilityId !== call.child) {
            throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH");
          }
          const effect = confirmedSubmitEffect(prior, exactCallIdentityHash, call.child);
          try {
            const active = await browsers.browserForConfirmedReadback(
              call.sessionKey, call.productStepId, call.callId,
            );
            if (!active.facade.readAtomicStepOutcome(atomicIdentity)) return null;
            return await this.executeOne<"submit_exact_gpt_turn_once">(
              input, browsers, call, input.abortSignal, true,
            );
          } catch (error) {
            throw gptExecutionFailure(failureCode(error, "GPT_CONFIRMED_SUBMIT_READBACK_FAILED"), {
              mutationOutcome: "confirmed", evidence: {
                evidenceRef: effect.evidenceRef, evidenceHash: effect.evidenceHash,
              }, browserEffect: effect, cause: error,
            });
          }
        },
      }),
      decorateSettledResultFailure: (error) => browsers.decorateSettledResultFailure(error),
      settle: (error) => browsers.settle(error),
    });
  }

  private assertExecutionActive(input: ExecutionInput): void {
    if (!input.abortSignal.aborted) return;
    throw executionFailure("failed", typeof input.abortSignal.reason === "string"
      ? input.abortSignal.reason : "PRODUCTION_EXECUTION_ABORTED");
  }

  private intentForAttempt<K extends GptChildCapabilityId>(
    execution: ExecutionInput,
    call: ProductGptCallInput<K>,
    attemptId: string,
  ): GptChildCapabilityIntent<K> {
    const inputHash = gptCanonicalHash(call.input);
    const identity = {
      jobId: execution.jobId,
      attemptId,
      resultRevision: execution.resultRevision,
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
        stepId: intent.productStepId,
        capabilityCallId: `${intent.callId}:${intent.childCapabilityId}`,
      },
    }));
  }

  private terminalize(span: RuntimeSpanHandle, result: GptChildCapabilityResult): string {
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
    return terminal.eventId;
  }

  private terminalizeError(
    span: RuntimeSpanHandle,
    error: unknown,
    confirmedProviderEffect?: ProductionGptBrowserCall["confirmedProviderEffect"],
  ): never {
    const causedByEventId = runtimeLogCauseEventId(error);
    const original = typedExecutionFailure(error) ?? executionFailure(
      "failed",
      failureCode(error, "GPT_CHILD_RUNTIME_FAILED"),
      { cause: error },
    );
    const failure = confirmedProviderEffect ? gptExecutionFailure(original.code, {
      mutationOutcome: "confirmed",
      evidence: {
        evidenceRef: confirmedProviderEffect.evidenceRef,
        evidenceHash: confirmedProviderEffect.evidenceHash,
      },
      browserEffect: confirmedProviderEffect,
      cause: original,
    }) : original;
    const terminal = requireRuntimeLogWrite(span.terminal({
      outcome: "failed",
      failure: runtimeFailureFromError({
        error: failure,
        code: failureCode(failure, "GPT_CHILD_RUNTIME_FAILED"),
        responsibleOwner: "gpt",
        impact: causedByEventId ? RuntimeFailureImpact.CONSEQUENTIAL : RuntimeFailureImpact.BLOCKING,
        ...(causedByEventId ? { causedByEventId } : {}),
      }),
    }));
    const propagated = error instanceof AggregateError && error.cause !== undefined
      ? error : failure;
    throw withRuntimeLogCause(propagated, terminal.eventId);
  }

  private assertProviderTurnBudget(
    execution: ExecutionInput,
    call: ProductGptCallInput,
  ): void {
    if (call.child !== "submit_exact_gpt_turn_once") return;
    const dispatched = this.browserAuthority.countProviderTurnDispatches(
      execution.jobId,
      execution.attemptId,
    );
    if (dispatched >= execution.maxProviderTurns) {
      throw executionFailure("failed", "PROVIDER_TURN_BUDGET_EXHAUSTED");
    }
  }

  private async executeOne<K extends GptChildCapabilityId>(execution: ExecutionInput,
    browsers: ProductionGptBrowserLifecycle,
    call: ProductGptCallInput<K> & Readonly<{ sessionKey: string }>, signal: AbortSignal = execution.abortSignal,
    priorEffectKnown = false,
  ): Promise<ProductGptChildResult<K>> {
    const intent = this.intentFor(execution, call);
    const contract = GPT_CHILD_CAPABILITY_CONTRACTS[call.child];
    const span = this.childSpan(execution, intent);
    let result: GptChildCapabilityResult | undefined;
    let evidenceRef: string;
    let evidenceHash: GptHash;
    let artifactRefs: readonly string[] = Object.freeze([]);
    let resolveDispatched = false;
    let browserCall: Awaited<ReturnType<ProductionGptBrowserLifecycle["browserFor"]>> | undefined;
    const readsConfirmedEffect = call.child === "checkpoint_gpt_text_response"
      || call.child === "checkpoint_gpt_generated_image";
    try {
      browserCall = contract.requiredTargetKind === "chatgpt"
        ? await browsers.browserFor(call.sessionKey, call.productStepId, call.callId)
        : undefined;
      if (call.child === "checkpoint_gpt_text_response" && browserCall?.confirmedProviderEffect) {
        const recovered = await readPersistedGptTextResponse({ evidenceStore: this.evidenceStore,
          jobId: execution.jobId, attemptId: execution.attemptId,
          exactCallIdentityHash: gptExactCallIdentityHash(intent) });
        if (recovered) {
          recordSettledProviderResult(call, recovered.value, browsers, browserCall);
          requireRuntimeLogWrite(span.terminal({ outcome: "succeeded" }));
          return productChildResult({ execution, intent, value: recovered.value, browserFact: null,
            evidenceRef: recovered.artifactRef, evidenceHash: recovered.integrityHash,
            artifactRefs: Object.freeze([recovered.artifactRef]) });
        }
      }
      const browser = browserCall?.facade;
      if (!priorEffectKnown) this.assertProviderTurnBudget(execution, call);
      const atomic = await executeProductionGptAtomicCall({
        dataDir: this.dataDir,
        gpt: this.gpt,
        browsers,
        intent: intent as GptAnyChildCapabilityIntent,
        browserCall,
        signal,
        resultRevision: execution.resultRevision,
      });
      result = atomic.result;
      await recordConfirmedSubmission(call, result, intent as GptAnyChildCapabilityIntent,
        execution, browsers, browserCall);
      resolveDispatched = atomic.resolveDispatched;
      artifactRefs = await persistGptEvidenceArtifacts({
        result, intent, evidenceStore: this.evidenceStore,
        jobId: execution.jobId, attemptId: execution.attemptId,
        exactCallIdentityHash: gptExactCallIdentityHash(intent),
      });
      evidenceRef = artifactRefs[0] ?? result.proof.browserFact?.evidenceRef ?? result.proof.evidenceRef;
      evidenceHash = result.proof.evidenceHash;
      await this.resolveDispatchedMutation({
        execution, browser, result, evidenceRef, resolveDispatched,
      });
    } catch (error) {
      return this.terminalizeError(
        span, error, readsConfirmedEffect ? browserCall?.confirmedProviderEffect : null,
      );
    }
    if (!result) return this.terminalizeError(span, executionFailure("failed", "GPT_CHILD_RESULT_MISSING"));
    const terminalEventId = this.terminalize(span, result);
    if (result.status !== "success") {
      throwGptChildFailure(
        result, evidenceRef, terminalEventId,
        readsConfirmedEffect ? browserCall?.confirmedProviderEffect : null,
      );
    }
    const successful = result as Extract<GptChildCapabilityResult, { status: "success" }>;
    recordSettledProviderResult(call, successful.value, browsers, browserCall);
    return productChildResult({ execution, intent, value: successful.value,
      browserFact: successful.proof.browserFact, evidenceRef, evidenceHash, artifactRefs });
  }

  private async resolveDispatchedMutation(input: Readonly<{
    execution: ExecutionInput;
    browser: BrowserTargetLease | undefined;
    result: GptChildCapabilityResult;
    evidenceRef: string;
    resolveDispatched: boolean;
  }>): Promise<void> {
    if (!input.resolveDispatched || !input.browser || input.result.status !== "success") return;
    await input.browser.resolvePendingMutation({ schemaVersion: "grasseye.browser.outcome-resolution.v1",
      outcome: "TERMINAL_SUCCESS",
      mutationOutcome: "dispatched",
      positiveEvidenceRef: `${input.result.proof.browserFact?.evidenceRef ?? input.evidenceRef}#positive-postcondition`,
      negativeEvidenceRef: `${input.result.proof.browserFact?.evidenceRef ?? input.evidenceRef}#negative-postcondition-absent`,
      uniqueTargetRef: input.browser.target.targetRef,
      boundedAt: new Date().toISOString(),
    });
  }
}
