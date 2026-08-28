import {
  RuntimeFailureImpact,
  RuntimeRecovery,
  requireRuntimeLogWrite,
  runtimeFailureFromError,
  runtimeLogCauseEventId,
  withRuntimeLogCause,
  type RuntimeSpanHandle,
  type RuntimeSpanTerminalEvent,
} from "../../runtime-logs/index.js";
import type { RuntimeStateInput, RuntimeStateKey, RuntimeStateValue } from "../../runtime-logs/runtime-event-contract.js";
import { typedExecutionFailure } from "../../typed-failure.js";
import { checkpointProductionTask, releaseProductionLease } from "./cloud-client.js";
import { hashCanonical, type ProductionHash } from "./contracts.js";
import type {
  ProductionCheckpointAuthority,
  ProductionLeaseAuthority,
  ProductionOutboxAuthority,
} from "./store.js";
import type { ClaimedProductionTask } from "./transport-protocol.js";
import {
  checkpointAuthority,
  classifyFailure,
  jobIdentity,
  recoveryFor,
  type RuntimeState,
} from "./runtime-state.js";

export const emitRuntimeState = (input: Readonly<{
  state: RuntimeState;
  stateKey: RuntimeStateKey;
  current: RuntimeStateValue;
  traceId?: string;
  authorityRef?: string;
  authorityHash?: `sha256:${string}`;
  freshForMs?: number;
  force?: boolean;
  reconciledFromAuthority?: boolean;
  owner?: "app-shell" | "production-runtime" | "outbox";
}>): void => {
  const traceId = input.traceId ?? `producer:${input.state.runtimeLogger.producerRunId}`;
  const stateSubject = input.stateKey === "browser.mutation" || input.stateKey === "outbox.delivery"
    ? input.authorityRef ?? traceId : traceId;
  const stateIdentity = `${stateSubject}\u0000${input.stateKey}`;
  const previous = input.state.loggedStates.get(stateIdentity) ?? null;
  if (!input.force && previous === input.current) return;
  requireRuntimeLogWrite(input.state.runtimeLogger.emitState({
    traceId, owner: input.owner ?? "production-runtime", component: "production-runtime",
    stateKey: input.stateKey, previous, current: input.current,
    ...(input.freshForMs === undefined ? {} : { freshForMs: input.freshForMs }),
    ...(input.authorityRef && input.authorityHash ? {
      authorityRef: input.authorityRef, authorityHash: input.authorityHash,
      ...(input.reconciledFromAuthority ? { reconciledFromAuthority: true } : {}),
    } : {}),
  } as RuntimeStateInput));
  input.state.loggedStates.set(stateIdentity, input.current);
};

export const emitOutboxAuthority = (
  state: RuntimeState,
  authority: ProductionOutboxAuthority,
  reconciledFromAuthority = false,
): void => emitRuntimeState({
  state, traceId: authority.jobId, stateKey: "outbox.delivery", current: authority.state,
  authorityRef: `production-outbox:${authority.idempotencyKey}`, authorityHash: hashCanonical(authority),
  owner: "outbox", ...(reconciledFromAuthority ? { reconciledFromAuthority: true } : {}),
});

export const emitLeaseAuthority = (
  state: RuntimeState,
  authority: ProductionLeaseAuthority,
  reconciledFromAuthority = false,
): void => emitRuntimeState({
  state, traceId: authority.jobId, stateKey: "job.lease", current: authority.state,
  authorityRef: `production-lease:${authority.jobId}`, authorityHash: hashCanonical(authority),
  ...(reconciledFromAuthority ? { reconciledFromAuthority: true } : {}),
});

export const emitCheckpointAuthority = (
  state: RuntimeState,
  authority: ProductionCheckpointAuthority,
  reconciledFromAuthority = false,
): void => emitRuntimeState({
  state, traceId: authority.jobId, stateKey: "job.checkpoint", current: authority.state,
  authorityRef: `production-checkpoint:${authority.jobId}`, authorityHash: hashCanonical(authority),
  ...(reconciledFromAuthority ? { reconciledFromAuthority: true } : {}),
});

export const terminalSpanFailure = (
  span: RuntimeSpanHandle,
  error: unknown,
  status: ReturnType<typeof classifyFailure>,
  causedByEventId: string | null = runtimeLogCauseEventId(error),
  fallbackCode = "PRODUCTION_ACTION_FAILED",
  authority?: Readonly<{ authorityRef: string; authorityHash: `sha256:${string}` }>,
): RuntimeSpanTerminalEvent => requireRuntimeLogWrite(span.terminal({
  outcome: status === "review_required" ? "review_required" : "failed",
  ...(authority ?? {}),
  failure: runtimeFailureFromError({
    error, code: causedByEventId ? fallbackCode : typedExecutionFailure(error)?.code ?? fallbackCode,
    responsibleOwner: "production-runtime", recovery: recoveryFor(status),
    impact: causedByEventId ? RuntimeFailureImpact.CONSEQUENTIAL : RuntimeFailureImpact.BLOCKING,
    ...(causedByEventId ? { causedByEventId } : {}),
  }),
}));

export const runRuntimeSpan = async <T>(input: Readonly<{
  span: RuntimeSpanHandle;
  action: () => Promise<T>;
  success?: (value: T) => Readonly<{ authorityRef: string; authorityHash: `sha256:${string}` }>;
  failureCode?: string;
}>): Promise<T> => {
  try {
    const value = await input.action();
    requireRuntimeLogWrite(input.span.terminal({ outcome: "success", ...(input.success?.(value) ?? {}) }));
    return value;
  } catch (error) {
    const event = terminalSpanFailure(
      input.span, error, classifyFailure(error), runtimeLogCauseEventId(error), input.failureCode,
    );
    throw withRuntimeLogCause(error, event.eventId);
  }
};

export const runRuntimeSpanSync = <T>(input: Readonly<{
  span: RuntimeSpanHandle;
  action: () => T;
  success: (value: T) => Readonly<{ authorityRef: string; authorityHash: `sha256:${string}` }>;
  failureCode?: string;
}>): T => {
  try {
    const value = input.action();
    requireRuntimeLogWrite(input.span.terminal({ outcome: "success", ...input.success(value) }));
    return value;
  } catch (error) {
    const event = terminalSpanFailure(
      input.span, error, classifyFailure(error), runtimeLogCauseEventId(error), input.failureCode,
    );
    throw withRuntimeLogCause(error, event.eventId);
  }
};

export const checkpointWithLog = async (
  state: RuntimeState,
  job: ClaimedProductionTask,
  parentSpanId: string,
  stage: Parameters<typeof checkpointProductionTask>[3],
  reason: string,
  attemptFailure: Parameters<typeof checkpointProductionTask>[5] = null,
): Promise<ProductionHash> => {
  const span = requireRuntimeLogWrite(state.runtimeLogger.startSpan({
    traceId: job.job_id, parentSpanId, owner: "production-runtime", component: "production-checkpoint",
    operation: "job.checkpoint", typedIdentity: {
      kind: "checkpoint", jobId: job.job_id, attemptId: job.grant.attempt_id, checkpointId: stage,
    },
  }));
  try {
    const receipt = await checkpointProductionTask(state.session, state.store, job, stage, reason, attemptFailure);
    const authority = state.store.recordCheckpoint(checkpointAuthority(job, "persisted", stage, receipt));
    requireRuntimeLogWrite(span.terminal({
      outcome: "success", authorityRef: `production-checkpoint:${job.job_id}`,
      authorityHash: hashCanonical(authority),
    }));
    emitCheckpointAuthority(state, authority);
    return receipt;
  } catch (error) {
    const authority = state.store.recordCheckpoint(checkpointAuthority(job, "failed", stage, null));
    const terminal = terminalSpanFailure(span, error, classifyFailure(error), runtimeLogCauseEventId(error),
      "CHECKPOINT_STORAGE_FAILED", {
        authorityRef: `production-checkpoint:${job.job_id}`, authorityHash: hashCanonical(authority),
      });
    emitCheckpointAuthority(state, authority);
    throw withRuntimeLogCause(error, terminal.eventId);
  }
};

export const releaseLeaseWithLog = async (
  state: RuntimeState,
  job: ClaimedProductionTask,
  parentSpanId: string,
  reason: Parameters<typeof releaseProductionLease>[2],
  causedByEventId: string,
): Promise<void> => {
  const span = requireRuntimeLogWrite(state.runtimeLogger.startSpan({
    traceId: job.job_id, parentSpanId, owner: "production-runtime", component: "production-lease",
    operation: "job.lease-release", typedIdentity: jobIdentity(job),
  }));
  try {
    await releaseProductionLease(state.session, job, reason);
    requireRuntimeLogWrite(span.terminal({ outcome: "success" }));
  } catch (error) {
    const terminal = requireRuntimeLogWrite(span.terminal({
      outcome: "failed", failure: runtimeFailureFromError({
        error, code: "LEASE_RELEASE_FAILED", responsibleOwner: "production-runtime",
        recovery: RuntimeRecovery.REVIEW, impact: RuntimeFailureImpact.CLEANUP, causedByEventId,
      }),
    }));
    throw withRuntimeLogCause(error, terminal.eventId);
  }
};
