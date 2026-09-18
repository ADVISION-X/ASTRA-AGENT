import {
  GPT_CHILD_CAPABILITY_CONTRACTS,
  type GptAbilityGroup,
  type GptAnyChildCapabilityIntent,
  type GptChildCapabilityId,
  type GptChildCapabilityIntent,
  type GptChildCapabilityResult,
  type ProductGptChildCapabilityId,
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
import {
  executionFailure, executionFailureMetadata, failureCode, typedExecutionFailure,
} from "../../lib/execution-failure.js";
import { browserExactCallIdentityHash } from "../../lib/browser/browser-authority-api.js";
import type { BrowserAtomicStepIdentity } from "../../lib/browser/browser-authority-api.js";
import type { ProductGptCallInput, ProductGptChildResult } from "./product-api.js";
import type { GptHash } from "./contract.js";
import { persistGptEvidenceArtifacts } from "./evidence-artifacts.js";
import {
  ProductionGptBrowserLifecycle,
  type ProductionGptBrowserCall,
} from "./production-browser-lifecycle.js";
import { productionGptAtomicIdentity } from "./production-atomic-call.js";
import { gptExecutionFailure, typedGptExecutionFailure } from "./execution-fault.js";
import {
  productChildResult, recordConfirmedSubmission, recordSettledProviderResult, submitEffect,
} from "./production-child-result.js";
import {
  acquireProductionBrowserCall, recoverPersistedTextCheckpoint, runProductionAtomicPhase,
} from "./production-call-preparation.js";
import type {
  GptEvidenceStorePort,
  GptProductionBrowserAuthority,
  ProviderRateLimitControlPort,
} from "./production-ports.js";
import {
  closeKnownProviderRateLimit, notClearedRateLimit,
} from "./production-rate-limit-closure.js";
import {
  throwGptChildFailure,
  type GptProductionExecutionInput as ExecutionInput,
  type ProductGptExecution,
} from "./production-child-support.js";

export type { ProductGptExecution } from "./production-child-support.js";

const RENAME_CLEANUP_MINIMUM_BUDGET_MS = 15_000;

type ExecuteOneOptions = Readonly<{
  priorEffectKnown?: boolean;
  failureImpact?: RuntimeFailureImpact;
  rateLimitAckDispatchNotAfter?: number;
  browserAtomicIdentity?: BrowserAtomicStepIdentity;
}>;

export class ProductionGptChildTools {
  public constructor(
    private readonly dataDir: string,
    private readonly sourceHash: GptHash,
    private readonly gpt: GptAbilityGroup,
    private readonly evidenceStore: GptEvidenceStorePort,
    private readonly browserAuthority: GptProductionBrowserAuthority,
    private readonly runtimeLogger: RuntimeLogger,
    private readonly providerRateLimitControl: ProviderRateLimitControlPort,
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
        ...(input.providerContinuationParent ? {
          providerContinuationParent: input.providerContinuationParent,
        } : {}),
      },
    );
  }
  public createExecution(input: ExecutionInput): ProductGptExecution {
    const browsers = this.browserLifecycle(input);
    const execute = async <K extends ProductGptChildCapabilityId>(
      call: ProductGptCallInput<K> & Readonly<{ sessionKey: string }>,
    ): Promise<ProductGptChildResult<K>> => {
      this.assertExecutionActive(input);
      await this.runSettledConversationCleanup(input, browsers, call.sessionKey);
      const result = await this.executeOne(input, browsers, call);
      return result as ProductGptChildResult<K>;
    };
    return Object.freeze({
      tools: Object.freeze({
        jobId: input.jobId,
        attemptId: input.attemptId,
        execute,
        readConfirmedSubmit: (
          call: ProductGptCallInput<"submit_exact_gpt_turn_once"> & Readonly<{ sessionKey: string }>,
        ) => this.readConfirmedSubmit(input, browsers, call),
      }),
      decorateSettledResultFailure: (error) => browsers.decorateSettledResultFailure(error),
      settle: (error) => this.settleExecution(input, browsers, error),
    });
  }

  private async readConfirmedSubmit(
    input: ExecutionInput,
    browsers: ProductionGptBrowserLifecycle,
    call: ProductGptCallInput<"submit_exact_gpt_turn_once"> & Readonly<{ sessionKey: string }>,
  ): Promise<ProductGptChildResult<"submit_exact_gpt_turn_once"> | null> {
    this.assertExecutionActive(input);
    await this.runSettledConversationCleanup(input, browsers, call.sessionKey);
    const intent = this.intentFor(input, call);
    const currentAtomicIdentity = productionGptAtomicIdentity(
      intent as GptAnyChildCapabilityIntent, input.resultRevision,
    );
    const existing = this.browserAuthority.readProviderEffectStepCallFact({
      jobId: input.jobId, attemptId: input.attemptId, resultRevision: input.resultRevision,
      productStepId: call.productStepId, callId: call.callId,
      childCapabilityId: call.child,
    });
    if (!existing) return null;
    const prior = existing.mutation;
    if (prior.productStepId !== call.productStepId || prior.callId !== call.callId
      || prior.childCapabilityId !== call.child || prior.actionOrdinal !== call.actionOrdinal) {
      throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH");
    }
    const atomicIdentity: BrowserAtomicStepIdentity = Object.freeze({
      resultRevision: input.resultRevision,
      productStepId: prior.productStepId,
      callId: prior.callId,
      childCapabilityId: prior.childCapabilityId,
      inputHash: existing.inputHash,
      actionOrdinal: prior.actionOrdinal,
      replayPolicy: "provider-effect-once",
    });
    const exactCallIdentityHash = browserExactCallIdentityHash({
      jobId: input.jobId, attemptId: input.attemptId,
      writerFenceHash: input.executionFenceHash, ...atomicIdentity,
    });
    if (exactCallIdentityHash !== existing.exactCallIdentityHash) {
      throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH");
    }
    const effect = submitEffect(prior, exactCallIdentityHash, call.child);
    try {
      if (prior.outcome === "DISPATCHED"
        && existing.inputHash !== currentAtomicIdentity.inputHash) {
        throw executionFailure("failed", "PROVIDER_EFFECT_OUTCOME_UNPROVEN");
      }
      const active = await (prior.outcome === "CONFIRMED"
        ? browsers.browserForConfirmedReadback(
          call.sessionKey, call.productStepId, call.callId)
        : browsers.browserForRateLimitRecovery(
        call.sessionKey, call.productStepId, call.callId,
        ));
      if (!active.facade.readAtomicStepOutcome(atomicIdentity)) return null;
      return await this.executeOne<"submit_exact_gpt_turn_once">(input, browsers, call, {
        priorEffectKnown: true, browserAtomicIdentity: atomicIdentity,
      });
    } catch (error) {
      throw gptExecutionFailure(failureCode(error, prior.outcome === "CONFIRMED"
        ? "GPT_CONFIRMED_SUBMIT_READBACK_FAILED" : "PROVIDER_EFFECT_OUTCOME_UNPROVEN"), {
        mutationOutcome: effect.mutationOutcome, evidence: {
          evidenceRef: effect.evidenceRef, evidenceHash: effect.evidenceHash,
        }, browserEffect: effect, cause: error,
      });
    }
  }

  public async reconcilePendingProviderRateLimitIncidents(
    parentSpanId: string,
    signal: AbortSignal,
  ): Promise<void> {
    for (const pending of this.providerRateLimitControl.pendingIncidents()) {
      const execution: ExecutionInput = {
        jobId: pending.jobId,
        productId: "runtime-provider-cooldown-recovery",
        ownerRef: "production-runtime",
        subjectRef: pending.jobId,
        authorizationRef: "provider-cooldown-recovery",
        resultRevision: pending.resultRevision,
        attemptId: pending.attemptId,
        deviceId: pending.deviceId,
        leaseVersion: pending.leaseVersion,
        executionFenceHash: pending.fenceHash,
        capabilityManifestHash: pending.capabilityManifestHash,
        maxProviderTurns: 1,
        expiresAtMonotonic: performance.now() + 30_000,
        commandTtlMs: 30_000,
        abortSignal: signal,
        parentSpanId,
      };
      const browsers = this.browserLifecycle(execution);
      const incident = await this.providerRateLimitControl.beginIncident(pending);
      try {
        try {
          const acknowledged = await this.executeOne(execution, browsers, {
            child: "acknowledge_known_gpt_rate_limit",
            sessionKey: pending.sessionKey,
            productStepId: "gpt-rate-limit-control",
            callId: incident.incidentRequestId,
            actionOrdinal: 1,
            input: {
              incidentRequestId: incident.incidentRequestId,
              dialogHash: pending.dialogHash,
              observationHash: pending.observationHash,
              targetRefHash: pending.targetRefHash,
              documentRefHash: pending.documentRefHash,
              observedAt: pending.observedAt,
            },
          }, { priorEffectKnown: true, rateLimitAckDispatchNotAfter: Date.parse(pending.observedAt) + 1_000 });
          await incident.deliver({
            clearance: acknowledged.value.clearance,
            acknowledgementReceiptHash: acknowledged.value.acknowledgementReceiptHash,
            acknowledgedAt: acknowledged.value.acknowledgedAt,
          });
        } catch (error) {
          await incident.deliver(notClearedRateLimit(incident, pending.observedAt));
          throw error;
        }
      } finally {
        await browsers.settle(null);
      }
    }
  }

  private async settleExecution(
    input: ExecutionInput,
    browsers: ProductionGptBrowserLifecycle,
    error: unknown | null,
  ): Promise<void> {
    await this.runSettledConversationCleanup(input, browsers);
    await browsers.settle(error);
  }

  private async runSettledConversationCleanup(
    input: ExecutionInput,
    browsers: ProductionGptBrowserLifecycle,
    nextSessionKey?: string,
  ): Promise<void> {
    let cleanup: ReturnType<ProductionGptBrowserLifecycle["takeSettledConversationCleanup"]> = null;
    try {
      cleanup = browsers.takeSettledConversationCleanup(nextSessionKey);
      const remaining = Math.floor(input.expiresAtMonotonic - performance.now());
      if (cleanup && !input.abortSignal.aborted
        && remaining >= RENAME_CLEANUP_MINIMUM_BUDGET_MS
        && input.commandTtlMs >= RENAME_CLEANUP_MINIMUM_BUDGET_MS) {
        await this.executeOne(input, browsers, {
          child: "rename_settled_gpt_conversation",
          sessionKey: cleanup.sessionKey,
          productStepId: "gpt-settled-conversation-cleanup",
          callId: "rename-current-conversation",
          actionOrdinal: 1,
          input: {
            canonicalConversationUrl: cleanup.canonicalConversationUrl,
            jobId: input.jobId,
            productId: input.productId,
            terminalAt: cleanup.terminalAt,
            timeoutMs: 10000,
          },
        }, { failureImpact: RuntimeFailureImpact.CLEANUP });
      }
    } catch (error) {
      if (cleanup && failureCode(error, "") === "BROWSER_COMMAND_RECEIPT_MISSING") {
        browsers.recordSettledRenameTransportRevocation(cleanup.sessionKey);
      }
      // Settled-title cleanup is deliberately non-authoritative and cannot replace park.
    }
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

  private terminalize(
    span: RuntimeSpanHandle,
    result: GptChildCapabilityResult,
    failureImpact: RuntimeFailureImpact = RuntimeFailureImpact.BLOCKING,
  ): string {
    const native = result.failureCause ? Object.assign(new Error(result.failureCause.name), {
      name: result.failureCause.name,
      ...(result.failureCause.code ? { code: result.failureCause.code } : {}),
    }) : undefined;
    const failure = executionFailure("failed", result.failureCode ?? "GPT_CHILD_FAILED", {
      ...(native ? { cause: native } : {}),
    });
    const causedByEventId = runtimeLogCauseEventId(result);
    const terminal = result.status === "success"
      ? requireRuntimeLogWrite(span.terminal({ outcome: "succeeded" }))
      : requireRuntimeLogWrite(span.terminal({
        outcome: "failed",
        failure: runtimeFailureFromError({
          error: failure,
          code: result.failureCode ?? "GPT_CHILD_FAILED",
          responsibleOwner: "gpt",
          impact: failureImpact === RuntimeFailureImpact.CLEANUP
            ? RuntimeFailureImpact.CLEANUP
            : causedByEventId ? RuntimeFailureImpact.CONSEQUENTIAL : failureImpact,
          ...(causedByEventId ? { causedByEventId } : {}),
        }),
      }));
    return terminal.eventId;
  }

  private terminalizeError(
    span: RuntimeSpanHandle,
    error: unknown,
    confirmedProviderEffect?: ProductionGptBrowserCall["confirmedProviderEffect"],
    failureImpact: RuntimeFailureImpact = RuntimeFailureImpact.BLOCKING,
  ): never {
    const causedByEventId = runtimeLogCauseEventId(error);
    const original = typedExecutionFailure(error) ?? executionFailure(
      "failed",
      failureCode(error, "GPT_CHILD_RUNTIME_FAILED"),
      { cause: error },
    );
    const gptFailure = typedGptExecutionFailure(error);
    const failure = confirmedProviderEffect ? gptExecutionFailure(original.code, {
      mutationOutcome: "confirmed",
      evidence: {
        evidenceRef: confirmedProviderEffect.evidenceRef,
        evidenceHash: confirmedProviderEffect.evidenceHash,
      },
      browserEffect: confirmedProviderEffect,
      proofFacts: gptFailure?.proofFacts ?? null,
      childProof: executionFailureMetadata(original)?.childProof ?? null,
      cause: original,
    }) : original;
    const terminal = requireRuntimeLogWrite(span.terminal({
      outcome: "failed",
      failure: runtimeFailureFromError({
        error: failure,
        code: failureCode(failure, "GPT_CHILD_RUNTIME_FAILED"),
        responsibleOwner: "gpt",
        impact: failureImpact === RuntimeFailureImpact.CLEANUP
          ? RuntimeFailureImpact.CLEANUP
          : causedByEventId ? RuntimeFailureImpact.CONSEQUENTIAL : RuntimeFailureImpact.BLOCKING,
        ...(causedByEventId ? { causedByEventId } : {}),
      }),
    }));
    const propagated = error instanceof AggregateError && error.cause !== undefined
      ? error : failure;
    throw withRuntimeLogCause(propagated, terminal.eventId);
  }

  private assertProviderTurnBudget(
    execution: ExecutionInput,
    call: ProductGptCallInput<GptChildCapabilityId>,
  ): void {
    if (call.child !== "submit_exact_gpt_turn_once") return;
    this.providerRateLimitControl.assertProviderSubmitAllowed();
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
    call: ProductGptCallInput<K> & Readonly<{ sessionKey: string }>,
    {
      priorEffectKnown = false, failureImpact = RuntimeFailureImpact.BLOCKING,
      rateLimitAckDispatchNotAfter, browserAtomicIdentity,
    }: ExecuteOneOptions = {},
  ): Promise<ProductGptChildResult<K>> {
    const intent = this.intentFor(execution, call), contract = GPT_CHILD_CAPABILITY_CONTRACTS[call.child];
    const span = this.childSpan(execution, intent);
    let result: GptChildCapabilityResult | undefined;
    let evidenceRef: string;
    let evidenceHash: GptHash;
    let artifactRefs: readonly string[] = Object.freeze([]);
    let browserCall: Awaited<ReturnType<ProductionGptBrowserLifecycle["browserFor"]>> | undefined;
    const readsConfirmedEffect = call.child === "checkpoint_gpt_text_response"
      || call.child === "checkpoint_gpt_generated_image";
    try {
      browserCall = await acquireProductionBrowserCall(browsers, call,
        contract.requiredTargetKind, priorEffectKnown);
      const recovered = await recoverPersistedTextCheckpoint({ evidenceStore: this.evidenceStore,
        execution, intent, call, browsers, browserCall, span });
      if (recovered) return recovered;
      if (!priorEffectKnown) this.assertProviderTurnBudget(execution, call);
      result = await runProductionAtomicPhase({ dataDir: this.dataDir, gpt: this.gpt,
        browsers, intent: intent as GptAnyChildCapabilityIntent, browserCall, signal: execution.abortSignal,
        resultRevision: execution.resultRevision, childCapabilityId: call.child,
        ...(browserAtomicIdentity ? { browserAtomicIdentity } : {}),
        assertProviderInputAllowed: () => this.providerRateLimitControl.assertProviderSubmitAllowed(),
        ...(rateLimitAckDispatchNotAfter === undefined ? {} : { rateLimitAckDispatchNotAfter }) });
      if (result.status !== "success" && result.failureCode === "BROWSER_KNOWN_GPT_RATE_LIMIT"
        && call.child !== "acknowledge_known_gpt_rate_limit") {
        await closeKnownProviderRateLimit({
          execution, call, result,
          providerRateLimitControl: this.providerRateLimitControl,
          executeAcknowledgement: (acknowledgement, dispatchNotAfter) => this.executeOne(
            execution, browsers, acknowledgement, { rateLimitAckDispatchNotAfter: dispatchNotAfter },
          ),
        });
      }
      await recordConfirmedSubmission(call, result, intent as GptAnyChildCapabilityIntent,
        execution, browsers, browserCall, browserAtomicIdentity);
      artifactRefs = await persistGptEvidenceArtifacts({
        result, intent, evidenceStore: this.evidenceStore,
        jobId: execution.jobId, attemptId: execution.attemptId,
        exactCallIdentityHash: gptExactCallIdentityHash(intent),
      });
      evidenceRef = artifactRefs[0] ?? result.proof.browserFact?.evidenceRef ?? result.proof.evidenceRef;
      evidenceHash = result.proof.evidenceHash;
    } catch (error) {
      return this.terminalizeError(
        span, error, readsConfirmedEffect ? browserCall?.confirmedProviderEffect : null, failureImpact,
      );
    }
    if (!result) return this.terminalizeError(
      span, executionFailure("failed", "GPT_CHILD_RESULT_MISSING"), undefined, failureImpact,
    );
    const terminalEventId = this.terminalize(span, result, failureImpact);
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

}
