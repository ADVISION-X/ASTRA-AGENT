// Runtime Logging Inspector — config
// Controls thresholds for the 10 runtime logging governance checks.

export const RUNTIME_LOGGING_CONFIG = {
  // Source file limits
  maxRuntimeLogFiles: 8,
  maxAuditInspectorFiles: 3,

  // Canonical schema fields required on every RuntimeLogEvent
  requiredSchemaFields: [
    "eventId",
    "traceId",
    "eventType",
    "owner",
    "level",
    "createdAt",
    "modeVisibility",
  ] as string[],

  // Required mode strings
  requiredModes: ["FLOW", "DEBUG", "TRACE"] as string[],

  // Redaction must exist in redaction.ts
  redactionFunctionName: "redactRuntimeLogPayload",

  // AI four-piece event types
  aiRequiredEventTypes: [
    "AI_REQUEST_DEBUG",
    "AI_RAW_RESPONSE_DEBUG",
    "AI_PARSE_RESULT_DEBUG",
    "AI_ERROR_DEBUG",
  ] as string[],

  // Files to check for AI four-piece presence
  aiSourcePaths: [
    "src/capabilities/ai",
    "src/lib/local-ai",
  ] as string[],

  // These patterns must NOT appear in production source (except whitelist)
  forbiddenConsolePatterns: [
    "console.log",
    "console.error",
    "console.warn",
    "console.debug",
  ] as string[],

  // Files that are allowed to use process.stdout/stderr
  consoleWhitelist: [
    "src/lib/runtime-logs/sinks.ts",
  ] as string[],

  // Logger must NOT import from these paths
  loggerForbiddenImports: [
    "forensics-persistence/runtime",
    "orchestration/runtime",
    "mouse-click/runtime",
    "BrowserController",
    "callLocalModel",
  ] as string[],
} as const;
