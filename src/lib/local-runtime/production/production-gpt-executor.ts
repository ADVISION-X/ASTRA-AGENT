import { createHash } from "node:crypto";

import type {
  GptAbilityGroup,
  GptChildCapabilityResult,
  GptContinuationLane,
  GptProviderContinuation,
} from "../../../capabilities/gpt/index.js";
import type { ForensicsPersistenceAbilityGroup } from "../../../capabilities/forensics-persistence/index.js";
import type { BrowserTargetLease } from "../../browser/browser-authority-api.js";
import {
  RuntimeFailureImpact, RuntimeRecovery, requireRuntimeLogWrite, runtimeFailureFromError,
  withRuntimeLogCause, type RuntimeLogger, type RuntimeSpanHandle,
} from "../../runtime-logs/index.js";
import { executionFailure, failureCode, typedExecutionFailure } from "../../typed-failure.js";
import type { WorkbenchBrowserAuthority } from "../workbench-browser-authority-support.js";
import type { LocalProductionMaterial, ProductionHash, WebsiteAgentTask } from "./contracts.js";
import { hashCanonical } from "./contracts.js";
import {
  applyGptChildValue, buildGptTurnResult, createGptTurnState, gptChildEnabled, gptChildInput,
  type GptTurnRequest,
} from "./gpt-turn-state.js";
import type { ProductPluginOutput, ProviderTurnResult } from "./plugin.js";
import type { ProductionExecutionLease } from "./executor.js";
import { ProductionRuntimeStore } from "./store.js";
import {
  childFailureEventIds, persistGptChildEvidence, persistedEvidenceRefs,
} from "./gpt-evidence-writer.js";
import { productionCatalogHash } from "./catalog.js";

type ChildExecutionInput = Readonly<{
  task: WebsiteAgentTask;
  pluginId: string;
  stepId: string;
  lease: ProductionExecutionLease;
  parentSpanId: string;
  intent: Parameters<GptAbilityGroup["execute"]>[0];
  context: Parameters<GptAbilityGroup["execute"]>[1];
}>;

export type ProductionGptTurnInput = Readonly<{
  task: WebsiteAgentTask;
  pluginId: string;
  skillHash: ProductionHash;
  skillText: string;
  materials: readonly LocalProductionMaterial[];
  lease: ProductionExecutionLease;
  parentSpanId: string;
  turn: GptTurnRequest;
}>;

const asRecord = (value: unknown, code: string): Readonly<Record<string, unknown>> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Readonly<Record<string, unknown>>;
};

const stringField = (value: unknown, code: string): string => {
  if (typeof value !== "string" || value.length === 0) throw new Error(code);
  return value;
};

const hash = (value: string): ProductionHash => `sha256:${createHash("sha256").update(value).digest("hex")}`;

const throwChildFailure = (result: GptChildCapabilityResult): never => {
  const error = executionFailure(result.status === "success" ? "failed" : result.status,
    result.failureCode ?? "GPT_CHILD_FAILED", {
      mutationOutcome: result.proof.committedMutation,
      evidenceRef: persistedEvidenceRefs.get(result) ?? null,
      evidenceHash: result.proof.evidenceHash,
    });
  const causeEventId = childFailureEventIds.get(result);
  throw causeEventId ? withRuntimeLogCause(error, causeEventId) : error;
};

const stepInputHash = (input: ProductionGptTurnInput, selected: readonly LocalProductionMaterial[],
  durableIdentity: unknown, continuation: GptProviderContinuation | null): ProductionHash => hashCanonical({
    request_hash: input.task.request_hash, durable_identity: durableIdentity, skill_hash: input.skillHash,
    step_id: input.turn.step_id, instruction: input.turn.instruction, gpt_flow: input.turn.gpt_flow,
    material_refs: selected.map(({ local_path: _path, ...material }) => material),
    continuation_binding: input.task.continuation_ref
      ? { continuation_ref: input.task.continuation_ref } : continuation,
  });

export class ProductionGptExecutor {
  private readonly states = new Map<string, "idle" | "running" | "failed" | "review_required">();

  public constructor(
    private readonly dataDir: string,
    private readonly sourceHash: ProductionHash,
    private readonly gpt: GptAbilityGroup,
    private readonly evidenceStore: ForensicsPersistenceAbilityGroup,
    private readonly browserAuthority: WorkbenchBrowserAuthority,
    private readonly store: ProductionRuntimeStore,
    private readonly runtimeLogger: RuntimeLogger,
  ) {}

  public async persistContinuation(
    task: WebsiteAgentTask,
    pluginId: string,
    output: ProductPluginOutput,
    lease: ProductionExecutionLease,
    parentSpanId: string,
  ): Promise<string | null> {
    if (!output.continuation) return task.continuation_ref ?? null;
    const result = await this.executeChild({
      task, pluginId, stepId: "persist-continuation", lease, parentSpanId,
      intent: {
        childCapabilityId: "persist_gpt_continuation",
        executionId: `${task.job_id}:${pluginId}:persist-continuation`,
        input: {
          ...(task.continuation_ref ? { continuationRef: task.continuation_ref } : {}),
          jobId: task.job_id, pluginId, ownerRef: task.business_identity.owner_ref,
          subjectRef: task.business_identity.subject_ref,
          authorizationRef: task.business_identity.authorization_ref, provider: output.continuation,
        },
      },
      context: { dataDir: this.dataDir, continuationStore: this.store },
    });
    if (result.status !== "success") throwChildFailure(result);
    const value = asRecord(result.value, "GPT_CONTINUATION_RESULT_INVALID");
    return value.continuationRef === null ? null : stringField(value.continuationRef, "GPT_CONTINUATION_REF_INVALID");
  }

  private emitState(jobId: string, current: "idle" | "running" | "failed" | "review_required"): void {
    requireRuntimeLogWrite(this.runtimeLogger.emitState({
      traceId: jobId, owner: "gpt", component: "gpt-child", stateKey: "gpt.execution",
      previous: this.states.get(jobId) ?? null, current,
    }));
    this.states.set(jobId, current);
  }

  private childSpan(input: ChildExecutionInput): RuntimeSpanHandle {
    return requireRuntimeLogWrite(this.runtimeLogger.startSpan({
      traceId: input.task.job_id, parentSpanId: input.parentSpanId, boundaryId: input.intent.executionId,
      owner: "gpt", component: "gpt-child", operation: "gpt.child",
      typedIdentity: {
        kind: "gpt-call", jobId: input.task.job_id, attemptId: input.lease.attempt_id,
        pluginId: input.pluginId, stepId: input.stepId, capabilityCallId: input.intent.executionId,
      },
    }));
  }

  private async runChild(input: ChildExecutionInput): Promise<GptChildCapabilityResult> {
    const observedProofs: Array<GptChildCapabilityResult["proof"]> = [];
    const execute = () => this.gpt.execute(input.intent, {
      ...input.context,
      onProof: async (proof) => {
        observedProofs.push(proof);
        await input.context.onProof?.(proof);
      },
    });
    const result = input.context.browser
      ? await input.context.browser.runAtomicStep({
        pluginStepId: input.stepId, childCapabilityId: input.intent.childCapabilityId,
      }, execute)
      : await execute();
    if (observedProofs.at(-1)?.evidenceHash !== result.proof.evidenceHash) {
      throw executionFailure("review_required", "EVIDENCE_PROOF_BINDING_INVALID");
    }
    return result;
  }

  private terminalizeResult(
    input: ChildExecutionInput,
    span: RuntimeSpanHandle,
    result: GptChildCapabilityResult,
  ): void {
    if (result.status === "success") {
      const terminal = requireRuntimeLogWrite(span.terminal({ outcome: "success" }));
      childFailureEventIds.set(result, terminal.eventId);
      this.emitState(input.task.job_id, "idle");
      return;
    }
    const recovery = result.status === "recovery_pending" ? RuntimeRecovery.RETRY
      : result.status === "review_required" ? RuntimeRecovery.REVIEW : RuntimeRecovery.STOP;
    const terminal = requireRuntimeLogWrite(span.terminal({
      outcome: result.status === "review_required" ? "review_required" : "failed",
      failure: runtimeFailureFromError({
        error: new Error(result.failureCode ?? result.status),
        code: result.status === "review_required" ? "GPT_CHILD_REVIEW_REQUIRED" : "GPT_CHILD_FAILED",
        responsibleOwner: "gpt", recovery, impact: RuntimeFailureImpact.BLOCKING,
      }),
    }));
    childFailureEventIds.set(result, terminal.eventId);
    this.emitState(input.task.job_id, result.status === "review_required" ? "review_required" : "failed");
  }

  private terminalizeError(input: ChildExecutionInput, span: RuntimeSpanHandle, error: unknown): never {
    const failure = typedExecutionFailure(error) ?? executionFailure(
      "recovery_pending", failureCode(error, "GPT_CHILD_RUNTIME_FAILED"), { cause: error },
    );
    const recovery = failure.status === "review_required" ? RuntimeRecovery.REVIEW
      : failure.status === "recovery_pending" ? RuntimeRecovery.RETRY : RuntimeRecovery.STOP;
    const terminal = requireRuntimeLogWrite(span.terminal({
      outcome: failure.status === "review_required" ? "review_required" : "failed",
      failure: runtimeFailureFromError({
        error: failure, code: "GPT_CHILD_RUNTIME_FAILED", responsibleOwner: "gpt",
        recovery, impact: RuntimeFailureImpact.BLOCKING,
      }),
    }));
    this.emitState(input.task.job_id, failure.status === "review_required" ? "review_required" : "failed");
    throw withRuntimeLogCause(failure, terminal.eventId);
  }

  private async executeChild(input: ChildExecutionInput): Promise<GptChildCapabilityResult> {
    const span = this.childSpan(input);
    this.emitState(input.task.job_id, "running");
    try {
      const result = await this.runChild(input);
      await persistGptChildEvidence({
        result, intent: input.intent, evidenceStore: this.evidenceStore,
        jobId: input.task.job_id, attemptId: input.lease.attempt_id, stepId: input.stepId,
      });
      this.terminalizeResult(input, span, result);
      return result;
    } catch (error) {
      return this.terminalizeError(input, span, error);
    }
  }

  private async acquireContinuation(
    input: ProductionGptTurnInput,
  ): Promise<GptContinuationLane | null> {
    if (!input.turn.use_task_continuation) return null;
    if (!input.task.continuation_ref) throw executionFailure("review_required", "GPT_CONTINUATION_REQUIRED");
    const result = await this.executeChild({
      task: input.task, pluginId: input.pluginId, stepId: input.turn.step_id,
      lease: input.lease, parentSpanId: input.parentSpanId,
      intent: {
        childCapabilityId: "acquire_gpt_continuation_lane",
        executionId: `${input.task.job_id}:${input.pluginId}:${input.turn.step_id}:acquire-continuation`,
        input: {
          continuationRef: input.task.continuation_ref, jobId: input.task.job_id, pluginId: input.pluginId,
          allowedSourcePluginIds: input.turn.continuation_source_plugin_ids ?? [],
          ownerRef: input.task.business_identity.owner_ref, subjectRef: input.task.business_identity.subject_ref,
          authorizationRef: input.task.business_identity.authorization_ref,
        },
      },
      context: { dataDir: this.dataDir, continuationStore: this.store },
    });
    if (result.status !== "success") throwChildFailure(result);
    return result.value as GptContinuationLane;
  }

  private async continuationCommand(
    command: "advance" | "release",
    lane: GptContinuationLane,
    input: ProductionGptTurnInput,
    provider?: GptProviderContinuation,
  ): Promise<void> {
    const childCapabilityId = command === "advance"
      ? "advance_gpt_continuation_lane" : "release_gpt_continuation_lane";
    const result = await this.executeChild({
      task: input.task, pluginId: input.pluginId, stepId: `${command}-continuation`,
      lease: input.lease, parentSpanId: input.parentSpanId,
      intent: {
        childCapabilityId,
        executionId: `${input.task.job_id}:${input.pluginId}:${command}-continuation`,
        input: command === "advance"
          ? { lane, jobId: input.task.job_id, pluginId: input.pluginId, provider }
          : { lane, jobId: input.task.job_id },
      },
      context: { dataDir: this.dataDir, continuationStore: this.store },
    });
    if (result.status !== "success") throwChildFailure(result);
  }

  private async executeFlow(input: Readonly<{
    request: ProductionGptTurnInput;
    state: ReturnType<typeof createGptTurnState>;
    browser: BrowserTargetLease;
    continuation: GptProviderContinuation | null;
    timeoutMs: number;
    inputHash: ProductionHash;
  }>): Promise<ProviderTurnResult | null> {
    let checkpoint: ProviderTurnResult | null = null;
    for (const [index, step] of input.request.turn.gpt_flow.entries()) {
      if (!gptChildEnabled(step, input.state, input.request.turn.output_kind)) continue;
      const result = await this.executeChild({
        task: input.request.task, pluginId: input.request.pluginId, stepId: input.request.turn.step_id,
        lease: input.request.lease, parentSpanId: input.request.parentSpanId,
        intent: {
          childCapabilityId: step.childCapabilityId,
          executionId: `${input.state.executionId}:${index}:${step.childCapabilityId}`,
          input: gptChildInput(step.childCapabilityId, input.state, input.continuation, input.timeoutMs),
        },
        context: {
          dataDir: this.dataDir, browser: input.browser, signal: input.request.lease.abort_signal,
          continuationStore: this.store,
        },
      });
      const evidenceRef = persistedEvidenceRefs.get(result);
      if (!evidenceRef) throw executionFailure("review_required", "EVIDENCE_REF_MISSING");
      input.state.evidenceRefs.push(evidenceRef);
      if (result.status !== "success") {
        const titleStep = /_gpt_title$|^open_gpt_title_control$|^commit_gpt_title$/u.test(step.childCapabilityId);
        if (input.state.checkpointRef && titleStep) { input.state.titleFailure = result.failureCode; break; }
        throwChildFailure(result);
      }
      applyGptChildValue(step.childCapabilityId, result.value, input.state);
      if (step.childCapabilityId === "checkpoint_gpt_text_response") {
        checkpoint = buildGptTurnResult(input.state);
        this.store.writeStep(input.request.task.job_id, input.request.turn.step_id, input.inputHash, checkpoint);
      }
    }
    return checkpoint;
  }

  private acquireBrowser(input: ProductionGptTurnInput): Promise<BrowserTargetLease> {
    const remaining = Math.floor(input.lease.expires_at_monotonic - performance.now());
    const commandTtlMs = Math.min(input.lease.command_ttl_ms, remaining);
    if (commandTtlMs < 1) throw executionFailure("recovery_pending", "V6_DEADLINE_BUDGET_EXHAUSTED");
    const executionRef = `${input.task.job_id}:${input.pluginId}:${input.turn.step_id}`;
    return this.browserAuthority.acquireJobBoundTargetLease({
      kind: "production", ownerPluginId: input.pluginId, jobId: input.task.job_id,
      attemptId: input.lease.attempt_id, deviceId: input.lease.device_id, leaseVersion: input.lease.lease_version,
      localOrderId: input.task.job_id, contractManifestHash: input.lease.control_manifest_hash, executionRef,
      jobRefHash: hash(input.task.job_id), executionRefHash: hash(executionRef),
      writerLeaseEpoch: input.lease.lease_version, writerFenceHash: input.lease.execution_fence_hash,
      candidateHash: this.sourceHash, commandTtlMs,
    }, `${input.pluginId}:${input.task.job_id}`, {
      signal: input.lease.abort_signal,
      remainingMs: () => Math.floor(input.lease.expires_at_monotonic - performance.now()),
    });
  }

  private async executeFreshTurn(input: ProductionGptTurnInput, lane: GptContinuationLane | null,
    continuation: GptProviderContinuation | null, inputHash: ProductionHash,
    selected: readonly LocalProductionMaterial[]): Promise<ProviderTurnResult> {
    let browser: BrowserTargetLease | null = null;
    let primaryError: unknown = null;
    try {
      browser = await this.acquireBrowser(input);
      const state = createGptTurnState({
        executionId: `${input.task.job_id}:${input.pluginId}:${input.turn.step_id}`,
        stepInputHash: inputHash, skillText: input.skillText, instruction: input.turn.instruction,
        parameters: input.task.parameters, provider: input.turn.provider, jobId: input.task.job_id,
        stepId: input.turn.step_id, selectedMaterials: selected, acceptanceVersion: productionCatalogHash,
      });
      const timeoutMs = Math.min(3_600_000,
        Math.max(60_000, Math.floor(input.lease.expires_at_monotonic - performance.now())));
      const checkpoint = await this.executeFlow({ request: input, state, browser, continuation, timeoutMs, inputHash });
      const result = checkpoint ?? buildGptTurnResult(state);
      if (!checkpoint) this.store.writeStep(input.task.job_id, input.turn.step_id, inputHash, result);
      if (!state.titleFailure) browser.assertNoPendingMutations();
      if (lane) {
        if (!result.provider_continuation) throw executionFailure("review_required", "GPT_RESULT_CONTINUATION_MISSING");
        await this.continuationCommand("advance", lane, input, result.provider_continuation);
      }
      return result;
    } catch (error) {
      primaryError = error;
      if (lane) try { await this.continuationCommand("release", lane, input); }
      catch (releaseError) {
        throw new AggregateError([error, releaseError], "GPT_CONTINUATION_RELEASE_FAILED");
      }
      throw error;
    } finally {
      if (browser && browser.pendingMutationCount() === 0) {
        try { await browser.close({ reason: "gpt-turn-settled" }); }
        catch (closeError) { if (primaryError === null) throw closeError; }
      }
    }
  }

  public async runTurn(input: ProductionGptTurnInput): Promise<ProviderTurnResult> {
    const selected = input.materials.filter((material) => input.turn.material_roles.includes(material.role));
    const durableIdentity = this.store.readTask(input.task.job_id)?.identity;
    if (!durableIdentity) throw new Error("PRODUCTION_DURABLE_IDENTITY_MISSING");
    const lane = await this.acquireContinuation(input);
    const continuation = lane?.provider ?? input.turn.same_conversation_as?.provider_continuation ?? null;
    const inputHash = stepInputHash(input, selected, durableIdentity, continuation);
    const checkpoint = this.store.readStep(input.task.job_id, input.turn.step_id, inputHash);
    if (checkpoint) {
      if (lane) {
        if (!checkpoint.provider_continuation) throw executionFailure("review_required", "GPT_CHECKPOINT_CONTINUATION_MISSING");
        await this.continuationCommand("advance", lane, input, checkpoint.provider_continuation);
      }
      return checkpoint;
    }
    return this.executeFreshTurn(input, lane, continuation, inputHash, selected);
  }
}
