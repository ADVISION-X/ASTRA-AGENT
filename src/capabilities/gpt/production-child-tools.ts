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
  runtimeLogCauseEventId,
  runtimeFailureFromError,
  withRuntimeLogCause,
  type RuntimeLogger,
  type RuntimeSpanHandle,
} from "../../lib/runtime-logs/index.js";
import { executionFailure, failureCode, typedExecutionFailure } from "../../lib/execution-failure.js";
import { hashCanonical } from "../../lib/local-runtime/production/contracts.js";
import type { BrowserTargetLease } from "../../lib/browser/browser-authority-api.js";
import type { ProductGptCallInput, ProductGptChildResult } from "./product-api.js";
import type { GptHash } from "./contract.js";
import { persistGptEvidenceArtifacts } from "./evidence-artifacts.js";
import { ProductionGptBrowserLifecycle } from "./production-browser-lifecycle.js";
import { executeProductionGptAtomicCall, productionGptAtomicIdentity } from "./production-atomic-call.js";
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
        pluginId: input.pluginId,
        pluginVersion: input.pluginVersion,
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
          const active = await browsers.browserFor(call.sessionKey, call.productStepId, call.callId);
          if (!active.facade.readAtomicStepOutcome(productionGptAtomicIdentity(
            intent as GptAnyChildCapabilityIntent, input.resultRevision,
          ))) {
            return null;
          }
          return this.executeOne<"submit_exact_gpt_turn_once">(
            input, browsers, call, input.abortSignal, true,
          );
        },
      }),
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

  private terminalizeError(span: RuntimeSpanHandle, error: unknown): never {
    const causedByEventId = runtimeLogCauseEventId(error);
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

  private async executeOne<K extends GptChildCapabilityId>(
    execution: ExecutionInput,
    browsers: ProductionGptBrowserLifecycle,
    call: ProductGptCallInput<K> & Readonly<{ sessionKey: string }>,
    signal: AbortSignal = execution.abortSignal,
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
    try {
      const browserCall = contract.requiredTargetKind === "chatgpt"
        ? await browsers.browserFor(call.sessionKey, call.productStepId, call.callId)
        : undefined;
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
      return this.terminalizeError(span, error);
    }
    if (!result) return this.terminalizeError(span, executionFailure("failed", "GPT_CHILD_RESULT_MISSING"));
    const terminalEventId = this.terminalize(span, result);
    if (result.status !== "success") throwGptChildFailure(result, evidenceRef, terminalEventId);
    return Object.freeze({
      value: result.value as ProductGptChildResult<K>["value"],
      evidenceRef,
      evidenceHash,
      sourceAttemptId: execution.attemptId,
      exactCallIdentityHash: gptExactCallIdentityHash(intent),
      artifactRefs,
      effectReceipt: result.proof.browserFact ? Object.freeze({
        effectScope: result.proof.browserFact.effectScope,
        outcome: result.proof.browserFact.browserOutcome,
        mutationOutcome: result.proof.browserFact.mutationOutcome,
        terminalAt: result.proof.browserFact.terminalAt,
        evidenceRef: result.proof.browserFact.evidenceRef,
        evidenceHash: result.proof.browserFact.evidenceHash,
      }) : null,
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
    await input.browser.resolvePendingMutation({ schemaVersion: "grasseye.browser.outcome-resolution.v1",
      ownerPluginId: input.execution.pluginId,
      outcome: "TERMINAL_SUCCESS",
      mutationOutcome: "dispatched",
      positiveEvidenceRef: `${input.result.proof.browserFact?.evidenceRef ?? input.evidenceRef}#positive-postcondition`,
      negativeEvidenceRef: `${input.result.proof.browserFact?.evidenceRef ?? input.evidenceRef}#negative-postcondition-absent`,
      uniqueTargetRef: input.browser.target.targetRef,
      boundedAt: new Date().toISOString(),
    });
  }
}
