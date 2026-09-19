import { executionFailure, typedExecutionFailure } from "../../execution-failure.js";
import {
  requireRuntimeLogWrite,
  runtimeLogCauseEventId,
  withRuntimeLogCause,
} from "../../runtime-logs/index.js";
import { renewProductionLease } from "./cloud-client.js";
import type { ProductionExecutionLease } from "./contracts.js";
import { terminalSpanFailure } from "./runtime-logging.js";
import {
  jobIdentity,
  safeReason,
  wait,
  type RuntimeState,
} from "./runtime-state.js";
import { typedRuntimeTransportFailure } from "./transport-failure.js";
import type { ClaimedProductionTask } from "./transport-protocol.js";
import type { ProductionWorkerSession } from "./worker-session.js";

const RENEW_RETRY_INTERVAL_MS = 5_000;
const RENEW_RETRY_MIN_LEFT_MS = 8_000;

export const renewFailureRetryable = (error: unknown): boolean => {
  const transport = typedRuntimeTransportFailure(error);
  if (transport) return transport.httpStatus >= 500 && transport.httpStatus < 600;
  return typedExecutionFailure(error)?.code === "CLOUD_TRANSPORT_UNAVAILABLE";
};

export const renewWithinBudget = async (input: Readonly<{
  session: ProductionWorkerSession;
  job: ClaimedProductionTask;
  budget: ProductionExecutionLease;
  signal: AbortSignal;
}>): ReturnType<typeof renewProductionLease> => {
  for (;;) {
    try {
      return await renewProductionLease(input.session, input.job, undefined, input.signal);
    } catch (error) {
      if (input.signal.aborted || !renewFailureRetryable(error)) throw error;
      const leftMs = input.budget.expires_at_monotonic - performance.now();
      const waitMs = Math.min(RENEW_RETRY_INTERVAL_MS, leftMs - RENEW_RETRY_MIN_LEFT_MS);
      if (waitMs <= 0) throw error;
      await wait(waitMs, input.signal);
      if (input.signal.aborted) throw error;
    }
  }
};

export class ProductionRuntimeBoundaryError extends Error {
  public constructor(public readonly boundaryCause: unknown) {
    super(safeReason(boundaryCause));
    this.name = "ProductionRuntimeBoundaryError";
  }
}

type ExecutionTracker<T> = Readonly<{
  promise: Promise<T>;
  isSettled: () => boolean;
  settledBeforeAbort: () => boolean;
}>;

const trackExecution = <T>(execution: Promise<T>, signal: AbortSignal): ExecutionTracker<T> => {
  let settled = false;
  let beforeAbort = false;
  const record = () => {
    settled = true;
    beforeAbort = !signal.aborted;
  };
  return {
    promise: execution.then((value) => { record(); return value; }, (error: unknown) => {
      record();
      throw error;
    }),
    isSettled: () => settled,
    settledBeforeAbort: () => beforeAbort,
  };
};

const runtimeOwnedAbortReason = (signal: AbortSignal): string | null => {
  const reason = typeof signal.reason === "string" ? signal.reason : "";
  return reason === "PRODUCTION_RUNTIME_STOPPED" || reason === "LEASE_RENEW_FAILED"
    || reason === "V6_RENEW_BUDGET_INVALID" || reason.startsWith("CONTROL_INTENT:") ? reason : null;
};

const settleTrackedExecution = async <T>(tracker: ExecutionTracker<T>, signal: AbortSignal): Promise<T> => {
  const runtimeReason = runtimeOwnedAbortReason(signal);
  let value: T;
  try {
    value = await tracker.promise;
  } catch (error) {
    if (runtimeReason && !tracker.settledBeforeAbort()) {
      throw new ProductionRuntimeBoundaryError(executionFailure("failed", runtimeReason, {
        cause: new Error(safeReason(error)),
      }));
    }
    throw error;
  }
  if (runtimeReason && !tracker.settledBeforeAbort()) {
    throw new ProductionRuntimeBoundaryError(executionFailure("failed", runtimeReason));
  }
  return value;
};

export const heartbeatWhileRunning = async <T>(input: Readonly<{
  state: RuntimeState;
  job: ClaimedProductionTask;
  budget: ProductionExecutionLease;
  execution: Promise<T>;
  abort: AbortController;
  parentSpanId: string;
}>): Promise<T> => {
  const tracker = trackExecution(input.execution, input.abort.signal);
  while (!tracker.isSettled() && !input.abort.signal.aborted) {
    try {
      await Promise.race([tracker.promise, wait(20_000, input.abort.signal)]);
    } catch {
      return settleTrackedExecution(tracker, input.abort.signal);
    }
    if (tracker.isSettled() || input.abort.signal.aborted) break;
    const span = requireRuntimeLogWrite(input.state.runtimeLogger.startSpan({
      traceId: input.job.job_id, parentSpanId: input.parentSpanId, owner: "production-runtime",
      component: "production-lease", operation: "job.lease-renew", typedIdentity: jobIdentity(input.job),
    }));
    let receipt;
    try {
      receipt = await renewWithinBudget({
        session: input.state.session, job: input.job,
        budget: input.budget, signal: input.abort.signal,
      });
      requireRuntimeLogWrite(span.terminal({ outcome: "succeeded" }));
    } catch (error) {
      const terminal = terminalSpanFailure(span, error, runtimeLogCauseEventId(error),
        "LEASE_RENEW_FAILED");
      input.abort.abort("LEASE_RENEW_FAILED");
      await Promise.allSettled([tracker.promise]);
      throw new ProductionRuntimeBoundaryError(withRuntimeLogCause(error, terminal.eventId));
    }
    if (receipt.control_intent.intent !== "none") {
      input.abort.abort(
        `CONTROL_INTENT:${receipt.control_intent.intent}:${receipt.control_intent.reason_code ?? "none"}`,
      );
      continue;
    }
    const relative = Date.parse(receipt.lease_expires_at) - Date.parse(receipt.server_now);
    if (!Number.isFinite(relative) || relative < 30_000) {
      input.abort.abort("V6_RENEW_BUDGET_INVALID");
      await Promise.allSettled([tracker.promise]);
      throw new ProductionRuntimeBoundaryError(executionFailure("failed", "V6_RENEW_BUDGET_INVALID"));
    }
    input.budget.expires_at_monotonic = performance.now() + relative - 10_000;
    input.budget.command_ttl_ms = Math.min(20_000, relative - 10_000);
  }
  return settleTrackedExecution(tracker, input.abort.signal);
};
