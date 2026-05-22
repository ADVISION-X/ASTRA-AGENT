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

function createRuntimeLogHelpers({ logEvent, logPass, baseUrl }) {
  const logStartupReady = () => {
    logPass("RUNTIME", "startup_entrypoint", "terminal_structured_log_relay", "ready", "terminal structured log relay active", {
      refs: ["/api/health", "/api/mode"],
    });
    logEvent("RUNTIME", "startup_entrypoint", "waiting_for_human_command", "ready", `waiting for human command at ${baseUrl}`);
  };

  return {
    logStartupReady,
  };
}

export function createStartupLogHelpers({ terminalLogger, runId, baseUrl }) {
  const structuredLoggers = createStructuredLoggers({ terminalLogger, runId });
  const runtimeLogHelpers = createRuntimeLogHelpers({
    ...structuredLoggers,
    baseUrl,
  });

  return {
    ...structuredLoggers,
    ...runtimeLogHelpers,
  };
}
