import {
  GPT_CHILD_CAPABILITY_CONTRACTS,
  gptContinuationIdentityHash,
  gptExactCallIdentityHash,
  type GptContinuationLane,
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
import {
  readSubmissionLocatorArtifact,
  readTextCheckpointArtifact,
} from "./gpt-artifact-reader.js";
import {
  ProductionGptBrowserLifecycle,
  recoveredGptChildResult,
  type ProductionGptBrowserCall,
} from "./production-gpt-browser-lifecycle.js";
import { readProductionGptCallFacts } from "./production-gpt-call-facts.js";

type ExecutionInput = Readonly<{
  task: WebsiteAgentTask;
  pluginId: string;
  pluginVersion: number;
  lease: ProductionExecutionLease;
  parentSpanId: string;
}>;

export type ProductGptExecution = Readonly<{
  tools: ProductGptTools;
  continuationRef(): string | null;
  reconcilePermanentCancellation(): Promise<void>;
  settle(error: unknown | null): Promise<void>;
}>;

const throwChildFailure = (result: GptChildCapabilityResult): never => {
  const error = executionFailure("failed", result.failureCode ?? "GPT_CHILD_FAILED", {
    mutationOutcome: result.proof.committedMutation,
    evidenceRef: persistedEvidenceRefs.get(result) ?? null,
    evidenceHash: result.proof.evidenceHash,
  });
  const causeEventId = childFailureEventIds.get(result);
  throw causeEventId ? withRuntimeLogCause(error, causeEventId) : error;
};

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
    const browsers = new ProductionGptBrowserLifecycle(
      this.browserAuthority,
      this.runtimeLogger,
      this.sourceHash,
      input,
    );
    let continuationRef: string | null = input.task.continuation_ref ?? null;
    const observedCalls = new Map<string, ProductGptCallInput & Readonly<{ sessionKey: string }>>();
    const execute = async (call: Parameters<ProductGptTools["execute"]>[0]): Promise<ProductGptChildResult> => {
      if (input.lease.abort_signal.aborted) {
        throw executionFailure("failed", typeof input.lease.abort_signal.reason === "string"
          ? input.lease.abort_signal.reason : "PRODUCTION_EXECUTION_ABORTED");
      }
      observedCalls.set(hashCanonical(call), call);
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
        readContinuationForTurn: (turnMarker: string) =>
          this.continuationForTurn(input, turnMarker),
        execute,
        readCallFacts: (call: Parameters<ProductGptTools["readCallFacts"]>[0]) =>
          this.readCallFacts(input, call),
      }),
      continuationRef: () => continuationRef,
      reconcilePermanentCancellation: async () => {
        for (const call of observedCalls.values()) {
          const facts = await this.readCallFacts(input, call);
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

  private continuationForTurn(input: ExecutionInput, turnMarker: string): GptContinuationLane | null {
    if (!turnMarker) throw executionFailure("failed", "GPT_CONTINUATION_TURN_MARKER_INVALID");
    const stored = input.task.continuation_ref
      ? this.store.readGptContinuation(input.task.continuation_ref)
      : this.store.readGptContinuationForOriginJob(input.task.job_id, input.pluginId, turnMarker);
    if (stored && stored.provider.prior_turn_marker !== turnMarker) return null;
    return this.verifiedContinuationLane(stored, input);
  }

  private verifiedContinuationLane(
    stored: ReturnType<ProductionRuntimeStore["readGptContinuation"]>,
    input: ExecutionInput,
  ): GptContinuationLane | null {
    if (!stored) return null;
    if (stored.origin_job_id !== input.task.job_id
      || stored.plugin_id !== input.pluginId
      || stored.owner_ref !== input.task.business_identity.owner_ref
      || stored.subject_ref !== input.task.business_identity.subject_ref
      || stored.authorization_ref !== input.task.business_identity.authorization_ref
      || stored.conversation_identity_hash !== gptContinuationIdentityHash(stored.provider)) {
      throw executionFailure("failed", "GPT_CONTINUATION_IDENTITY_INVALID");
    }
    return Object.freeze({
      continuation_ref: stored.continuation_ref,
      lane_version: stored.lane_version,
      provider: stored.provider,
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
    return this.readIntentFacts(this.intentFor(execution, call));
  }

  private async readIntentFacts(
    intent: GptChildCapabilityIntent,
  ): Promise<ExactGptCallFacts> {
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
    const propagated = error instanceof AggregateError && error.cause !== undefined
      ? error : failure;
    throw withRuntimeLogCause(propagated, terminal.eventId);
  }

  private async completedResultFromFacts(
    call: ProductGptCallInput,
    facts: ExactGptCallFacts,
    span: RuntimeSpanHandle,
    browserMutation: boolean,
  ): Promise<ProductGptChildResult | null> {
    if (!facts.evidence) return null;
    if (call.child === "persist_gpt_continuation") {
      if (!facts.continuation) return null;
      requireRuntimeLogWrite(span.terminal({ outcome: "succeeded" }));
      return Object.freeze({
        value: { continuationRef: facts.continuation.continuationRef },
        evidenceRef: facts.evidence.evidenceRef,
        evidenceHash: facts.evidence.evidenceHash,
      });
    }
    if (call.child === "advance_gpt_continuation_lane"
      || call.child === "release_gpt_continuation_lane") {
      requireRuntimeLogWrite(span.terminal({ outcome: "succeeded" }));
      return Object.freeze({
        value: call.child === "advance_gpt_continuation_lane" ? { advanced: true } : { released: true },
        evidenceRef: facts.evidence.evidenceRef,
        evidenceHash: facts.evidence.evidenceHash,
      });
    }
    if (call.child === "checkpoint_gpt_text_response") {
      if (facts.evidence.artifactRefs.length !== 1) {
        throw executionFailure("failed", "GPT_TEXT_TASK_ARTIFACT_MISSING");
      }
      const value = await readTextCheckpointArtifact(this.evidenceStore, facts.evidence.artifactRefs[0]!);
      requireRuntimeLogWrite(span.terminal({ outcome: "succeeded" }));
      return Object.freeze({
        value,
        evidenceRef: facts.evidence.evidenceRef,
        evidenceHash: facts.evidence.evidenceHash,
      });
    }
    if (call.child === "reconcile_gpt_turn_submission") {
      if (facts.evidence.artifactRefs.length !== 1) {
        throw executionFailure("failed", "GPT_SUBMISSION_LOCATOR_TASK_ARTIFACT_MISSING");
      }
      const value = await readSubmissionLocatorArtifact(this.evidenceStore, facts.evidence.artifactRefs[0]!);
      requireRuntimeLogWrite(span.terminal({ outcome: "succeeded" }));
      return Object.freeze({
        value,
        evidenceRef: facts.evidence.evidenceRef,
        evidenceHash: facts.evidence.evidenceHash,
      });
    }
    if (!browserMutation || facts.mutation?.outcome === "DISPATCHED") return null;
    requireRuntimeLogWrite(span.terminal({ outcome: "succeeded" }));
    return Object.freeze({
      value: null,
      evidenceRef: facts.evidence.evidenceRef,
      evidenceHash: facts.evidence.evidenceHash,
    });
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
      const completed = await this.completedResultFromFacts(call, facts, span, browserMutation);
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
      if (facts.evidence) {
        evidenceRef = facts.evidence.evidenceRef;
      } else {
        const persisted = await persistGptChildEvidence({
          result, intent, evidenceStore: this.evidenceStore,
          jobId: execution.task.job_id, attemptId: execution.lease.attempt_id,
          stepId: call.productStepId, exactCallIdentityHash: facts.exactCallIdentityHash,
        });
        evidenceRef = persisted.evidenceRef;
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
    if (result.status !== "success") throwChildFailure(result);
    return Object.freeze({
      value: result.value,
      evidenceRef,
      evidenceHash: facts.evidence?.evidenceHash ?? result.proof.evidenceHash,
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
