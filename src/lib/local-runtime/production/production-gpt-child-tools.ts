import { createHash } from "node:crypto";

import {
  GPT_CHILD_CAPABILITY_CONTRACTS,
  type GptAbilityGroup,
  type GptChildCapabilityIntent,
  type GptChildCapabilityProof,
  type GptChildCapabilityResult,
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
import { hashCanonical, type ProductionHash, type WebsiteAgentTask } from "./contracts.js";
import type { ProductGptChildResult, ProductGptTools } from "./plugin.js";
import type { ProductionExecutionLease } from "./executor.js";
import { ProductionRuntimeStore } from "./store.js";
import {
  childFailureEventIds,
  persistGptChildEvidence,
  persistedEvidenceRefs,
} from "./gpt-evidence-writer.js";

type ExecutionInput = Readonly<{
  task: WebsiteAgentTask;
  pluginId: string;
  pluginVersion: number;
  lease: ProductionExecutionLease;
  parentSpanId: string;
}>;

type ActiveBrowserCall = Readonly<{
  sessionKey: string;
  browser: BrowserTargetLease;
}>;

export type ProductGptExecution = Readonly<{
  tools: ProductGptTools;
  continuationRef(): string | null;
  settle(error: unknown | null): Promise<void>;
}>;

const hashText = (value: string): ProductionHash =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const throwChildFailure = (result: GptChildCapabilityResult): never => {
  const error = executionFailure("failed", result.failureCode ?? "GPT_CHILD_FAILED", {
    mutationOutcome: result.proof.committedMutation,
    evidenceRef: persistedEvidenceRefs.get(result) ?? null,
    evidenceHash: result.proof.evidenceHash,
  });
  const causeEventId = childFailureEventIds.get(result);
  throw causeEventId ? withRuntimeLogCause(error, causeEventId) : error;
};

const recoveredProof = (input: Readonly<{
  intent: GptChildCapabilityIntent;
  browser: BrowserTargetLease;
  readback: GptChildCapabilityResult | null;
  authorityRef: string;
  state: "confirmed" | "rejected";
}>): GptChildCapabilityProof => {
  const timestamp = new Date().toISOString();
  const unsigned = {
    schemaVersion: "gpt-child-capability-proof.v2" as const,
    childCapabilityId: input.intent.childCapabilityId,
    executionId: input.intent.executionId,
    attemptId: input.intent.attemptId,
    pluginId: input.intent.pluginId,
    pluginVersion: input.intent.pluginVersion,
    productStepId: input.intent.productStepId,
    callId: input.intent.callId,
    inputHash: input.intent.inputHash,
    actionOrdinal: input.intent.actionOrdinal,
    targetRefHash: hashText(input.browser.target.targetRef),
    beforeDocumentRefHash: hashText(input.browser.document.documentRef),
    afterDocumentRefHash: hashText(input.browser.document.documentRef),
    candidateCount: input.readback?.proof.candidateCount ?? null,
    observedSemantics: Object.freeze([
      ...(input.readback?.proof.observedSemantics ?? []),
      `browser-wal-${input.state}`,
    ]),
    committedMutation: "confirmed" as const,
    postconditionResult: input.state === "confirmed" ? "passed" as const : "failed" as const,
    startedAt: input.readback?.proof.startedAt ?? timestamp,
    endedAt: input.readback?.proof.endedAt ?? timestamp,
  };
  const evidenceHash = hashText(JSON.stringify(unsigned));
  return Object.freeze({
    ...unsigned,
    evidenceRef: input.authorityRef,
    evidenceHash,
  });
};

const recoveredResult = (input: Readonly<{
  intent: GptChildCapabilityIntent;
  browser: BrowserTargetLease;
  readback: GptChildCapabilityResult | null;
  authorityRef: string;
  state: "confirmed" | "rejected";
}>): GptChildCapabilityResult => Object.freeze({
  status: input.state === "confirmed" ? "success" : "failed",
  value: input.state === "confirmed" ? input.readback?.value ?? null : null,
  proof: recoveredProof(input),
  failureCode: input.state === "confirmed" ? null : "BROWSER_POSTCONDITION_FAILED",
});

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
    const browsers = new Map<string, ActiveBrowserCall>();
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
        execute,
      }),
      continuationRef: () => continuationRef,
      settle: (error) => this.settleBrowsers(browsers, error),
    });
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
    throw withRuntimeLogCause(failure, terminal.eventId);
  }

  private async executeOne(
    execution: ExecutionInput,
    browsers: Map<string, ActiveBrowserCall>,
    call: Parameters<ProductGptTools["execute"]>[0],
  ): Promise<ProductGptChildResult> {
    const inputHash = hashCanonical(call.input);
    const intent: GptChildCapabilityIntent = Object.freeze({
      childCapabilityId: call.child,
      executionId: [
        execution.task.job_id,
        execution.lease.attempt_id,
        execution.pluginId,
        execution.pluginVersion,
        call.productStepId,
        call.callId,
        call.child,
        inputHash.slice(7, 23),
      ].join(":"),
      attemptId: execution.lease.attempt_id,
      pluginId: execution.pluginId,
      pluginVersion: execution.pluginVersion,
      productStepId: call.productStepId,
      callId: call.callId,
      inputHash,
      actionOrdinal: call.actionOrdinal,
      input: call.input,
    });
    const contract = GPT_CHILD_CAPABILITY_CONTRACTS[call.child];
    const browser = contract.requiredTargetKind === "chatgpt"
      ? await this.browserFor(execution, browsers, call.sessionKey, call.productStepId, call.callId)
      : undefined;
    if (call.child === "submit_exact_gpt_turn_once"
      && this.browserAuthority.countProviderTurnDispatches(
        execution.task.job_id,
        execution.lease.attempt_id,
      ) >= execution.lease.max_provider_turns) {
      throw executionFailure("failed", "PROVIDER_TURN_BUDGET_EXHAUSTED");
    }
    const span = this.childSpan(execution, intent);
    let result: GptChildCapabilityResult;
    let evidenceRef: string;
    let resolveDispatched = false;
    try {
      const atomic = await this.runAtomic(intent, browser, execution.lease.abort_signal);
      result = atomic.result;
      resolveDispatched = atomic.resolveDispatched;
      evidenceRef = await persistGptChildEvidence({
        result,
        intent,
        evidenceStore: this.evidenceStore,
        jobId: execution.task.job_id,
        attemptId: execution.lease.attempt_id,
        stepId: call.productStepId,
      });
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
    return Object.freeze({ value: result.value, evidenceRef, evidenceHash: result.proof.evidenceHash });
  }

  private async runAtomic(
    intent: GptChildCapabilityIntent,
    browser: BrowserTargetLease | undefined,
    signal: AbortSignal,
  ): Promise<Readonly<{ result: GptChildCapabilityResult; resolveDispatched: boolean }>> {
    const context = {
      dataDir: this.dataDir,
      ...(browser ? { browser } : {}),
      signal,
      continuationStore: this.store,
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
        result: recoveredResult({
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
      result: recoveredResult({
        intent,
        browser,
        readback,
        authorityRef: recovery.authorityRef,
        state: "confirmed",
      }),
      resolveDispatched: recovery.state === "dispatched",
    };
  }

  private async browserFor(
    input: ExecutionInput,
    browsers: Map<string, ActiveBrowserCall>,
    sessionKey: string,
    productStepId: string,
    callId: string,
  ): Promise<BrowserTargetLease> {
    if (!sessionKey) throw executionFailure("failed", "GPT_SESSION_KEY_REQUIRED");
    const current = browsers.get(sessionKey);
    if (current) return current.browser;
    const remaining = Math.floor(input.lease.expires_at_monotonic - performance.now());
    const commandTtlMs = Math.min(input.lease.command_ttl_ms, remaining);
    if (commandTtlMs < 1) throw executionFailure("failed", "V6_DEADLINE_BUDGET_EXHAUSTED");
    const executionRef = [
      input.task.job_id,
      input.lease.attempt_id,
      input.pluginId,
      productStepId,
      callId,
    ].join(":");
    const browser = await this.browserAuthority.acquireJobBoundTargetLease({
      kind: "production",
      ownerPluginId: input.pluginId,
      jobId: input.task.job_id,
      productStepId,
      attemptId: input.lease.attempt_id,
      deviceId: input.lease.device_id,
      leaseVersion: input.lease.lease_version,
      localOrderId: input.task.job_id,
      contractManifestHash: input.lease.control_manifest_hash,
      executionRef,
      jobRefHash: hashText(input.task.job_id),
      executionRefHash: hashText(executionRef),
      writerLeaseEpoch: input.lease.lease_version,
      writerFenceHash: input.lease.execution_fence_hash,
      candidateHash: this.sourceHash,
      commandTtlMs,
    }, `${input.pluginId}:${input.task.job_id}:${callId}`, {
      signal: input.lease.abort_signal,
      remainingMs: () => Math.floor(input.lease.expires_at_monotonic - performance.now()),
    });
    browsers.set(sessionKey, { sessionKey, browser });
    return browser;
  }

  private async settleBrowsers(
    browsers: Map<string, ActiveBrowserCall>,
    error: unknown | null,
  ): Promise<void> {
    const failures: unknown[] = [];
    for (const [key, call] of browsers) {
      try {
        const unresolved = call.browser.pendingMutationCount() > 0
          || call.browser.requiresMutationRecovery();
        if (unresolved) await call.browser.park({ reason: "gpt-mutation-reconciliation-required" });
        else await call.browser.close({ reason: error ? "gpt-product-call-failed" : "gpt-product-call-settled" });
      } catch (closeError) {
        failures.push(closeError);
      } finally {
        browsers.delete(key);
      }
    }
    if (failures.length > 0) {
      throw new AggregateError(error ? [error, ...failures] : failures, "GPT_BROWSER_LIFECYCLE_FAILED");
    }
  }
}
