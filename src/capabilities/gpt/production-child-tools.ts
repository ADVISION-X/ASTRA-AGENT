import {
  GPT_CHILD_CAPABILITY_CONTRACTS,
  type GptAbilityGroup,
  type GptAnyChildCapabilityIntent,
  type GptChildCapabilityId,
  type GptChildCapabilityIntent,
  type GptChildCapabilityResult,
  type GptExecutionContext,
} from "./contract.js";
import { failedGptChildExecutionResult } from "./ability-group.js";
import { gptExactCallIdentityHash } from "./contract.js";
import { gptCanonicalHash } from "./contract.js";
import {
  requireRuntimeLogWrite,
  type RuntimeLogger,
  type RuntimeSpanHandle,
} from "../../lib/runtime-logs/index.js";
import {
  executionFailure, failureCode,
} from "../../lib/execution-failure.js";
import type { BrowserAtomicStepIdentity } from "../../lib/browser/browser-authority-api.js";
import type { ProductGptCallInput, ProductGptChildResult } from "./product-api.js";
import type { GptHash } from "./contract.js";
import {
  ProductionGptBrowserLifecycle,
} from "./production-browser-lifecycle.js";
import { productionGptAtomicIdentity } from "./production-atomic-call.js";
import { ProductionGptExecutionSession } from "./production-execution-session.js";
import { ProductionGptSourceReuse } from "./production-execution-source-reuse.js";
import { gptExecutionFailure, typedGptExecutionFailure } from "./execution-fault.js";
import {
  confirmedSubmitIdentity, persistGptChildOutcome, productChildResult,
  recordSettledProviderResult, submitEffect,
} from "./production-child-result.js";
import {
  acquireProductionBrowserCall, recoverPersistedTextCheckpoint, runProductionAtomicPhase,
} from "./production-call-preparation.js";
import { readPersistedGptImageEvidence,
  readPersistedGptTextResponse } from "./evidence-artifacts.js";
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
  handleGptChildExecutionError,
  terminalizeGptChildError,
  terminalizeGptChildResult,
  type ProductGptExecution,
} from "./production-child-support.js";
import type { GptProductionExecutionInput as ExecutionInput } from "./production-ports.js";

export type { ProductGptExecution } from "./production-child-support.js";

type ExecuteOneOptions = Readonly<{
  priorEffectKnown?: boolean;
  rateLimitAckDispatchNotAfter?: number;
  browserAtomicIdentity?: BrowserAtomicStepIdentity;
  recordConfirmedProviderEffectReadback?: NonNullable<
    GptExecutionContext["recordConfirmedProviderEffectReadback"]
  >;
}>;
type ConfirmedSubmitCall = ProductGptCallInput<"submit_exact_gpt_turn_once"> & Readonly<{ sessionKey: string }>;
type ReadbackRecorder = NonNullable<GptExecutionContext["recordConfirmedProviderEffectReadback"]>;

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
  public async verifySourceCheckpointArtifact(input: Readonly<{
    jobId: string; sourceAttemptId: string;
    checkpointExactCallIdentityHash: GptHash;
    artifactRef: string; artifactContentHash: GptHash;
  }>): Promise<void> {
    const recovered = await readPersistedGptTextResponse({
      evidenceStore: this.evidenceStore, jobId: input.jobId,
      attemptId: input.sourceAttemptId,
      exactCallIdentityHash: input.checkpointExactCallIdentityHash,
    });
    const image = recovered ? null : await readPersistedGptImageEvidence({
      evidenceStore: this.evidenceStore, jobId: input.jobId,
      attemptId: input.sourceAttemptId,
      exactCallIdentityHash: input.checkpointExactCallIdentityHash,
    });
    const artifact = recovered ?? image;
    if (!artifact || artifact.artifactRef !== input.artifactRef
      || artifact.integrityHash !== input.artifactContentHash) {
      throw executionFailure("failed", "PRODUCTION_SOURCE_CHECKPOINT_ARTIFACT_UNAVAILABLE");
    }
  }
  private browserLifecycle(input: ExecutionInput): ProductionGptBrowserLifecycle {
    return new ProductionGptBrowserLifecycle(
      this.browserAuthority,
      this.runtimeLogger,
      this.sourceHash,
      {
        jobId: input.jobId,
        attemptId: input.attemptId,
        resultRevision: input.resultRevision,
        domainRejectionRevision: input.domainRejectionRevision ?? false,
        deliveryPriorityReplayCalls: input.deliveryPriorityReplayCalls ?? [],
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
    const source = new ProductionGptSourceReuse(input, this.evidenceStore, this.browserAuthority);
    return new ProductionGptExecutionSession(
      input, browsers, this.evidenceStore, source,
      () => this.assertExecutionActive(input),
      (call, recorder) => this.executeOne(input, browsers, call, {
        recordConfirmedProviderEffectReadback: recorder,
      }),
      (call, recorder) => this.readConfirmedSubmit(input, browsers, call, recorder),
    ).createExecution();
  }

  private async readConfirmedSubmit(
    input: ExecutionInput, browsers: ProductionGptBrowserLifecycle,
    call: ConfirmedSubmitCall,
    recordConfirmedProviderEffectReadback: ReadbackRecorder,
  ): Promise<ProductGptChildResult<"submit_exact_gpt_turn_once"> | null> {
    const startedAt = new Date().toISOString();
    this.assertExecutionActive(input);
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
    if (prior.outcome === "REJECTED" && prior.mutationOutcome === "no"
      && prior.physicalInputCount === 0
      && input.deliveryPriorityReplayCalls?.some((risk) =>
        risk.productStepId === call.productStepId && risk.callId === call.callId
        && risk.childCapabilityId === call.child)) return null;
    const { atomicIdentity, exactCallIdentityHash } = confirmedSubmitIdentity(input, call, existing);
    const effect = submitEffect(prior, exactCallIdentityHash, call.child);
    try {
      if (prior.outcome === "DISPATCHED"
        && existing.inputHash !== currentAtomicIdentity.inputHash) {
        throw executionFailure("failed", "PROVIDER_EFFECT_OUTCOME_UNPROVEN");
      }
      const active = await (prior.outcome === "CONFIRMED"
        ? browsers.browserForConfirmedReadback(
          call.sessionKey, call.productStepId, call.callId,
        ) : browsers.browserForRateLimitRecovery(
          call.sessionKey, call.productStepId, call.callId,
        ));
      if (!active.facade.readAtomicStepOutcome(atomicIdentity)) {
        throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_READBACK_INVALID");
      }
      return await this.executeOne<"submit_exact_gpt_turn_once">(input, browsers, call, {
        priorEffectKnown: true, browserAtomicIdentity: atomicIdentity,
        recordConfirmedProviderEffectReadback,
      });
    } catch (error) {
      return this.handleConfirmedReadbackFailure(
        input, browsers, call, intent, startedAt, effect, error,
      );
    }
  }

  private async handleConfirmedReadbackFailure(
    input: ExecutionInput, browsers: ProductionGptBrowserLifecycle,
    call: ConfirmedSubmitCall, intent: GptChildCapabilityIntent,
    startedAt: string, effect: ReturnType<typeof submitEffect>, error: unknown,
  ): Promise<never> {
    const code = failureCode(error);
    if ((code === "BROWSER_GPT_DIALOG_UNRECOGNIZED"
      || code === "BROWSER_KNOWN_GPT_RATE_LIMIT")
      && typedGptExecutionFailure(error)?.proofFacts?.browserFact
        ?.knownGptRateLimitPreflightFact) throw error;
    if (code === "BROWSER_GPT_DIALOG_UNRECOGNIZED"
      || code === "BROWSER_KNOWN_GPT_RATE_LIMIT") {
      const failed = await failedGptChildExecutionResult({
        intent, context: { dataDir: this.dataDir, signal: input.abortSignal }, startedAt, error,
      });
      if (code === "BROWSER_KNOWN_GPT_RATE_LIMIT") {
        const closureError = await this.closeKnownRateLimitAndReadGate(input, browsers, call, failed);
        if (closureError) {
          throw gptExecutionFailure(failureCode(closureError), {
            mutationOutcome: effect.mutationOutcome,
            evidence: { evidenceRef: effect.evidenceRef, evidenceHash: effect.evidenceHash },
            browserEffect: effect, cause: closureError,
          });
        }
      }
      throwGptChildFailure(failed, failed.proof.evidenceRef, undefined, effect);
    }
    throw gptExecutionFailure(failureCode(error, effect.browserOutcome === "CONFIRMED"
      ? "GPT_CONFIRMED_SUBMIT_READBACK_FAILED" : "PROVIDER_EFFECT_OUTCOME_UNPROVEN"), {
      mutationOutcome: effect.mutationOutcome,
      evidence: { evidenceRef: effect.evidenceRef, evidenceHash: effect.evidenceHash },
      browserEffect: effect, cause: error,
    });
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
          }, { priorEffectKnown: true, rateLimitAckDispatchNotAfter: Date.parse(pending.observedAt) + 1_000 }).catch(async (error: unknown) => {
          await incident.deliver(notClearedRateLimit(incident, pending.observedAt));
          throw error;
        });
        await incident.deliver({
          clearance: acknowledged.value.clearance,
          acknowledgementReceiptHash: acknowledged.value.acknowledgementReceiptHash,
          acknowledgedAt: acknowledged.value.acknowledgedAt,
        });
      } finally {
        await browsers.settle(null);
      }
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

  private async closeKnownRateLimitAndReadGate(
    execution: ExecutionInput,
    browsers: ProductionGptBrowserLifecycle,
    call: Readonly<{ sessionKey: string }>,
    result: GptChildCapabilityResult,
  ): Promise<unknown | null> {
    if (result.status === "success" || result.failureCode !== "BROWSER_KNOWN_GPT_RATE_LIMIT") return null;
    try {
      this.providerRateLimitControl.assertProviderSubmitAllowed();
    } catch (gateError) {
      if (failureCode(gateError) === "PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE") return null;
      return gateError;
    }
    let closureError: unknown = executionFailure(
      "failed", "PROVIDER_RATE_LIMIT_CLOSURE_DID_NOT_TERMINATE",
    );
    try {
      await closeKnownProviderRateLimit({
        execution, call, result,
        providerRateLimitControl: this.providerRateLimitControl,
        executeAcknowledgement: (acknowledgement, dispatchNotAfter) => this.executeOne(
          execution, browsers, acknowledgement, { rateLimitAckDispatchNotAfter: dispatchNotAfter },
        ),
      });
    } catch (caught) {
      closureError = caught;
    }
    try {
      this.providerRateLimitControl.assertProviderSubmitAllowed();
    } catch (gateError) {
      if (failureCode(gateError) === "PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE") return null;
    }
    return closureError;
  }

  private async executeOne<K extends GptChildCapabilityId>(execution: ExecutionInput,
    browsers: ProductionGptBrowserLifecycle,
    call: ProductGptCallInput<K> & Readonly<{ sessionKey: string }>,
    {
      priorEffectKnown = false,
      rateLimitAckDispatchNotAfter, browserAtomicIdentity, recordConfirmedProviderEffectReadback,
    }: ExecuteOneOptions = {},
  ): Promise<ProductGptChildResult<K>> {
    const intent = this.intentFor(execution, call), contract = GPT_CHILD_CAPABILITY_CONTRACTS[call.child];
    const startedAt = new Date().toISOString();
    const span = this.childSpan(execution, intent);
    let result: GptChildCapabilityResult | undefined;
    let evidenceRef: string;
    let evidenceHash: GptHash;
    let artifactRefs: readonly string[] = Object.freeze([]);
    let browserCall: Awaited<ReturnType<ProductionGptBrowserLifecycle["browserFor"]>> | undefined;
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
        ...(recordConfirmedProviderEffectReadback ? { recordConfirmedProviderEffectReadback } : {}),
        assertProviderInputAllowed: () => this.providerRateLimitControl.assertProviderSubmitAllowed(),
        ...(rateLimitAckDispatchNotAfter === undefined ? {} : { rateLimitAckDispatchNotAfter }) });
      if (call.child !== "acknowledge_known_gpt_rate_limit") {
        const closureError = await this.closeKnownRateLimitAndReadGate(execution, browsers, call, result);
        if (closureError) return terminalizeGptChildError(
          span, closureError, browserCall?.confirmedProviderEffect ?? null);
      }
      ({ evidenceRef, evidenceHash, artifactRefs } = await persistGptChildOutcome({
        call, result, intent: intent as GptAnyChildCapabilityIntent,
        execution, browsers, browserCall, evidenceStore: this.evidenceStore,
        ...(browserAtomicIdentity ? { browserAtomicIdentity } : {}),
      }));
    } catch (error) {
      result = await handleGptChildExecutionError({ dataDir: this.dataDir, execution,
        intent: intent as GptAnyChildCapabilityIntent, startedAt, error,
        browserCall, browserAtomicIdentity, span, childCapabilityId: call.child,
        closeKnownRateLimit: (failed) => this.closeKnownRateLimitAndReadGate(
          execution, browsers, call, failed),
      });
      evidenceRef = result.proof.browserFact?.evidenceRef ?? result.proof.evidenceRef;
      evidenceHash = result.proof.evidenceHash;
    }
    if (!result) return terminalizeGptChildError(
      span, executionFailure("failed", "GPT_CHILD_RESULT_MISSING"), undefined,
    );
    const terminalEventId = terminalizeGptChildResult(span, result);
    if (result.status !== "success") {
      throwGptChildFailure(
        result, evidenceRef, terminalEventId,
        result.failureCode === "BROWSER_GPT_DIALOG_UNRECOGNIZED"
          ? null : browserCall?.confirmedProviderEffect ?? null,
      );
    }
    const successful = result as Extract<GptChildCapabilityResult, { status: "success" }>;
    recordSettledProviderResult(call, successful.value, browsers, browserCall);
    return productChildResult({ execution, intent, value: successful.value,
      browserFact: successful.proof.browserFact, evidenceRef, evidenceHash, artifactRefs });
  }

}

export const createProductionGptChildTools = (
  ...input: ConstructorParameters<typeof ProductionGptChildTools>
): ProductionGptChildTools => new ProductionGptChildTools(...input);
