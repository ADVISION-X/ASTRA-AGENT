import path from "node:path";

import {
  RuntimeFailureImpact,
  RuntimeRecovery,
  createRuntimeLogger,
  requireRuntimeLogWrite,
  runtimeFailureFromError,
  runtimeLogEventShapeValid,
} from "../../../src/lib/runtime-logs/index.ts";
import { writeTerminalSink } from "../../../src/lib/runtime-logs/sinks.ts";

const STARTUP_STEPS = new Set([
  "dependency_check", "dependency_runtime", "update_preflight_check", "dependency_update",
  "port_clear", "port_clear_detail", "browser_runtime_preflight", "browser_artifact_sync",
  "app_server", "health_check", "service_shutdown", "service_exit", "open_workbench",
  "open_workbench_detail", "bootstrap_failed", "service_stdout_invalid", "service_stderr",
]);

const assertStartupStep = (stepId) => {
  if (!STARTUP_STEPS.has(stepId)) throw new Error("STARTUP_LOG_STEP_INVALID");
};

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
  const openSpans = new Map();
  let lifecycle = "starting";
  requireRuntimeLogWrite(runtimeLogger.emitState({
    traceId,
    stateKey: "producer.lifecycle",
    previous: null,
    current: "starting",
  }));
  requireRuntimeLogWrite(runtimeLogger.emitState({
    traceId,
    owner: "runtime-logs",
    component: "runtime-log-sink",
    stateKey: "log.sink",
    previous: null,
    current: "ready",
  }));
  const start = (stepId) => {
    assertStartupStep(stepId);
    if (openSpans.has(stepId)) return openSpans.get(stepId);
    const span = requireRuntimeLogWrite(runtimeLogger.startSpan({
      traceId,
      owner: "startup-entrypoint",
      component: "startup-entrypoint",
      operation: "startup.step",
      typedIdentity: { kind: "producer", producerId: stepId },
    }));
    openSpans.set(stepId, span);
    return span;
  };

  const pass = (stepId) => {
    const span = start(stepId);
    requireRuntimeLogWrite(span.terminal({ outcome: "success" }));
    openSpans.delete(stepId);
  };

  const fail = (stepId, error, impact = RuntimeFailureImpact.BLOCKING, causedByEventId = null) => {
    const span = start(stepId);
    const terminal = requireRuntimeLogWrite(span.terminal({
      outcome: "failed",
      failure: runtimeFailureFromError({
        error,
        code: `STARTUP_${stepId.toUpperCase()}_FAILED`,
        responsibleOwner: "startup-entrypoint",
        recovery: RuntimeRecovery.STOP,
        impact,
        ...(causedByEventId ? { causedByEventId } : {}),
      }),
    }));
    openSpans.delete(stepId);
    return terminal;
  };

  const failOpenStartupSteps = (error) => {
    const failed = [];
    for (const stepId of [...openSpans.keys()].reverse()) {
      const root = failed[0];
      failed.push(fail(
        stepId,
        error,
        root ? RuntimeFailureImpact.CONSEQUENTIAL : RuntimeFailureImpact.BLOCKING,
        root?.eventId ?? null,
      ));
    }
    return failed;
  };

  const relayServiceStdoutLine = (line) => {
    const normalized = String(line).trim();
    if (!normalized.startsWith("{")) return;
    try {
      const event = JSON.parse(normalized);
      if (!runtimeLogEventShapeValid(event)) throw new Error("SERVICE_RUNTIME_LOG_SCHEMA_INVALID");
      writeTerminalSink(event, runtimeLogger.getActiveMode());
    } catch (error) {
      fail("service_stdout_invalid", error);
    }
  };

  const relayServiceStderrLine = (line) => {
    const normalized = String(line).trim();
    if (normalized.length > 0) fail("service_stderr", new Error("SERVICE_STDERR_RECEIVED"));
  };

  const logStartupReady = () => {
    if (lifecycle !== "starting") return;
    requireRuntimeLogWrite(runtimeLogger.emitState({
      traceId,
      stateKey: "producer.lifecycle",
      previous: "starting",
      current: "ready",
    }));
    lifecycle = "ready";
  };

  const logStartupStopped = () => {
    requireRuntimeLogWrite(runtimeLogger.emitState({
      traceId,
      stateKey: "producer.lifecycle",
      previous: lifecycle,
      current: "stopped",
    }));
    lifecycle = "stopped";
  };

  return {
    toFailureReason: (error) => error instanceof Error ? error.message : String(error),
    startStartupStep: start,
    completeStartupStep: pass,
    failOpenStartupSteps,
    failStartupStep: fail,
    logStartupReady,
    logStartupStopped,
    relayServiceStdoutLine,
    relayServiceStderrLine,
  };
}
