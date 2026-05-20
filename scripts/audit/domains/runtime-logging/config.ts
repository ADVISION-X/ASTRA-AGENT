// Runtime Logging Inspector — config
// Controls thresholds for the 13 runtime logging governance checks.

const RUNTIME_LOG_FILE_LIMITS = {
  maxRuntimeLogFiles: 8,
  maxAuditInspectorFiles: 3,
  requiredSchemaFields: [
    "eventId",
    "traceId",
    "eventType",
    "owner",
    "level",
    "createdAt",
    "modeVisibility",
  ] as string[],
  requiredModes: ["FLOW", "DEBUG", "TRACE"] as string[],
  redactionFunctionName: "redactRuntimeLogPayload",
} as const;

const RUNTIME_LOG_AI_REQUIREMENTS = {
  aiRequiredEventTypes: [
    "AI_REQUEST_DEBUG",
    "AI_RAW_RESPONSE_DEBUG",
    "AI_PARSE_RESULT_DEBUG",
    "AI_ERROR_DEBUG",
  ] as string[],
  aiSourcePaths: ["src/capabilities/ai", "src/lib/online-ai"] as string[],
  loggerHelperMethods: ["isDebugEnabled", "isTraceEnabled"] as string[],
} as const;

const RUNTIME_LOG_BOUNDARY_RULES = {
  forbiddenConsolePatterns: [
    "console" + ".log",
    "console" + ".error",
    "console" + ".warn",
    "console" + ".debug",
  ] as string[],
  consoleWhitelist: ["src/lib/runtime-logs/sinks.ts"] as string[],
  loggerForbiddenImports: [
    "forensics-persistence/runtime",
    "orchestration/runtime",
    "mouse-click/runtime",
    "BrowserController",
    "invokeGemini",
  ] as string[],
  boundaryEventTypes: [
    "HUMAN_COMMAND_RECEIVED",
    "MISSION_STARTED",
    "MISSION_COMPLETED",
    "ROUND_STARTED",
    "ROUND_COMPLETED",
    "SCREENSHOT_CAPTURE_REQUESTED",
    "SCREENSHOT_CAPTURED",
    "COORDINATE_GRID_RENDERED",
    "AI_REQUEST_DEBUG",
    "AI_RAW_RESPONSE_DEBUG",
    "AI_PARSE_RESULT_DEBUG",
    "AI_ERROR_DEBUG",
    "AI_DECISION_SUMMARY",
    "CAPABILITY_DISPATCH_STARTED",
    "CAPABILITY_DISPATCH_COMPLETED",
    "CAPABILITY_DISPATCH_FAILED",
    "GEOMETRY_GUARD_RESULT",
    "BROWSER_ACTION_RESULT",
    "TEXT_INPUT_RESULT",
    "OPEN_RESULT",
    "FORENSICS_RECORD_APPENDED",
    "FORENSICS_ARTIFACT_APPENDED",
  ] as string[],
} as const;

const RUNTIME_LOG_HEAVY_PAYLOAD_RULES = {
  heavyPayloadTokens: [
    "rawText",
    "fullPrompt",
    "rawResponseText",
    "imageBytes",
    "base64Content",
  ] as string[],
} as const;

export const RUNTIME_LOGGING_CONFIG = {
  ...RUNTIME_LOG_FILE_LIMITS,
  ...RUNTIME_LOG_AI_REQUIREMENTS,
  ...RUNTIME_LOG_BOUNDARY_RULES,
  ...RUNTIME_LOG_HEAVY_PAYLOAD_RULES,
} as const;
