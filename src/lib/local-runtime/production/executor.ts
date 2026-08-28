import type { GptAbilityGroup } from "../../../capabilities/gpt/index.js";
import type { ForensicsPersistenceAbilityGroup } from "../../../capabilities/forensics-persistence/index.js";
import {
  RuntimeFailureImpact, RuntimeRecovery, requireRuntimeLogWrite, runtimeFailureFromError,
  runtimeLogCauseEventId, withRuntimeLogCause, type RuntimeLogger, type RuntimeSpanHandle,
} from "../../runtime-logs/index.js";
import { executionFailure, failureCode, failureStatus, typedExecutionFailure } from "../../typed-failure.js";
import type { WorkbenchBrowserAuthority } from "../workbench-browser-authority-support.js";
import { authorizeWebsiteAgentTask, dispatchWebsiteAgentTask } from "../../../mediator/agent-production-route.js";
import { productionCatalogHash } from "./catalog.js";
import type {
  DurablePluginIdentity, LocalProductionMaterial, ProductionHash, WebsiteAgentResult, WebsiteAgentTask,
} from "./contracts.js";
import type { ProductPluginOutput } from "./plugin.js";
import { ProductionGptExecutor } from "./production-gpt-executor.js";
import { assertProductionTaskRoutePolicy } from "./route-policy.js";
import { ProductionRuntimeStore, type StoredProductionTask } from "./store.js";

export interface ProductionExecutionLease {
  readonly attempt_id: string;
  readonly device_id: string;
  readonly lease_version: number;
  readonly execution_fence_hash: ProductionHash;
  readonly control_manifest_hash: ProductionHash;
  readonly max_provider_turns: number;
  provider_turns_used: number;
  expires_at_monotonic: number;
  command_ttl_ms: number;
  readonly abort_signal: AbortSignal;
}

export interface ProductionExecutionResult {
  readonly record: StoredProductionTask;
  readonly result: WebsiteAgentResult;
}

const durableIdentityValid = (
  accepted: StoredProductionTask,
  task: WebsiteAgentTask,
): boolean => {
  const current = authorizeWebsiteAgentTask(task);
  const identity = accepted.identity;
  return identity.catalog_hash === productionCatalogHash
    && identity.plugin_id === current.plugin.pluginId
    && identity.plugin_version === current.plugin.pluginVersion
    && identity.skill_hash === current.skillHash
    && identity.checkpoint_schema_version === current.plugin.checkpointSchemaVersion
    && identity.request_hash === task.request_hash;
};

const pluginIdentity = (task: WebsiteAgentTask): DurablePluginIdentity => {
  const resolved = authorizeWebsiteAgentTask(task);
  return {
    catalog_hash: productionCatalogHash,
    plugin_id: resolved.plugin.pluginId,
    plugin_version: resolved.plugin.pluginVersion,
    skill_hash: resolved.skillHash,
    checkpoint_schema_version: resolved.plugin.checkpointSchemaVersion,
    request_hash: task.request_hash,
  };
};

export class ProductionExecutor {
  private readonly gptExecutor: ProductionGptExecutor;

  public constructor(
    private readonly store: ProductionRuntimeStore,
    runtimeLogger: RuntimeLogger,
    input: Readonly<{
      dataDir: string;
      sourceHash: ProductionHash;
      gpt: GptAbilityGroup;
      evidenceStore: ForensicsPersistenceAbilityGroup;
      browserAuthority: WorkbenchBrowserAuthority;
    }>,
  ) {
    this.gptExecutor = new ProductionGptExecutor(
      input.dataDir, input.sourceHash, input.gpt, input.evidenceStore,
      input.browserAuthority, store, runtimeLogger,
    );
    this.runtimeLogger = runtimeLogger;
  }

  private readonly runtimeLogger: RuntimeLogger;

  public availableCapacity(): number { return 10; }

  public accept(task: WebsiteAgentTask): StoredProductionTask {
    assertProductionTaskRoutePolicy(task);
    return this.store.acceptTask(task, pluginIdentity(task));
  }

  private startPluginSpan(
    task: WebsiteAgentTask,
    lease: ProductionExecutionLease,
    parentSpanId: string,
    pluginId: string,
  ): RuntimeSpanHandle {
    return requireRuntimeLogWrite(this.runtimeLogger.startSpan({
      traceId: task.job_id, parentSpanId, owner: "product-plugin", component: pluginId,
      operation: "plugin.execute",
      typedIdentity: {
        kind: "plugin-step", jobId: task.job_id, attemptId: lease.attempt_id,
        pluginId, stepId: "plugin.execute",
      },
    }));
  }

  private terminalizePluginFailure(span: RuntimeSpanHandle, error: unknown): never {
    const failure = typedExecutionFailure(error) ?? executionFailure(
      "review_required", failureCode(error, "PLUGIN_EXECUTION_FAILED"), { cause: error },
    );
    const causedByEventId = runtimeLogCauseEventId(error);
    const status = failureStatus(failure);
    const recovery = status === "review_required" ? RuntimeRecovery.REVIEW
      : status === "recovery_pending" ? RuntimeRecovery.RETRY : RuntimeRecovery.STOP;
    const terminal = requireRuntimeLogWrite(span.terminal({
      outcome: status === "review_required" ? "review_required" : "failed",
      failure: runtimeFailureFromError({
        error: failure, code: "PLUGIN_EXECUTION_FAILED", responsibleOwner: "product-plugin", recovery,
        impact: causedByEventId ? RuntimeFailureImpact.CONSEQUENTIAL : RuntimeFailureImpact.BLOCKING,
        ...(causedByEventId ? { causedByEventId } : {}),
      }),
    }));
    throw withRuntimeLogCause(failure, terminal.eventId);
  }

  private async dispatchPlugin(input: Readonly<{
    task: WebsiteAgentTask;
    materials: readonly LocalProductionMaterial[];
    lease: ProductionExecutionLease;
    span: RuntimeSpanHandle;
    complete: (output: ProductPluginOutput, continuationRef: string | null) => Promise<WebsiteAgentResult>;
  }>): Promise<WebsiteAgentResult> {
    let completed = false;
    const result = await dispatchWebsiteAgentTask(input.task, (authorized) => ({
      materials: input.materials,
      runTurn: (turn) => {
        if (input.lease.provider_turns_used >= input.lease.max_provider_turns) {
          throw executionFailure("failed", "PROVIDER_TURN_BUDGET_EXHAUSTED");
        }
        input.lease.provider_turns_used += 1;
        return this.gptExecutor.runTurn({
          task: authorized.task, pluginId: authorized.plugin.pluginId,
          skillHash: authorized.skillHash, skillText: authorized.skillText,
          materials: input.materials, lease: input.lease, parentSpanId: input.span.spanId, turn,
        });
      },
      complete: async (output) => {
        if (completed) throw new Error("PLUGIN_RESULT_ALREADY_COMPLETED");
        authorized.plugin.parseResult(authorized.task, output.payload, "draft");
        const continuationRef = await this.gptExecutor.persistContinuation(
          authorized.task, authorized.plugin.pluginId, output, input.lease, input.span.spanId,
        );
        const envelope = await input.complete(output, continuationRef);
        completed = true;
        return envelope;
      },
    }));
    if (!completed) throw new Error("PLUGIN_RESULT_NOT_COMPLETED");
    return result;
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
    assertProductionTaskRoutePolicy(task);
    if (!durableIdentityValid(accepted, task)) {
      throw executionFailure("review_required", "PRODUCTION_PLUGIN_DURABLE_IDENTITY_MISMATCH");
    }
    const span = this.startPluginSpan(task, lease, parentSpanId, accepted.identity.plugin_id);
    try {
      const result = await this.dispatchPlugin({ task, materials, lease, span, complete });
      requireRuntimeLogWrite(span.terminal({ outcome: "success" }));
      return { record: this.store.readTask(task.job_id)!, result };
    } catch (error) {
      return this.terminalizePluginFailure(span, error);
    }
  }
}
