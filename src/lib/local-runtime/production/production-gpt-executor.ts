import { createHash } from "node:crypto";

import {
  GPT_CHILD_CAPABILITY_CONTRACTS,
  GPT_TURN_FLOW_VERSION,
  type GptAbilityGroup,
  type GptChildCapabilityId,
  type GptChildCapabilityIntent,
  type GptChildCapabilityResult,
  type GptContinuationLane,
  type GptProviderContinuation,
} from "../../../capabilities/gpt/index.js";
import type { ForensicsPersistenceAbilityGroup } from "../../../capabilities/forensics-persistence/index.js";
import type { BrowserTargetLease } from "../../browser/browser-authority-api.js";
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
import type { LocalProductionMaterial, ProductionHash, WebsiteAgentTask } from "./contracts.js";
import { hashCanonical } from "./contracts.js";
import {
  createGptTurnState,
  restoreGptTurnState,
  type GptTurnRequest,
} from "./gpt-turn-state.js";
import type { ProductPluginOutput, ProviderTurnResult } from "./plugin.js";
import type { ProductionExecutionLease } from "./executor.js";
import { ProductionRuntimeStore, type GptTurnDurableCheckpoint } from "./store.js";
import {
  childFailureEventIds,
  persistGptChildEvidence,
  persistedEvidenceRefs,
} from "./gpt-evidence-writer.js";
import { productionCatalogHash } from "./catalog.js";
import { closeSettledGptBrowser, executeProductionGptTurnFlow, gptTurnTimeoutMs } from "./production-gpt-turn-flow.js";

type ChildExecutionInput = Readonly<{
  task: WebsiteAgentTask;
  pluginId: string;
  stepId: string;
  lease: ProductionExecutionLease;
  parentSpanId: string;
  intent: GptChildCapabilityIntent;
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

const hash = (value: string): ProductionHash =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const throwChildFailure = (result: GptChildCapabilityResult): never => {
  const error = executionFailure(
    result.status === "success" ? "failed" : result.status,
    result.failureCode ?? "GPT_CHILD_FAILED",
    {
      mutationOutcome: result.proof.committedMutation,
      evidenceRef: persistedEvidenceRefs.get(result) ?? null,
      evidenceHash: result.proof.evidenceHash,
    },
  );
  const causeEventId = childFailureEventIds.get(result);
  throw causeEventId ? withRuntimeLogCause(error, causeEventId) : error;
};

const stepInputHash = (
  input: ProductionGptTurnInput,
  selected: readonly LocalProductionMaterial[],
  durableIdentity: unknown,
  continuation: GptProviderContinuation | null,
): ProductionHash => hashCanonical({
  request_hash: input.task.request_hash,
  durable_identity: durableIdentity,
  skill_hash: input.skillHash,
  flow_version: GPT_TURN_FLOW_VERSION,
  step_id: input.turn.step_id,
  instruction: input.turn.instruction,
  output_kind: input.turn.output_kind ?? "text",
  material_refs: selected.map(({ local_path: _path, ...material }) => material),
  continuation_binding: input.task.continuation_ref
    ? { continuation_ref: input.task.continuation_ref }
    : continuation,
});

export class ProductionGptExecutor {
  public constructor(
    private readonly dataDir: string,
    private readonly sourceHash: ProductionHash,
    private readonly gpt: GptAbilityGroup,
    private readonly evidenceStore: ForensicsPersistenceAbilityGroup,
    private readonly browserAuthority: WorkbenchBrowserAuthority,
    private readonly store: ProductionRuntimeStore,
    private readonly runtimeLogger: RuntimeLogger,
  ) {}

  private sessionIntent(input: Readonly<{
    task: WebsiteAgentTask;
    pluginId: string;
    stepId: string;
    childCapabilityId: GptChildCapabilityId;
    stepIndex: number;
    body: Readonly<Record<string, unknown>>;
  }>): GptChildCapabilityIntent {
    return {
      childCapabilityId: input.childCapabilityId,
      executionId: `${input.task.job_id}:${input.pluginId}:${input.stepId}:${input.childCapabilityId}`,
      flowVersion: GPT_TURN_FLOW_VERSION,
      stepIndex: input.stepIndex,
      inputHash: input.task.request_hash,
      pluginStepId: input.stepId,
      actionOrdinal: input.stepIndex + 1,
      input: input.body,
    };
  }

  public async persistContinuation(
    task: WebsiteAgentTask,
    pluginId: string,
    output: ProductPluginOutput,
    lease: ProductionExecutionLease,
    parentSpanId: string,
  ): Promise<string | null> {
    if (!output.continuation) return task.continuation_ref ?? null;
    const stepId = "persist-continuation";
    const result = await this.executeChild({
      task,
      pluginId,
      stepId,
      lease,
      parentSpanId,
      intent: this.sessionIntent({
        task,
        pluginId,
        stepId,
        childCapabilityId: "persist_gpt_continuation",
        stepIndex: 18,
        body: {
          ...(task.continuation_ref ? { continuationRef: task.continuation_ref } : {}),
          jobId: task.job_id,
          pluginId,
          ownerRef: task.business_identity.owner_ref,
          subjectRef: task.business_identity.subject_ref,
          authorizationRef: task.business_identity.authorization_ref,
          provider: output.continuation,
        },
      }),
      context: { dataDir: this.dataDir, continuationStore: this.store },
    });
    if (result.status !== "success") throwChildFailure(result);
    const value = asRecord(result.value, "GPT_CONTINUATION_RESULT_INVALID");
    return value.continuationRef === null
      ? null
      : stringField(value.continuationRef, "GPT_CONTINUATION_REF_INVALID");
  }

  private childSpan(input: ChildExecutionInput): RuntimeSpanHandle {
    return requireRuntimeLogWrite(this.runtimeLogger.startSpan({
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
        pluginStepId: input.stepId,
        childCapabilityId: input.intent.childCapabilityId,
        flowVersion: input.intent.flowVersion,
        stepIndex: input.intent.stepIndex,
        inputHash: input.intent.inputHash,
        actionOrdinal: input.intent.actionOrdinal,
        replayPolicy: GPT_CHILD_CAPABILITY_CONTRACTS[input.intent.childCapabilityId].replayPolicy,
      }, execute)
      : await execute();
    if (observedProofs.at(-1)?.evidenceHash !== result.proof.evidenceHash) {
      throw executionFailure("failed", "EVIDENCE_PROOF_BINDING_INVALID");
    }
    return result;
  }

  private terminalizeResult(
    input: ChildExecutionInput,
    span: RuntimeSpanHandle,
    result: GptChildCapabilityResult,
  ): void {
    if (result.status === "success") {
      const terminal = requireRuntimeLogWrite(span.terminal({ outcome: "succeeded" }));
      childFailureEventIds.set(result, terminal.eventId);
      return;
    }
    const terminal = requireRuntimeLogWrite(span.terminal({
      outcome: "failed",
      failure: runtimeFailureFromError({
        error: new Error(result.failureCode ?? result.status),
        code: result.failureCode ?? "GPT_CHILD_FAILED",
        responsibleOwner: "gpt",
        impact: RuntimeFailureImpact.BLOCKING,
      }),
    }));
    childFailureEventIds.set(result, terminal.eventId);
  }

  private terminalizeError(input: ChildExecutionInput, span: RuntimeSpanHandle, error: unknown): never {
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
    throw withRuntimeLogCause(failure, terminal.eventId);
  }

  private async executeChild(input: ChildExecutionInput): Promise<GptChildCapabilityResult> {
    const span = this.childSpan(input);
    try {
      const result = await this.runChild(input);
      await persistGptChildEvidence({
        result,
        intent: input.intent,
        evidenceStore: this.evidenceStore,
        jobId: input.task.job_id,
        attemptId: input.lease.attempt_id,
        stepId: input.stepId,
      });
      this.terminalizeResult(input, span, result);
      return result;
    } catch (error) {
      return this.terminalizeError(input, span, error);
    }
  }

  private async acquireContinuation(input: ProductionGptTurnInput): Promise<GptContinuationLane | null> {
    if (!input.turn.use_task_continuation) return null;
    if (!input.task.continuation_ref) throw executionFailure("failed", "GPT_CONTINUATION_REQUIRED");
    const stepId = input.turn.step_id;
    const result = await this.executeChild({
      task: input.task,
      pluginId: input.pluginId,
      stepId,
      lease: input.lease,
      parentSpanId: input.parentSpanId,
      intent: this.sessionIntent({
        task: input.task,
        pluginId: input.pluginId,
        stepId,
        childCapabilityId: "acquire_gpt_continuation_lane",
        stepIndex: 19,
        body: {
          continuationRef: input.task.continuation_ref,
          jobId: input.task.job_id,
          pluginId: input.pluginId,
          allowedSourcePluginIds: input.turn.continuation_source_plugin_ids ?? [],
          ownerRef: input.task.business_identity.owner_ref,
          subjectRef: input.task.business_identity.subject_ref,
          authorizationRef: input.task.business_identity.authorization_ref,
        },
      }),
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
      ? "advance_gpt_continuation_lane"
      : "release_gpt_continuation_lane";
    const stepId = `${command}-continuation`;
    const result = await this.executeChild({
      task: input.task,
      pluginId: input.pluginId,
      stepId,
      lease: input.lease,
      parentSpanId: input.parentSpanId,
      intent: this.sessionIntent({
        task: input.task,
        pluginId: input.pluginId,
        stepId,
        childCapabilityId,
        stepIndex: command === "advance" ? 20 : 21,
        body: command === "advance"
          ? { lane, jobId: input.task.job_id, pluginId: input.pluginId, provider }
          : { lane, jobId: input.task.job_id },
      }),
      context: { dataDir: this.dataDir, continuationStore: this.store },
    });
    if (result.status !== "success") throwChildFailure(result);
  }

  private acquireBrowser(input: ProductionGptTurnInput): Promise<BrowserTargetLease> {
    const remaining = Math.floor(input.lease.expires_at_monotonic - performance.now());
    const commandTtlMs = Math.min(input.lease.command_ttl_ms, remaining);
    if (commandTtlMs < 1) throw executionFailure("failed", "V6_DEADLINE_BUDGET_EXHAUSTED");
    const executionRef = `${input.task.job_id}:${input.pluginId}:${input.turn.step_id}`;
    return this.browserAuthority.acquireJobBoundTargetLease({
      kind: "production",
      ownerPluginId: input.pluginId,
      jobId: input.task.job_id,
      pluginStepId: input.turn.step_id,
      attemptId: input.lease.attempt_id,
      deviceId: input.lease.device_id,
      leaseVersion: input.lease.lease_version,
      localOrderId: input.task.job_id,
      contractManifestHash: input.lease.control_manifest_hash,
      executionRef,
      jobRefHash: hash(input.task.job_id),
      executionRefHash: hash(executionRef),
      writerLeaseEpoch: input.lease.lease_version,
      writerFenceHash: input.lease.execution_fence_hash,
      candidateHash: this.sourceHash,
      commandTtlMs,
    }, `${input.pluginId}:${input.task.job_id}`, {
      signal: input.lease.abort_signal,
      remainingMs: () => Math.floor(input.lease.expires_at_monotonic - performance.now()),
    });
  }

  private async executeBoundTurn(
    input: ProductionGptTurnInput, lane: GptContinuationLane | null,
    continuation: GptProviderContinuation | null, inputHash: ProductionHash,
    selected: readonly LocalProductionMaterial[], checkpoint: GptTurnDurableCheckpoint | null,
  ): Promise<ProviderTurnResult> {
    let browser: BrowserTargetLease | null = null;
    let primaryError: unknown = null;
    try {
      browser = await this.acquireBrowser(input);
      const state = createGptTurnState({
        executionId: `${input.task.job_id}:${input.pluginId}:${input.turn.step_id}`,
        stepInputHash: inputHash,
        skillText: input.skillText,
        instruction: input.turn.instruction,
        parameters: input.task.parameters,
        provider: input.turn.provider,
        selectedMaterials: selected,
        acceptanceVersion: productionCatalogHash,
      });
      if (checkpoint) restoreGptTurnState(state, checkpoint.state);
      const timeoutMs = gptTurnTimeoutMs(input.lease.expires_at_monotonic);
      const result = await executeProductionGptTurnFlow({
        gpt: this.gpt,
        store: this.store,
        request: {
          jobId: input.task.job_id,
          pluginId: input.pluginId,
          stepId: input.turn.step_id,
          lease: input.lease,
          outputKind: input.turn.output_kind ?? "text",
        },
        state,
        browser,
        continuation,
        timeoutMs,
        inputHash,
        checkpoint,
        context: {
          dataDir: this.dataDir,
          browser,
          signal: input.lease.abort_signal,
          continuationStore: this.store,
        },
        executeChild: (intent, context) => this.executeChild({
          task: input.task,
          pluginId: input.pluginId,
          stepId: input.turn.step_id,
          lease: input.lease,
          parentSpanId: input.parentSpanId,
          intent,
          context,
        }),
        failChild: throwChildFailure,
      });
      browser.assertNoPendingMutations();
      if (lane) {
        if (!result.provider_continuation) {
          throw executionFailure("failed", "GPT_RESULT_CONTINUATION_MISSING");
        }
        await this.continuationCommand("advance", lane, input, result.provider_continuation);
      }
      return result;
    } catch (error) {
      primaryError = error;
      if (lane) {
        try { await this.continuationCommand("release", lane, input); }
        catch (releaseError) {
          throw new AggregateError([error, releaseError], "GPT_CONTINUATION_RELEASE_FAILED");
        }
      }
      throw error;
    } finally {
      await closeSettledGptBrowser(browser, primaryError);
    }
  }

  public async runTurn(input: ProductionGptTurnInput): Promise<ProviderTurnResult> {
    const selected = input.materials.filter((material) => input.turn.material_roles.includes(material.role));
    const durableIdentity = this.store.readTask(input.task.job_id)?.identity;
    if (!durableIdentity) throw new Error("PRODUCTION_DURABLE_IDENTITY_MISSING");
    const lane = await this.acquireContinuation(input);
    const continuation = lane?.provider ?? input.turn.same_conversation_as?.provider_continuation ?? null;
    const inputHash = stepInputHash(input, selected, durableIdentity, continuation);
    const checkpoint = this.store.readGptTurnCheckpoint(input.task.job_id, input.turn.step_id, inputHash);
    if (checkpoint?.result) {
      if (lane) {
        if (!checkpoint.result.provider_continuation) {
          throw executionFailure("failed", "GPT_CHECKPOINT_CONTINUATION_MISSING");
        }
        await this.continuationCommand("advance", lane, input, checkpoint.result.provider_continuation);
      }
      return checkpoint.result;
    }
    return this.executeBoundTurn(input, lane, continuation, inputHash, selected, checkpoint);
  }
}
