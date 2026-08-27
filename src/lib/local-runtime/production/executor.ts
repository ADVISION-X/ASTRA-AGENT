import { createHash } from "node:crypto";

import {
  type GptAbilityGroup,
  type GptChildCapabilityResult,
  type GptContinuationLane,
  type GptProviderContinuation,
} from "../../../capabilities/gpt/index.js";
import type { BrowserTargetLease } from "../../browser/browser-authority-api.js";
import {
  RuntimeFailureImpact,
  RuntimeRecovery,
  requireRuntimeLogWrite,
  runtimeFailureFromError,
  runtimeLogCauseEventId,
  withRuntimeLogCause,
  type RuntimeLogger,
} from "../../runtime-logs/index.js";
import type { WorkbenchBrowserAuthority } from "../workbench-browser-authority-support.js";
import { authorizeWebsiteAgentTask, dispatchWebsiteAgentTask } from "../../../mediator/agent-production-route.js";
import { productionCatalogHash } from "./catalog.js";
import type {
  DurablePluginIdentity,
  LocalProductionMaterial,
  ProductionHash,
  WebsiteAgentResult,
  WebsiteAgentTask,
} from "./contracts.js";
import { hashCanonical } from "./contracts.js";
import type { ProductPluginOutput, ProviderTurnResult } from "./plugin.js";
import {
  applyGptChildValue,
  buildGptTurnResult,
  createGptTurnState,
  gptChildEnabled,
  gptChildInput,
  type GptTurnRequest,
} from "./gpt-turn-state.js";
import { ProductionRuntimeStore, type StoredProductionTask } from "./store.js";

export interface ProductionExecutionLease {
  readonly attempt_id: string;
  readonly device_id: string;
  readonly lease_version: number;
  readonly execution_fence_hash: ProductionHash;
  readonly control_manifest_hash: ProductionHash;
  expires_at_monotonic: number;
  command_ttl_ms: number;
  readonly abort_signal: AbortSignal;
}

export interface ProductionExecutionResult {
  readonly record: StoredProductionTask;
  readonly result: WebsiteAgentResult;
}

const asRecord = (value: unknown, code: string): Readonly<Record<string, unknown>> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Readonly<Record<string, unknown>>;
};

const stringField = (value: unknown, code: string): string => {
  if (typeof value !== "string" || value.length === 0) throw new Error(code);
  return value;
};

const hash = (value: string): ProductionHash =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const resolveSuccessfulMutation = async (
  browser: BrowserTargetLease,
  pluginId: string,
  result: GptChildCapabilityResult,
): Promise<void> => {
  if (result.proof.committedMutation !== "yes") {
    if (browser.pendingMutationCount() !== 0) throw new Error("BROWSER_OUTCOME_UNKNOWN");
    return;
  }
  if (browser.pendingMutationCount() === 0) return;
  if (browser.pendingMutationCount() !== 1) throw new Error("BROWSER_OUTCOME_UNKNOWN");
  await browser.resolvePendingMutation({
    schemaVersion: "grasseye.browser.outcome-resolution.v1",
    ownerPluginId: pluginId,
    outcome: "TERMINAL_SUCCESS",
    positiveEvidenceRef: result.proof.evidenceRef,
    negativeEvidenceRef: `${result.proof.evidenceRef}:adjacent-states-excluded`,
    uniqueTargetRef: browser.target.targetRef,
    boundedAt: result.proof.endedAt,
  });
};

const throwChildFailure = (result: GptChildCapabilityResult): never => {
  const error = new Error(`${result.status}:${result.failureCode ?? "GPT_CHILD_FAILED"}`);
  const causeEventId = childFailureEventIds.get(result);
  throw causeEventId ? withRuntimeLogCause(error, causeEventId) : error;
};

const childFailureEventIds = new WeakMap<object, string>();

export class ProductionExecutor {
  private readonly gptStates = new Map<string, "idle" | "running" | "failed" | "review_required">();

  public constructor(
    private readonly dataDir: string,
    private readonly sourceHash: ProductionHash,
    private readonly gpt: GptAbilityGroup,
    private readonly browserAuthority: WorkbenchBrowserAuthority,
    private readonly store: ProductionRuntimeStore,
    private readonly runtimeLogger: RuntimeLogger,
  ) {}

  public availableCapacity(): number {
    return 1;
  }

  public accept(task: WebsiteAgentTask): StoredProductionTask {
    const resolved = authorizeWebsiteAgentTask(task);
    const identity: DurablePluginIdentity = {
      catalog_hash: productionCatalogHash,
      plugin_id: resolved.plugin.pluginId,
      plugin_version: resolved.plugin.pluginVersion,
      skill_hash: resolved.skillHash,
      checkpoint_schema_version: resolved.plugin.checkpointSchemaVersion,
      request_hash: task.request_hash,
    };
    return this.store.acceptTask(task, identity);
  }

  public async execute(
    task: WebsiteAgentTask,
    materials: readonly LocalProductionMaterial[],
    lease: ProductionExecutionLease,
    parentSpanId: string,
    complete: (output: ProductPluginOutput, continuationRef: string | null) => Promise<WebsiteAgentResult>,
  ): Promise<ProductionExecutionResult> {
    const accepted = this.store.readTask(task.job_id);
    if (!accepted) throw new Error("PRODUCTION_DURABLE_IDENTITY_MISSING");
    if (accepted.status === "completed" && accepted.result) throw new Error("PRODUCTION_TASK_ALREADY_TERMINAL");
    let completed = false;
    const pluginId = accepted.identity.plugin_id;
    const pluginSpan = requireRuntimeLogWrite(this.runtimeLogger.startSpan({
      traceId: task.job_id,
      parentSpanId,
      owner: "product-plugin",
      component: pluginId,
      operation: "plugin.execute",
      typedIdentity: {
        kind: "plugin-step",
        jobId: task.job_id,
        attemptId: lease.attempt_id,
        pluginId,
        stepId: "plugin.execute",
      },
    }));
    let result: WebsiteAgentResult;
    try {
      result = await dispatchWebsiteAgentTask(task, (authorized) => ({
        materials,
        runTurn: (turn) => this.runGptTurn({
          task: authorized.task,
          pluginId: authorized.plugin.pluginId,
          skillHash: authorized.skillHash,
          skillText: authorized.skillText,
          materials,
          lease,
          parentSpanId: pluginSpan.spanId,
          turn,
        }),
        complete: async (output) => {
          if (completed) throw new Error("PLUGIN_RESULT_ALREADY_COMPLETED");
          const continuationRef = await this.persistContinuation(
            authorized.task, authorized.plugin.pluginId, output, lease, pluginSpan.spanId,
          );
          const envelope = await complete(output, continuationRef);
          completed = true;
          return envelope;
        },
      }));
      if (!completed) throw new Error("PLUGIN_RESULT_NOT_COMPLETED");
      requireRuntimeLogWrite(pluginSpan.terminal({
        outcome: "success",
      }));
    } catch (error) {
      const causedByEventId = runtimeLogCauseEventId(error);
      const terminal = requireRuntimeLogWrite(pluginSpan.terminal({
        outcome: /review_required/iu.test(error instanceof Error ? error.message : String(error))
          ? "review_required"
          : "failed",
        failure: runtimeFailureFromError({
          error,
          code: "PLUGIN_EXECUTION_FAILED",
          responsibleOwner: "product-plugin",
          recovery: /review_required/iu.test(error instanceof Error ? error.message : String(error))
            ? RuntimeRecovery.REVIEW
            : RuntimeRecovery.STOP,
          impact: causedByEventId ? RuntimeFailureImpact.CONSEQUENTIAL : RuntimeFailureImpact.BLOCKING,
          ...(causedByEventId ? { causedByEventId } : {}),
        }),
      }));
      throw withRuntimeLogCause(error, terminal.eventId);
    }
    return { record: this.store.readTask(task.job_id)!, result };
  }

  private async persistContinuation(
    task: WebsiteAgentTask,
    pluginId: string,
    output: ProductPluginOutput,
    lease: ProductionExecutionLease,
    parentSpanId: string,
  ): Promise<string | null> {
    if (!output.continuation) return task.continuation_ref ?? null;
    const result = await this.executeGptChild({
      task, pluginId, stepId: "persist-continuation", lease, parentSpanId,
      intent: {
      childCapabilityId: "persist_gpt_continuation",
      executionId: `${task.job_id}:${pluginId}:persist-continuation`,
      input: {
        ...(task.continuation_ref ? { continuationRef: task.continuation_ref } : {}),
        jobId: task.job_id,
        pluginId,
        ownerRef: task.business_identity.owner_ref,
        subjectRef: task.business_identity.subject_ref,
        authorizationRef: task.business_identity.authorization_ref,
        provider: output.continuation,
      },
      },
      context: { dataDir: this.dataDir, continuationStore: this.store },
    });
    if (result.status !== "success") throwChildFailure(result);
    const value = asRecord(result.value, "GPT_CONTINUATION_RESULT_INVALID");
    return value.continuationRef === null ? null : stringField(value.continuationRef, "GPT_CONTINUATION_REF_INVALID");
  }

  private async acquireContinuation(
    task: WebsiteAgentTask,
    pluginId: string,
    turn: GptTurnRequest,
    lease: ProductionExecutionLease,
    parentSpanId: string,
  ): Promise<GptContinuationLane | null> {
    if (!turn.use_task_continuation) return null;
    if (!task.continuation_ref) throw new Error("review_required:GPT_CONTINUATION_REQUIRED");
    const result = await this.executeGptChild({
      task, pluginId, stepId: turn.step_id, lease, parentSpanId,
      intent: {
      childCapabilityId: "acquire_gpt_continuation_lane",
      executionId: `${task.job_id}:${pluginId}:${turn.step_id}:acquire-continuation`,
      input: {
        continuationRef: task.continuation_ref,
        jobId: task.job_id,
        pluginId,
        allowedSourcePluginIds: turn.continuation_source_plugin_ids ?? [],
        ownerRef: task.business_identity.owner_ref,
        subjectRef: task.business_identity.subject_ref,
        authorizationRef: task.business_identity.authorization_ref,
      },
      },
      context: { dataDir: this.dataDir, continuationStore: this.store },
    });
    if (result.status !== "success") throwChildFailure(result);
    return result.value as GptContinuationLane;
  }

  private async advanceContinuation(
    lane: GptContinuationLane,
    task: WebsiteAgentTask,
    pluginId: string,
    provider: GptProviderContinuation,
    lease: ProductionExecutionLease,
    parentSpanId: string,
  ): Promise<void> {
    const result = await this.executeGptChild({
      task, pluginId, stepId: "advance-continuation", lease, parentSpanId,
      intent: {
      childCapabilityId: "advance_gpt_continuation_lane",
      executionId: `${task.job_id}:${pluginId}:advance-continuation`,
      input: { lane, jobId: task.job_id, pluginId, provider },
      },
      context: { dataDir: this.dataDir, continuationStore: this.store },
    });
    if (result.status !== "success") throwChildFailure(result);
  }

  private async releaseContinuation(
    lane: GptContinuationLane,
    task: WebsiteAgentTask,
    pluginId: string,
    lease: ProductionExecutionLease,
    parentSpanId: string,
  ): Promise<void> {
    const result = await this.executeGptChild({
      task, pluginId, stepId: "release-continuation", lease, parentSpanId,
      intent: {
      childCapabilityId: "release_gpt_continuation_lane",
      executionId: `${task.job_id}:${pluginId}:release-continuation`,
      input: { lane, jobId: task.job_id },
      },
      context: { dataDir: this.dataDir, continuationStore: this.store },
    });
    if (result.status !== "success") throwChildFailure(result);
  }

  private async executeGptChild(input: Readonly<{
    task: WebsiteAgentTask;
    pluginId: string;
    stepId: string;
    lease: ProductionExecutionLease;
    parentSpanId: string;
    intent: Parameters<GptAbilityGroup["execute"]>[0];
    context: Parameters<GptAbilityGroup["execute"]>[1];
  }>): Promise<GptChildCapabilityResult> {
    const emitGptState = (current: "idle" | "running" | "failed" | "review_required"): void => {
      const previous = this.gptStates.get(input.task.job_id) ?? null;
      requireRuntimeLogWrite(this.runtimeLogger.emitState({
        traceId: input.task.job_id,
        owner: "gpt",
        component: "gpt-child",
        stateKey: "gpt.execution",
        previous,
        current,
      }));
      this.gptStates.set(input.task.job_id, current);
    };
    const span = requireRuntimeLogWrite(this.runtimeLogger.startSpan({
      traceId: input.task.job_id,
      parentSpanId: input.parentSpanId,
      boundaryId: input.intent.executionId,
      owner: "gpt",
      component: "gpt-child",
      operation: "gpt.child",
      typedIdentity: {
        kind: "gpt-call",
        jobId: input.task.job_id,
        attemptId: input.lease.attempt_id,
        pluginId: input.pluginId,
        stepId: input.stepId,
        capabilityCallId: input.intent.executionId,
      },
    }));
    emitGptState("running");
    try {
      const result = await this.gpt.execute(input.intent, input.context);
      if (result.status === "success") {
        const terminal = requireRuntimeLogWrite(span.terminal({
          outcome: "success",
        }));
        childFailureEventIds.set(result, terminal.eventId);
        emitGptState("idle");
      } else {
        const terminal = requireRuntimeLogWrite(span.terminal({
          outcome: result.status === "review_required" ? "review_required" : "failed",
          failure: runtimeFailureFromError({
            error: new Error(result.failureCode ?? result.status),
            code: result.status === "review_required" ? "GPT_CHILD_REVIEW_REQUIRED" : "GPT_CHILD_FAILED",
            responsibleOwner: "gpt",
            recovery: result.status === "recovery_pending"
              ? RuntimeRecovery.RETRY
              : result.status === "review_required" ? RuntimeRecovery.REVIEW : RuntimeRecovery.STOP,
            impact: RuntimeFailureImpact.BLOCKING,
          }),
        }));
        childFailureEventIds.set(result, terminal.eventId);
        emitGptState(result.status === "review_required" ? "review_required" : "failed");
      }
      return result;
    } catch (error) {
      const terminal = requireRuntimeLogWrite(span.terminal({
        outcome: "failed",
        failure: runtimeFailureFromError({
          error,
          code: "GPT_CHILD_RUNTIME_FAILED",
          responsibleOwner: "gpt",
          recovery: RuntimeRecovery.RETRY,
          impact: RuntimeFailureImpact.BLOCKING,
        }),
      }));
      emitGptState("failed");
      throw withRuntimeLogCause(error, terminal.eventId);
    }
  }

  private async executeGptFlow(input: Readonly<{
    task: WebsiteAgentTask;
    pluginId: string;
    turn: GptTurnRequest;
    state: ReturnType<typeof createGptTurnState>;
    browser: BrowserTargetLease;
    continuation: GptProviderContinuation | null;
    timeoutMs: number;
    stepInputHash: ProductionHash;
    signal: AbortSignal;
    lease: ProductionExecutionLease;
    parentSpanId: string;
  }>): Promise<ProviderTurnResult | null> {
    let resultCheckpoint: ProviderTurnResult | null = null;
    for (const [index, step] of input.turn.gpt_flow.entries()) {
      if (!gptChildEnabled(step, input.state, input.turn.output_kind)) continue;
      const result = await this.executeGptChild({
        task: input.task,
        pluginId: input.pluginId,
        stepId: input.turn.step_id,
        lease: input.lease,
        parentSpanId: input.parentSpanId,
        intent: {
          childCapabilityId: step.childCapabilityId,
          executionId: `${input.state.executionId}:${index}:${step.childCapabilityId}`,
          input: gptChildInput(step.childCapabilityId, input.state, input.continuation, input.timeoutMs),
        },
        context: {
          dataDir: this.dataDir, browser: input.browser,
          signal: input.signal,
          continuationStore: this.store,
        },
      });
      input.state.evidenceRefs.push(result.proof.evidenceRef);
      if (result.status !== "success") {
        if (input.state.checkpointRef && /_gpt_title$|^open_gpt_title_control$|^commit_gpt_title$/u.test(step.childCapabilityId)) {
          input.state.titleFailure = result.failureCode;
          break;
        }
        throwChildFailure(result);
      }
      await resolveSuccessfulMutation(input.browser, input.pluginId, result);
      applyGptChildValue(step.childCapabilityId, result.value, input.state);
      if (step.childCapabilityId === "checkpoint_gpt_text_response") {
        resultCheckpoint = buildGptTurnResult(input.state);
        this.store.writeStep(input.task.job_id, input.turn.step_id, input.stepInputHash, resultCheckpoint);
      }
    }
    return resultCheckpoint;
  }

  private async resumeCheckpoint(
    lane: GptContinuationLane | null,
    task: WebsiteAgentTask,
    pluginId: string,
    checkpoint: ProviderTurnResult | null,
    lease: ProductionExecutionLease,
    parentSpanId: string,
  ): Promise<ProviderTurnResult | null> {
    if (!checkpoint) return null;
    if (!lane) return checkpoint;
    if (!checkpoint.provider_continuation) throw new Error("review_required:GPT_CHECKPOINT_CONTINUATION_MISSING");
    await this.advanceContinuation(lane, task, pluginId, checkpoint.provider_continuation, lease, parentSpanId);
    return checkpoint;
  }

  private async advanceTurnContinuation(
    lane: GptContinuationLane | null,
    task: WebsiteAgentTask,
    pluginId: string,
    result: ProviderTurnResult,
    lease: ProductionExecutionLease,
    parentSpanId: string,
  ): Promise<void> {
    if (!lane) return;
    if (!result.provider_continuation) throw new Error("review_required:GPT_RESULT_CONTINUATION_MISSING");
    await this.advanceContinuation(lane, task, pluginId, result.provider_continuation, lease, parentSpanId);
  }

  private async runGptTurn(input: Readonly<{
    task: WebsiteAgentTask;
    pluginId: string;
    skillHash: ProductionHash;
    skillText: string;
    materials: readonly LocalProductionMaterial[];
    lease: ProductionExecutionLease;
    parentSpanId: string;
    turn: GptTurnRequest;
  }>): Promise<ProviderTurnResult> {
    const selected = input.materials.filter((material) => input.turn.material_roles.includes(material.role));
    const durableIdentity = this.store.readTask(input.task.job_id)?.identity;
    if (!durableIdentity) throw new Error("PRODUCTION_DURABLE_IDENTITY_MISSING");
    let continuation = input.turn.same_conversation_as?.provider_continuation ?? null;
    const lane = await this.acquireContinuation(
      input.task, input.pluginId, input.turn, input.lease, input.parentSpanId,
    );
    if (lane) continuation = lane.provider;
    const stepInputHash = hashCanonical({
      request_hash: input.task.request_hash,
      durable_identity: durableIdentity,
      skill_hash: input.skillHash,
      step_id: input.turn.step_id,
      instruction: input.turn.instruction,
      gpt_flow: input.turn.gpt_flow,
      material_refs: selected.map(({ local_path: _path, ...material }) => material),
      continuation_binding: input.task.continuation_ref
        ? { continuation_ref: input.task.continuation_ref }
        : continuation,
    });
    const resumed = await this.resumeCheckpoint(
      lane, input.task, input.pluginId,
      this.store.readStep(input.task.job_id, input.turn.step_id, stepInputHash),
      input.lease,
      input.parentSpanId,
    );
    if (resumed) return resumed;
    let browser: BrowserTargetLease | null = null;
    let primaryError: unknown = null;
    try {
      const activeBrowser = await this.acquireBrowser(input.task, input.pluginId, input.turn.step_id, input.lease);
      browser = activeBrowser;
      const executionId = `${input.task.job_id}:${input.pluginId}:${input.turn.step_id}`;
      const state = createGptTurnState({
        executionId, stepInputHash, skillText: input.skillText, instruction: input.turn.instruction,
        parameters: input.task.parameters, provider: input.turn.provider, jobId: input.task.job_id,
        stepId: input.turn.step_id, selectedMaterials: selected, acceptanceVersion: productionCatalogHash,
      });
      const timeoutMs = Math.min(3_600_000, Math.max(60_000, Math.floor(input.lease.expires_at_monotonic - performance.now())));
      const resultCheckpoint = await this.executeGptFlow({
        task: input.task, pluginId: input.pluginId, turn: input.turn, state, browser: activeBrowser,
        continuation, timeoutMs, stepInputHash, signal: input.lease.abort_signal,
        lease: input.lease, parentSpanId: input.parentSpanId,
      });
      const turnResult = resultCheckpoint ?? buildGptTurnResult(state);
      if (!resultCheckpoint) this.store.writeStep(input.task.job_id, input.turn.step_id, stepInputHash, turnResult);
      if (!state.titleFailure) activeBrowser.assertNoPendingMutations();
      await this.advanceTurnContinuation(
        lane, input.task, input.pluginId, turnResult, input.lease, input.parentSpanId,
      );
      return turnResult;
    } catch (error) {
      primaryError = error;
      if (lane) {
        try {
          await this.releaseContinuation(
            lane, input.task, input.pluginId, input.lease, input.parentSpanId,
          );
        } catch {
          // executeGptChild already emitted the release failure as its own terminal SPAN.
        }
      }
      throw error;
    } finally {
      if (browser && browser.pendingMutationCount() === 0) {
        try {
          await browser.close({ reason: "gpt-turn-settled" });
        } catch (closeError) {
          if (primaryError === null) throw closeError;
        }
      }
    }
  }

  private acquireBrowser(
    task: WebsiteAgentTask,
    pluginId: string,
    stepId: string,
    lease: ProductionExecutionLease,
  ): Promise<BrowserTargetLease> {
    const remaining = Math.floor(lease.expires_at_monotonic - performance.now());
    const commandTtlMs = Math.min(lease.command_ttl_ms, remaining);
    if (commandTtlMs < 1) throw new Error("V6_DEADLINE_BUDGET_EXHAUSTED");
    const executionRef = `${task.job_id}:${pluginId}:${stepId}`;
    return this.browserAuthority.acquireJobBoundTargetLease({
      kind: "production",
      ownerPluginId: pluginId,
      jobId: task.job_id,
      attemptId: lease.attempt_id,
      deviceId: lease.device_id,
      leaseVersion: lease.lease_version,
      localOrderId: task.job_id,
      contractManifestHash: lease.control_manifest_hash,
      executionRef,
      jobRefHash: hash(task.job_id),
      executionRefHash: hash(executionRef),
      writerLeaseEpoch: lease.lease_version,
      writerFenceHash: lease.execution_fence_hash,
      candidateHash: this.sourceHash,
      commandTtlMs,
    }, `${pluginId}:${task.job_id}`);
  }
}
