function createStructuredLoggers({ terminalLogger, runId }) {
  const toFailureReason = (error) => error instanceof Error ? error.message : String(error);

  const logEvent = (...[phase, component, eventType, status, message, extra = {}]) => {
    terminalLogger.event({ phase, component, eventType, status, message, runId, ...extra });
  };

  const logPass = (...[phase, component, eventType, status, message, extra = {}]) => {
    terminalLogger.pass({ phase, component, eventType, status, message, runId, ...extra });
  };

  const logFail = (...[phase, component, eventType, status, message, extra = {}]) => {
    terminalLogger.fail({ phase, component, eventType, status, message, runId, ...extra });
  };

  return {
    toFailureReason,
    logEvent,
    logPass,
    logFail,
  };
}

function createLocalAiLogHelpers({ logPass, logFail }) {
  const getLocalAiRefs = (readiness) => readiness.modelRoles.map((role) => `${role.modelRole}=${role.health}:${role.modelName}`);

  const logLocalAiPhase = (eventType, passed, message, extra = {}) => {
    const log = passed ? logPass : logFail;
    log("AI", "local_ai_runtime", eventType, passed ? "passed" : "failed", message, extra);
  };

  const isRuntimeFailureReason = (reason) => {
    return reason === "LOCAL_AI_RUNTIME_NOT_FOUND" || reason === "LOCAL_AI_RUNTIME_START_FAILED" || reason === "LOCAL_AI_READINESS_TIMEOUT";
  };

  return {
    logLocalAiPhase,
    isRuntimeFailureReason,
    getLocalAiRefs,
  };
}

function createMissionAndRuntimeLogHelpers({ logEvent, logPass, logFail, getLocalAiRefs, baseUrl }) {
  const logMissionReadinessStarted = () => {
    logEvent("MISSION", "mission_readiness", "MISSION_READINESS_CHECK_STARTED", "started", "checking startup mission readiness after map and online AI selection");
  };

  const logMissionReadinessPassed = (readiness) => {
    logPass("MISSION", "mission_readiness", "MISSION_READINESS_PASSED", "passed", "startup mission readiness gates passed", {
      refs: getLocalAiRefs(readiness),
    });
  };

  const logMissionReadinessDegraded = (reason) => {
    logFail("MISSION", "mission_readiness", "MISSION_READINESS_DEGRADED", "failed", reason, {
      failureReason: reason,
    });
  };

  const markMissionRuntimeAvailable = (readiness) => {
    logPass("MISSION", "mission_runtime", "mission_runtime_available", "passed", "mission runtime is available after startup gate passed", {
      refs: getLocalAiRefs(readiness),
    });
  };

  const logStartupReady = () => {
    logPass("RUNTIME", "startup_entrypoint", "terminal_structured_log_relay", "ready", "terminal structured log relay active", {
      refs: ["/api/runtime/logs", "/api/runtime/actions", "/api/runtime/mission-readiness"],
    });
    logEvent("RUNTIME", "startup_entrypoint", "waiting_for_human_command", "ready", `waiting for human command at ${baseUrl}`);
  };

  return {
    logMissionReadinessStarted,
    logMissionReadinessPassed,
    logMissionReadinessDegraded,
    markMissionRuntimeAvailable,
    logStartupReady,
  };
}

export function createStartupLogHelpers({ terminalLogger, runId, baseUrl }) {
  const structuredLoggers = createStructuredLoggers({ terminalLogger, runId });
  const localAiLogHelpers = createLocalAiLogHelpers(structuredLoggers);
  const missionAndRuntimeLogHelpers = createMissionAndRuntimeLogHelpers({
    ...structuredLoggers,
    getLocalAiRefs: localAiLogHelpers.getLocalAiRefs,
    baseUrl,
  });

  return {
    ...structuredLoggers,
    ...localAiLogHelpers,
    ...missionAndRuntimeLogHelpers,
  };
}
