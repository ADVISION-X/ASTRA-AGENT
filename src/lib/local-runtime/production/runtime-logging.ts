import {
  RuntimeFailureImpact,
  requireRuntimeLogWrite,
  runtimeFailureFromError,
  runtimeLogCauseEventId,
  withRuntimeLogCause,
  type RuntimeLogOwner,
  type RuntimeSpanHandle,
  type RuntimeSpanTerminalEvent,
} from "../../runtime-logs/index.js";
import { typedExecutionFailure } from "../../execution-failure.js";
import {
  releaseProductionLease,
  type ProductionLeaseRelease,
} from "./cloud-client.js";
import type { ClaimedProductionTask } from "./transport-protocol.js";
import { typedRuntimeTransportFailure } from "./transport-failure.js";
import {
  jobIdentity,
  type RuntimeState,
} from "./runtime-state.js";

export const terminalSpanFailure = (
  span: RuntimeSpanHandle,
  error: unknown,
  causedByEventId: string | null = runtimeLogCauseEventId(error),
  fallbackCode = "PRODUCTION_ACTION_FAILED",
  authority?: Readonly<{ authorityRef: string; authorityHash: `sha256:${string}` }>,
  responsibleOwner?: RuntimeLogOwner,
): RuntimeSpanTerminalEvent => requireRuntimeLogWrite(span.terminal({
  outcome: "failed",
  ...(authority ?? {}),
  failure: runtimeFailureFromError({
    error, code: typedExecutionFailure(error)?.code ?? fallbackCode,
    responsibleOwner: responsibleOwner
      ?? (typedRuntimeTransportFailure(error) ? "website" : "production-runtime"),
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
    requireRuntimeLogWrite(input.span.terminal({ outcome: "succeeded", ...(input.success?.(value) ?? {}) }));
    return value;
  } catch (error) {
    const event = terminalSpanFailure(
      input.span, error, runtimeLogCauseEventId(error), input.failureCode,
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
    requireRuntimeLogWrite(input.span.terminal({ outcome: "succeeded", ...input.success(value) }));
    return value;
  } catch (error) {
    const event = terminalSpanFailure(
      input.span, error, runtimeLogCauseEventId(error), input.failureCode,
    );
    throw withRuntimeLogCause(error, event.eventId);
  }
};

export const releaseLeaseWithLog = async (
  state: RuntimeState,
  job: ClaimedProductionTask,
  parentSpanId: string,
  release: ProductionLeaseRelease,
  causedByEventId: string,
  stableRequestId?: string,
): Promise<string> => {
  const span = requireRuntimeLogWrite(state.runtimeLogger.startSpan({
    traceId: job.job_id, parentSpanId, owner: "production-runtime", component: "production-lease",
    operation: "job.lease-release", typedIdentity: jobIdentity(job),
  }));
  try {
    const requestId = await releaseProductionLease(state.session, job, release, stableRequestId);
    requireRuntimeLogWrite(span.terminal({ outcome: "succeeded" }));
    return requestId;
  } catch (error) {
    const terminal = requireRuntimeLogWrite(span.terminal({
      outcome: "failed", failure: runtimeFailureFromError({
        error, code: "LEASE_RELEASE_FAILED", responsibleOwner: "production-runtime",
        impact: RuntimeFailureImpact.CLEANUP, causedByEventId,
      }),
    }));
    throw withRuntimeLogCause(error, terminal.eventId);
  }
};
