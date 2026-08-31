import type { GptAbilityGroup } from "../../../capabilities/gpt/index.js";
import type { ForensicsPersistenceAbilityGroup } from "../../../capabilities/forensics-persistence/index.js";
import {
  RuntimeFailureImpact, requireRuntimeLogWrite, runtimeFailureFromError,
  runtimeLogCauseEventId, withRuntimeLogCause, type RuntimeLogger, type RuntimeSpanHandle,
} from "../../runtime-logs/index.js";
import { executionFailure, failureCode, typedExecutionFailure } from "../../typed-failure.js";
import type { WorkbenchBrowserAuthority } from "../workbench-browser-authority-support.js";
import { authorizeWebsiteAgentTask, dispatchWebsiteAgentTask } from "../../../mediator/agent-production-route.js";
import { productionCatalogHash } from "./catalog.js";
import type {
  DurablePluginIdentity, LocalProductionMaterial, ProductionHash, WebsiteAgentResult, WebsiteAgentTask,
} from "./contracts.js";
import type { ProductPluginOutput } from "./plugin.js";
import { ProductionGptChildTools, type ProductGptExecution } from "./production-gpt-child-tools.js";
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
  private readonly gptChildTools: ProductionGptChildTools;

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
    this.gptChildTools = new ProductionGptChildTools(
      input.dataDir, input.sourceHash, input.gpt, input.evidenceStore,
      input.browserAuthority, store, runtimeLogger,
    );
    this.runtimeLogger = runtimeLogger;
  }

  private readonly runtimeLogger: RuntimeLogger;

  public availableCapacity(): number { return 10; }

  public accept(task: WebsiteAgentTask, attemptId: string): StoredProductionTask {
    assertProductionTaskRoutePolicy(task);
    return this.store.acceptTask(task, pluginIdentity(task), attemptId);
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

  private terminalizePluginFailure(
    span: RuntimeSpanHandle,
    error: unknown,
    identity?: Readonly<{ attemptId: string; pluginId: string }>,
  ): never {
    const failure = typedExecutionFailure(error) ?? executionFailure(
      "failed", failureCode(error, "PLUGIN_EXECUTION_FAILED"), { cause: error },
    );
    const causedByEventId = runtimeLogCauseEventId(error);
    const terminal = requireRuntimeLogWrite(span.terminal({
      outcome: "failed",
      failure: runtimeFailureFromError({
        error: failure,
        code: causedByEventId ? "PLUGIN_EXECUTION_FAILED" : failure.code,
        responsibleOwner: "product-plugin",
        impact: causedByEventId ? RuntimeFailureImpact.CONSEQUENTIAL : RuntimeFailureImpact.BLOCKING,
        ...(causedByEventId ? { causedByEventId } : {}),
      }),
    }));
    if (error instanceof AggregateError
      && error.message === "GPT_BROWSER_LIFECYCLE_FAILED"
      && error.cause !== undefined) {
      if (!identity) throw executionFailure("failed", "PLUGIN_LIFECYCLE_IDENTITY_MISSING");
      for (const cleanupError of error.errors) {
        requireRuntimeLogWrite(this.runtimeLogger.emitError({
          traceId: span.traceId,
          owner: "browser-session",
          component: "gpt-browser-lifecycle",
          operation: "browser.infrastructure",
          typedIdentity: {
            kind: "plugin-step",
            jobId: span.traceId,
            attemptId: identity.attemptId,
            pluginId: identity.pluginId,
            stepId: "browser.settle",
          },
          failure: runtimeFailureFromError({
            error: cleanupError,
            code: failureCode(cleanupError, "GPT_BROWSER_LIFECYCLE_FAILED"),
            responsibleOwner: "browser-session",
            impact: RuntimeFailureImpact.CLEANUP,
            causedByEventId: terminal.eventId,
          }),
        }));
      }
    }
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
    let gptExecution: ProductGptExecution | null = null;
    const gptLifecycle: {
      reconcilePermanentCancellation: (() => Promise<void>) | null;
      settle: ((error: unknown | null) => Promise<void>) | null;
    } = { reconcilePermanentCancellation: null, settle: null };
    let primaryError: unknown = null;
    let result: WebsiteAgentResult;
    try {
      result = await dispatchWebsiteAgentTask(input.task, (authorized) => {
        gptExecution = this.gptChildTools.createExecution({
          task: authorized.task,
          pluginId: authorized.plugin.pluginId,
          pluginVersion: authorized.plugin.pluginVersion,
          lease: input.lease,
          parentSpanId: input.span.spanId,
        });
        gptLifecycle.reconcilePermanentCancellation = gptExecution.reconcilePermanentCancellation;
        gptLifecycle.settle = gptExecution.settle;
        return {
          materials: input.materials,
          gpt: gptExecution.tools,
          complete: async (output) => {
            if (input.lease.abort_signal.aborted) {
              throw executionFailure("failed", typeof input.lease.abort_signal.reason === "string"
                ? input.lease.abort_signal.reason : "PRODUCTION_EXECUTION_ABORTED");
            }
            if (completed) throw new Error("PLUGIN_RESULT_ALREADY_COMPLETED");
            authorized.plugin.parseResult(authorized.task, output.payload, "draft");
            const envelope = await input.complete(output, gptExecution!.continuationRef());
            completed = true;
            return envelope;
          },
        };
      });
    } catch (error) {
      primaryError = error;
      throw error;
    } finally {
      try {
        const cancellationReason = typeof input.lease.abort_signal.reason === "string"
          ? input.lease.abort_signal.reason : "";
        if (cancellationReason === "CONTROL_INTENT:cancel_requested:PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED"
          && gptLifecycle.reconcilePermanentCancellation) {
          await gptLifecycle.reconcilePermanentCancellation();
        }
        if (gptLifecycle.settle) await gptLifecycle.settle(primaryError);
      } catch (settleError) {
        if (primaryError === null) throw settleError;
        const combined = new AggregateError(
          [settleError], "GPT_BROWSER_LIFECYCLE_FAILED", { cause: primaryError },
        );
        const causedByEventId = runtimeLogCauseEventId(primaryError);
        throw causedByEventId ? withRuntimeLogCause(combined, causedByEventId) : combined;
      }
    }
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
      throw executionFailure("failed", "PRODUCTION_PLUGIN_DURABLE_IDENTITY_MISMATCH");
    }
    const span = this.startPluginSpan(task, lease, parentSpanId, accepted.identity.plugin_id);
    try {
      const result = await this.dispatchPlugin({ task, materials, lease, span, complete });
      requireRuntimeLogWrite(span.terminal({ outcome: "succeeded" }));
      return { record: this.store.readTask(task.job_id)!, result };
    } catch (error) {
      return this.terminalizePluginFailure(span, error, {
        attemptId: lease.attempt_id,
        pluginId: accepted.identity.plugin_id,
      });
    }
  }
}
