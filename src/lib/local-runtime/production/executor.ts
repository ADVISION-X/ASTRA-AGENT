import { link, lstat, unlink } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import {
  createProductionGptChildTools,
  type GptAbilityGroup,
} from "../../../capabilities/gpt/index.js";
import type { ForensicsPersistenceAbilityGroup } from "../../../capabilities/forensics-persistence/index.js";
import {
  RuntimeFailureImpact, requireRuntimeLogWrite, runtimeFailureFromError,
  runtimeLogCauseEventId, withRuntimeLogCause, type RuntimeLogger, type RuntimeSpanHandle,
} from "../../runtime-logs/index.js";
import { executionFailure, failureCode, typedExecutionFailure } from "../../execution-failure.js";
import type { WorkbenchBrowserAuthority } from "../workbench-browser-authority-support.js";
import { authorizeWebsiteAgentTask, dispatchWebsiteAgentTask } from "../../../mediator/agent-production-route.js";
import type {
  GeneratedImageArtifact,
  GeneratedImageResultReceipt,
  ProductPluginOutput,
} from "../../../mediator/product-plugin-contract.js";
import type {
  DurablePluginIdentity, LocalProductionMaterial, ProductionExecutionLease, ProductionHash,
  WebsiteAgentResult, WebsiteAgentTask,
} from "./contracts.js";
import { assertProductionTaskRoutePolicy, productionRoutePolicy } from "./route-policy.js";
import { ProductionRuntimeStore, type StoredProductionTask } from "./store.js";

export interface ProductionExecutionResult {
  readonly record: StoredProductionTask;
  readonly result: WebsiteAgentResult;
}

type ActiveGptExecution = ReturnType<ReturnType<typeof createProductionGptChildTools>["createExecution"]>;
type GptExecutionLifecycle = {
  reconcilePermanentCancellation: (() => Promise<void>) | null;
  settle: ((error: unknown | null) => Promise<void>) | null;
};

const settleGptExecution = async (
  lifecycle: GptExecutionLifecycle,
  abortSignal: AbortSignal,
  primaryError: unknown,
): Promise<void> => {
  try {
    const cancellationReason = typeof abortSignal.reason === "string" ? abortSignal.reason : "";
    if (cancellationReason === "CONTROL_INTENT:cancel_requested:PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED"
      && lifecycle.reconcilePermanentCancellation) await lifecycle.reconcilePermanentCancellation();
    if (lifecycle.settle) await lifecycle.settle(primaryError);
  } catch (settleError) {
    if (primaryError === null) throw settleError;
    const combined = new AggregateError([settleError], "GPT_BROWSER_LIFECYCLE_FAILED", { cause: primaryError });
    const causedByEventId = runtimeLogCauseEventId(primaryError);
    throw causedByEventId ? withRuntimeLogCause(combined, causedByEventId) : combined;
  }
};

const durableIdentityValid = (
  accepted: StoredProductionTask,
  task: WebsiteAgentTask,
): boolean => {
  const current = authorizeWebsiteAgentTask(task);
  const identity = accepted.identity;
  return identity.plugin_id === current.identity.plugin_id
    && identity.plugin_version === current.identity.plugin_version
    && identity.skill_hash === current.identity.skill_hash
    && identity.checkpoint_schema_version === current.identity.checkpoint_schema_version
    && identity.request_hash === task.request_hash;
};

const errno = (error: unknown): string | null =>
  error && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code : null;

const assertProviderDisplayName = (providerDisplayName: string): void => {
  if (!providerDisplayName || providerDisplayName !== providerDisplayName.normalize("NFC")
    || providerDisplayName === "." || providerDisplayName === ".."
    || providerDisplayName.includes("/") || providerDisplayName.includes("\\")
    || basename(providerDisplayName) !== providerDisplayName
    || Buffer.byteLength(providerDisplayName, "utf8") > 255) {
    throw executionFailure("failed", "PRODUCTION_MATERIAL_UPLOAD_ALIAS_INVALID");
  }
};

const materializeUploadAlias = async (
  material: LocalProductionMaterial,
  providerDisplayName: string,
): Promise<Readonly<{ aliasPath: string; dev: number; ino: number }>> => {
  assertProviderDisplayName(providerDisplayName);
  const sourcePath = material.local_path;
  const aliasPath = join(dirname(sourcePath), providerDisplayName);
  if (aliasPath === sourcePath) return Object.freeze({ aliasPath, dev: 0, ino: 0 });
  const source = await lstat(sourcePath);
  if (!source.isFile() || source.size !== material.bytes) {
    throw executionFailure("failed", "PRODUCTION_MATERIAL_UPLOAD_ALIAS_INVALID");
  }
  try {
    await link(sourcePath, aliasPath);
  } catch (error) {
    if (errno(error) !== "EEXIST") {
      throw executionFailure("failed", "PRODUCTION_MATERIAL_UPLOAD_ALIAS_UNAVAILABLE", { cause: error });
    }
  }
  const alias = await lstat(aliasPath);
  if (!alias.isFile() || alias.dev !== source.dev || alias.ino !== source.ino
    || alias.size !== source.size) {
    throw executionFailure("failed", "PRODUCTION_MATERIAL_UPLOAD_ALIAS_INVALID");
  }
  return Object.freeze({ aliasPath, dev: alias.dev, ino: alias.ino });
};

const productionMaterialBrowserArtifact = (material: LocalProductionMaterial) => {
  const aliases = new Map<string, Readonly<{ dev: number; ino: number }>>();
  const materializeProviderPath = async (providerDisplayName: string): Promise<string> => {
    const alias = await materializeUploadAlias(material, providerDisplayName);
    if (alias.aliasPath !== material.local_path) {
      aliases.set(alias.aliasPath, { dev: alias.dev, ino: alias.ino });
    }
    return alias.aliasPath;
  };
  const releaseProviderPaths = async (): Promise<void> => {
    const failures: unknown[] = [];
    for (const [aliasPath, identity] of aliases) {
      try {
        const current = await lstat(aliasPath);
        if (!current.isFile() || current.dev !== identity.dev || current.ino !== identity.ino) {
          throw executionFailure("failed", "PRODUCTION_MATERIAL_UPLOAD_ALIAS_RELEASE_INVALID");
        }
        await unlink(aliasPath);
      } catch (error) {
        if (errno(error) !== "ENOENT") failures.push(error);
      }
    }
    aliases.clear();
    if (failures.length > 0) throw executionFailure(
      "failed", "PRODUCTION_MATERIAL_UPLOAD_ALIAS_RELEASE_FAILED",
      { cause: new AggregateError(failures) },
    );
  };
  return Object.freeze({
    artifactRef: material.material_id,
    localPath: material.local_path,
    contentHash: material.sha256,
    sizeBytes: material.bytes,
    materializeProviderPath,
    releaseProviderPaths,
  });
};

const pluginIdentity = (task: WebsiteAgentTask): DurablePluginIdentity => {
  const resolved = authorizeWebsiteAgentTask(task);
  return {
    plugin_id: resolved.identity.plugin_id,
    plugin_version: resolved.identity.plugin_version,
    skill_hash: resolved.identity.skill_hash,
    checkpoint_schema_version: resolved.identity.checkpoint_schema_version,
    request_hash: task.request_hash,
  };
};

export class ProductionExecutor {
  private readonly gptChildTools: ReturnType<typeof createProductionGptChildTools>;
  private readonly browserAuthority: WorkbenchBrowserAuthority;

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
    this.browserAuthority = input.browserAuthority;
    this.gptChildTools = createProductionGptChildTools(
      input.dataDir, input.sourceHash, input.gpt, input.evidenceStore,
      input.browserAuthority, {
        continuationStore: store,
        continuationReadback: {
          readGptContinuation: (continuationRef) => store.readGptContinuation(continuationRef),
          readGptContinuationForOriginJob: (jobId, pluginId, turnMarker) =>
            store.readGptContinuationForOriginJob(jobId, pluginId, turnMarker),
          readGptContinuationForFrontier: (frontierRef) => store.readGptContinuationForFrontier(frontierRef),
          readTaskPluginVersion: (jobId) => store.readTask(jobId)?.identity.plugin_version ?? null,
        },
      }, runtimeLogger,
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
    uploadGeneratedImage: (artifact: GeneratedImageArtifact) => Promise<GeneratedImageResultReceipt>;
  }>): Promise<WebsiteAgentResult> {
    let completed = false;
    let gptExecution: ActiveGptExecution | null = null;
    const gptLifecycle: GptExecutionLifecycle = { reconcilePermanentCancellation: null, settle: null };
    let primaryError: unknown = null;
    let result: WebsiteAgentResult;
    try {
      result = await dispatchWebsiteAgentTask(input.task, (authorized) => {
        gptExecution = this.gptChildTools.createExecution({
          jobId: authorized.task.job_id,
          continuationRef: authorized.task.continuation_ref ?? null,
          ownerRef: authorized.task.business_identity.owner_ref,
          subjectRef: authorized.task.business_identity.subject_ref,
          authorizationRef: authorized.task.business_identity.authorization_ref,
          pluginId: authorized.identity.plugin_id,
          pluginVersion: authorized.identity.plugin_version,
          attemptId: input.lease.attempt_id,
          deviceId: input.lease.device_id,
          leaseVersion: input.lease.lease_version,
          executionFenceHash: input.lease.execution_fence_hash,
          capabilityManifestHash: input.lease.capability_manifest_hash,
          maxProviderTurns: input.lease.max_provider_turns,
          get expiresAtMonotonic() { return input.lease.expires_at_monotonic; },
          get commandTtlMs() { return input.lease.command_ttl_ms; },
          abortSignal: input.lease.abort_signal,
          parentSpanId: input.span.spanId,
        });
        gptLifecycle.reconcilePermanentCancellation = gptExecution.reconcilePermanentCancellation;
        gptLifecycle.settle = gptExecution.settle;
        return {
          materials: input.materials,
          routePolicy: productionRoutePolicy(authorized.task.product_id, authorized.task.action_id),
          gpt: gptExecution.tools,
          uploadGeneratedImage: input.uploadGeneratedImage,
          complete: async (output) => {
            if (input.lease.abort_signal.aborted) {
              throw executionFailure("failed", typeof input.lease.abort_signal.reason === "string"
                ? input.lease.abort_signal.reason : "PRODUCTION_EXECUTION_ABORTED");
            }
            if (completed) throw new Error("PLUGIN_RESULT_ALREADY_COMPLETED");
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
      await settleGptExecution(gptLifecycle, input.lease.abort_signal, primaryError);
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
    uploadGeneratedImage: (artifact: GeneratedImageArtifact) => Promise<GeneratedImageResultReceipt>,
  ): Promise<ProductionExecutionResult> {
    const accepted = this.store.readTask(task.job_id);
    if (!accepted) throw new Error("PRODUCTION_DURABLE_IDENTITY_MISSING");
    if (accepted.status === "completed" && accepted.result) throw new Error("PRODUCTION_TASK_ALREADY_TERMINAL");
    assertProductionTaskRoutePolicy(task);
    if (!durableIdentityValid(accepted, task)) {
      throw executionFailure("failed", "PRODUCTION_PLUGIN_DURABLE_IDENTITY_MISMATCH");
    }
    const span = this.startPluginSpan(task, lease, parentSpanId, accepted.identity.plugin_id);
    let browserArtifactLease: Awaited<ReturnType<WorkbenchBrowserAuthority["bindExecutionArtifacts"]>> | null = null;
    try {
      browserArtifactLease = await this.browserAuthority.bindExecutionArtifacts({
        binding: {
          ownerPluginId: accepted.identity.plugin_id,
          pluginVersion: accepted.identity.plugin_version,
          jobId: task.job_id,
          attemptId: lease.attempt_id,
          deviceId: lease.device_id,
          leaseVersion: lease.lease_version,
          writerFenceHash: lease.execution_fence_hash,
        },
        artifacts: materials.map(productionMaterialBrowserArtifact),
      });
      const result = await this.dispatchPlugin({ task, materials, lease, span, complete, uploadGeneratedImage });
      try {
        await browserArtifactLease.release();
      } catch (cleanupError) {
        throw new AggregateError(
          [cleanupError], "GPT_BROWSER_LIFECYCLE_FAILED", { cause: cleanupError },
        );
      }
      browserArtifactLease = null;
      requireRuntimeLogWrite(span.terminal({ outcome: "succeeded" }));
      return { record: this.store.readTask(task.job_id)!, result };
    } catch (error) {
      let failure = error;
      if (browserArtifactLease) {
        try {
          await browserArtifactLease.release();
        } catch (cleanupError) {
          failure = new AggregateError(
            [cleanupError], "GPT_BROWSER_LIFECYCLE_FAILED", { cause: error },
          );
        }
      }
      return this.terminalizePluginFailure(span, failure, {
        attemptId: lease.attempt_id,
        pluginId: accepted.identity.plugin_id,
      });
    }
  }
}
