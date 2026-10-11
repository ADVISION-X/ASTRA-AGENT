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
      await waitForRenewal(input.signal, waitMs);
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
  promise: Promise<{ status: "fulfilled"; value: T } | { status: "rejected"; reason: unknown }>;
  settledBeforeAbort: () => boolean;
}>;

const runtimeOwnedAbortReason = (signal: AbortSignal): string | null => {
  const reason = typeof signal.reason === "string" ? signal.reason : "";
  return reason === "PRODUCTION_RUNTIME_STOPPED" || reason === "LEASE_RENEW_FAILED"
    || reason === "V6_RENEW_BUDGET_INVALID" || reason.startsWith("CONTROL_INTENT:") ? reason : null;
};

const trackExecution = <T>(execution: Promise<T>, signal: AbortSignal, onSettled: () => void): ExecutionTracker<T> => {
  let beforeAbort = false;
  const record = () => { beforeAbort = !signal.aborted; onSettled(); };
  return { promise: execution.then(value => { record(); return { status: "fulfilled" as const, value }; },
    (reason: unknown) => { record(); return { status: "rejected" as const, reason }; }),
    settledBeforeAbort: () => beforeAbort };
};

const settleTrackedExecution = async <T>(tracker: ExecutionTracker<T>, signal: AbortSignal): Promise<T> => {
  const runtimeReason = runtimeOwnedAbortReason(signal), settled = await tracker.promise;
  if (settled.status === "rejected") {
    if (runtimeReason && !tracker.settledBeforeAbort()) {
      throw new ProductionRuntimeBoundaryError(executionFailure("failed", runtimeReason, {
        cause: new Error(safeReason(settled.reason)),
      }));
    }
    throw settled.reason;
  }
  if (runtimeReason && !tracker.settledBeforeAbort()) {
    throw new ProductionRuntimeBoundaryError(executionFailure("failed", runtimeReason));
  }
  return settled.value;
};

type RenewalLifetime = {
  stopped: boolean;
  wake: (() => void) | null;
  inFlight: Promise<void> | null;
};

const waitForRenewal = (signal: AbortSignal, milliseconds: number, lifetime?: RenewalLifetime): Promise<void> =>
  new Promise(resolve => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      if (lifetime) lifetime.wake = null;
      resolve();
    };
    const timer = setTimeout(finish, milliseconds);
    if (lifetime) lifetime.wake = finish;
    signal.addEventListener("abort", finish, { once: true });
    if (lifetime?.stopped || signal.aborted) finish();
  });

type HeartbeatInput<T> = Readonly<{
  state: RuntimeState; job: ClaimedProductionTask; budget: ProductionExecutionLease;
  execute: (stopAndJoinRenewal: () => Promise<void>) => Promise<T>;
  abort: AbortController; parentSpanId: string;
}>;

const renewExecutionLease = async (input: HeartbeatInput<unknown>): Promise<void> => {
  const span = requireRuntimeLogWrite(input.state.runtimeLogger.startSpan({
    traceId: input.job.job_id, parentSpanId: input.parentSpanId, owner: "production-runtime",
    component: "production-lease", operation: "job.lease-renew", typedIdentity: jobIdentity(input.job),
  }));
  let receipt;
  try {
    receipt = await renewWithinBudget({ session: input.state.session, job: input.job,
      budget: input.budget, signal: input.abort.signal });
    requireRuntimeLogWrite(span.terminal({ outcome: "succeeded" }));
  } catch (error) {
    const terminal = terminalSpanFailure(span, error, runtimeLogCauseEventId(error), "LEASE_RENEW_FAILED");
    input.abort.abort("LEASE_RENEW_FAILED");
    throw new ProductionRuntimeBoundaryError(withRuntimeLogCause(error, terminal.eventId));
  }
  if (receipt.control_intent.intent !== "none") {
    input.abort.abort(`CONTROL_INTENT:${receipt.control_intent.intent}:${receipt.control_intent.reason_code ?? "none"}`);
    return;
  }
  const relative = Date.parse(receipt.lease_expires_at) - Date.parse(receipt.server_now);
  if (!Number.isFinite(relative) || relative < 30_000) {
    input.abort.abort("V6_RENEW_BUDGET_INVALID");
    throw new ProductionRuntimeBoundaryError(executionFailure("failed", "V6_RENEW_BUDGET_INVALID"));
  }
  input.budget.expires_at_monotonic = performance.now() + relative - 10_000;
  input.budget.command_ttl_ms = Math.min(20_000, relative - 10_000);
};

export const heartbeatWhileRunning = async <T>(input: HeartbeatInput<T>): Promise<T> => {
  const lifetime: RenewalLifetime = { stopped: false, wake: null, inFlight: null };
  const stop = () => { lifetime.stopped = true; lifetime.wake?.(); };
  const stopAndJoinRenewal = async () => {
    stop(); await lifetime.inFlight;
    if (input.abort.signal.aborted) throw new ProductionRuntimeBoundaryError(executionFailure("failed",
      runtimeOwnedAbortReason(input.abort.signal) ?? "PRODUCTION_RUNTIME_STOPPED"));
  };
  const tracker = trackExecution(Promise.resolve().then(() => input.execute(stopAndJoinRenewal)), input.abort.signal, stop);
  try {
    while (!lifetime.stopped && !input.abort.signal.aborted) {
      await waitForRenewal(input.abort.signal, 20_000, lifetime);
      if (lifetime.stopped || input.abort.signal.aborted) break;
      lifetime.inFlight = renewExecutionLease(input);
      await lifetime.inFlight;
      lifetime.inFlight = null;
    }
  } catch (error) {
    stop();
    input.abort.abort("LEASE_RENEW_FAILED");
    await tracker.promise;
    throw error;
  } finally { stop(); }
  return settleTrackedExecution(tracker, input.abort.signal);
};
