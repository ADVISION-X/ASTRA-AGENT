import { createHash } from "node:crypto";

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
  ProductionGptBrowserLifecycle,
  recoveredGptChildResult,
  type ProductionGptBrowserCall,
} from "./production-gpt-browser-lifecycle.js";

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
  settle(error: unknown | null): Promise<void>;
}>;

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
        readContinuationForTurn: (turnMarker: string) =>
          this.continuationForTurn(input, turnMarker),
        execute,
        readCallFacts: (call: Parameters<ProductGptTools["readCallFacts"]>[0]) =>
          this.readCallFacts(input, call),
      }),
      continuationRef: () => continuationRef,
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
    const exactCallIdentityHash = gptExactCallIdentityHash(intent);
    const mutation = this.browserAuthority.readExactCallMutationFact({
      jobId: intent.jobId,
      attemptId: intent.attemptId,
      ownerPluginId: intent.pluginId,
      pluginVersion: intent.pluginVersion,
      exactCallIdentityHash,
      actionOrdinal: intent.actionOrdinal,
    });
    const evidence = await this.readVerifiedEvidence(intent, exactCallIdentityHash);
    const continuation = this.readVerifiedContinuation(intent, exactCallIdentityHash);
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

  private async readVerifiedEvidence(
    intent: GptChildCapabilityIntent,
    exactCallIdentityHash: `sha256:${string}`,
  ): Promise<ExactGptCallFacts["evidence"]> {
    const storedEvidence = await this.evidenceStore.readExactCallEvidence({
      missionId: intent.jobId,
      runId: intent.attemptId,
      exactCallIdentityHash,
    });
    if (!storedEvidence) return null;
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
    return Object.freeze({
      owner: "forensics-persistence",
      evidenceRef: storedEvidence.recordRef,
      evidenceHash: evidenceHash as ProductionHash,
      readbackVerified: true,
      artifactRefs,
    });
  }

  private readVerifiedContinuation(
    intent: GptChildCapabilityIntent,
    exactCallIdentityHash: `sha256:${string}`,
  ): ExactGptCallFacts["continuation"] {
    const continuationRef = intent.childCapabilityId === "persist_gpt_continuation"
      ? `gpt-continuation:${exactCallIdentityHash.slice(7)}`
      : this.continuationRefFromInput(intent.input);
    if (!continuationRef) return null;
    const stored = this.store.readGptContinuation(continuationRef);
    if (!stored) return null;
    if (stored.conversation_identity_hash !== gptContinuationIdentityHash(stored.provider)) {
      throw executionFailure("failed", "GPT_CONTINUATION_IDENTITY_INVALID");
    }
    return Object.freeze({
      owner: "gpt-session-controller",
      continuationRef,
      conversationIdentityHash: stored.conversation_identity_hash,
      laneVersion: stored.lane_version,
      contentReadbackVerified: true,
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
        return this.terminalizeError(span, executionFailure("failed", "GPT_TEXT_TASK_ARTIFACT_MISSING"));
      }
      const value = await this.readTextCheckpointArtifact(facts.evidence.artifactRefs[0]!);
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

  private async readTextCheckpointArtifact(artifactRef: string): Promise<Readonly<Record<string, unknown>>> {
    const readback = await this.evidenceStore.readArtifactRef({
      childCapabilityId: "read-artifact-ref", artifactRef,
    });
    if (readback.status !== "success" || !readback.artifact?.content
      || readback.artifact.mimeType !== "application/json") {
      throw executionFailure("failed", "GPT_TEXT_TASK_ARTIFACT_READBACK_FAILED");
    }
    let value: unknown;
    try { value = JSON.parse(new TextDecoder().decode(readback.artifact.content)) as unknown; }
    catch { throw executionFailure("failed", "GPT_TEXT_TASK_ARTIFACT_INVALID"); }
    const row = objectRecord(value);
    const rawDomHtml = row?.rawDomHtml;
    const rawDomHash = row?.rawDomHash;
    const semanticText = row?.semanticText;
    const semanticTextHash = row?.semanticTextHash;
    const rawHash = (content: string): string =>
      `sha256:${createHash("sha256").update(content).digest("hex")}`;
    if (row?.schemaVersion !== "agent-observed-response-artifact.v1"
      || typeof row.assistantTurnId !== "string" || !row.assistantTurnId
      || typeof rawDomHtml !== "string" || !rawDomHtml
      || typeof rawDomHash !== "string" || rawHash(rawDomHtml) !== rawDomHash
      || typeof semanticText !== "string" || !semanticText.trim()
      || typeof semanticTextHash !== "string" || rawHash(semanticText) !== semanticTextHash) {
      throw executionFailure("failed", "GPT_TEXT_TASK_ARTIFACT_INVALID");
    }
    return Object.freeze({
      assistantTurnId: row.assistantTurnId,
      rawDomHtml,
      rawDomHash,
      semanticText,
      semanticTextHash,
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
  ): Promise<ProductGptChildResult> {
    const intent = this.intentFor(execution, call);
    const facts = await this.readIntentFacts(intent);
    const contract = GPT_CHILD_CAPABILITY_CONTRACTS[call.child];
    const span = this.childSpan(execution, intent);
    if (facts.mutation?.outcome === "REJECTED") {
      return this.terminalizeError(span, executionFailure("failed", "BROWSER_POSTCONDITION_FAILED", {
        evidenceRef: facts.evidence?.evidenceRef ?? null,
        evidenceHash: facts.evidence?.evidenceHash ?? null,
      }));
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
    let result: GptChildCapabilityResult;
    let evidenceRef: string;
    let resolveDispatched = false;
    try {
      const atomic = await this.runAtomic(
        browsers,
        intent,
        browserCall,
        execution.lease.abort_signal,
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
