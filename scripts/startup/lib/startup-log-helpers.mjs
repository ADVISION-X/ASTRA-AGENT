import path from "node:path";

import {
  RuntimeFailureImpact,
  createRuntimeLogger,
  requireRuntimeLogWrite,
  runtimeFailureFromError,
  runtimeLogEventShapeValid,
} from "../../../src/lib/runtime-logs/index.ts";
import { writeTerminalSink } from "../../../src/lib/runtime-logs/sinks.ts";

const STARTUP_STEPS = new Set([
  "production_contract_preflight",
  "dependency_check", "dependency_runtime", "update_preflight_check", "dependency_update",
  "port_clear", "port_clear_detail", "browser_runtime_preflight", "browser_artifact_sync",
  "app_server", "health_check", "service_shutdown", "service_exit", "open_workbench",
  "open_workbench_detail", "bootstrap_failed", "service_stdout_invalid", "service_stderr",
]);

const assertStartupStep = (stepId) => {
  if (!STARTUP_STEPS.has(stepId)) throw new Error("STARTUP_LOG_STEP_INVALID");
};

const createSpanLogHelpers = (runtimeLogger, traceId) => {
  const openSpans = new Map();
  const start = (stepId) => {
    assertStartupStep(stepId);
    if (openSpans.has(stepId)) return openSpans.get(stepId);
    const span = requireRuntimeLogWrite(runtimeLogger.startSpan({
      traceId, owner: "startup-entrypoint", component: "startup-entrypoint", operation: "startup.step",
      typedIdentity: { kind: "producer", producerId: stepId },
    }));
    openSpans.set(stepId, span);
    return span;
  };
  const pass = (stepId) => {
    requireRuntimeLogWrite(start(stepId).terminal({ outcome: "succeeded" }));
    openSpans.delete(stepId);
  };
  const fail = (stepId, error, impact = RuntimeFailureImpact.BLOCKING, causedByEventId = null) => {
    const terminal = requireRuntimeLogWrite(start(stepId).terminal({
      outcome: "failed",
      failure: runtimeFailureFromError({
        error, code: `STARTUP_${stepId.toUpperCase()}_FAILED`, responsibleOwner: "startup-entrypoint",
        impact, ...(causedByEventId ? { causedByEventId } : {}),
      }),
    }));
    openSpans.delete(stepId);
    return terminal;
  };
  const failOpen = (error) => {
    const failed = [];
    for (const stepId of [...openSpans.keys()].reverse()) {
      const root = failed[0];
      failed.push(fail(stepId, error, root ? RuntimeFailureImpact.CONSEQUENTIAL : RuntimeFailureImpact.BLOCKING,
        root?.eventId ?? null));
    }
    return failed;
  };
  return { start, pass, fail, failOpen };
};

const createServiceRelays = (runtimeLogger, fail) => ({
  stdout(line) {
    const normalized = String(line).trim();
    if (!normalized.startsWith("{")) return;
    try {
      const event = JSON.parse(normalized);
      if (!runtimeLogEventShapeValid(event)) throw new Error("SERVICE_RUNTIME_LOG_SCHEMA_INVALID");
      writeTerminalSink(event, runtimeLogger.getActiveMode());
    } catch (error) {
      fail("service_stdout_invalid", error);
    }
  },
  stderr(line) {
    const normalized = String(line).trim();
    if (normalized.length > 0) fail("service_stderr", new Error("SERVICE_STDERR_RECEIVED"));
  },
});

export function createStartupLogHelpers({ runId, dataDir }) {
  const runtimeLogger = createRuntimeLogger({
    producer: "startup-entrypoint",
    producerRunId: runId,
    owner: "startup-entrypoint",
    component: "startup-entrypoint",
    terminalEnabled: true,
    fileSink: { directoryPath: path.join(dataDir, "runtime-logs") },
  });
  const traceId = `startup:${runId}`;
  const startupIdentity = { kind: "producer", producerId: "startup-entrypoint" };
  let readyLogged = false;
  let stoppedLogged = false;
  requireRuntimeLogWrite(runtimeLogger.emitEvent({
    traceId,
    operation: "runtime.start",
    typedIdentity: startupIdentity,
    code: "PRODUCER_STARTED",
  }));
  requireRuntimeLogWrite(runtimeLogger.emitEvent({
    traceId,
    owner: "runtime-logs",
    component: "runtime-log-sink",
    operation: "runtime.start",
    typedIdentity: startupIdentity,
    code: "RUNTIME_LOG_SINK_READY",
  }));
  const spans = createSpanLogHelpers(runtimeLogger, traceId);
  const relays = createServiceRelays(runtimeLogger, spans.fail);

  const logStartupReady = () => {
    if (readyLogged || stoppedLogged) return;
    requireRuntimeLogWrite(runtimeLogger.emitEvent({
      traceId,
      operation: "runtime.start",
      typedIdentity: startupIdentity,
      code: "STARTUP_READY",
    }));
    readyLogged = true;
  };

  const logStartupStopped = () => {
    if (stoppedLogged) return;
    requireRuntimeLogWrite(runtimeLogger.emitEvent({
      traceId,
      operation: "runtime.shutdown",
      typedIdentity: startupIdentity,
      code: "PRODUCER_STOPPED",
    }));
    stoppedLogged = true;
  };

  return {
    toFailureReason: (error) => error instanceof Error ? error.message : String(error),
    startStartupStep: spans.start,
    completeStartupStep: spans.pass,
    failOpenStartupSteps: spans.failOpen,
    failStartupStep: spans.fail,
    logStartupReady,
    logStartupStopped,
    relayServiceStdoutLine: relays.stdout,
    relayServiceStderrLine: relays.stderr,
  };
}
