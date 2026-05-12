// Runtime Logging Inspector — config
// Controls thresholds for the 13 runtime logging governance checks.

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
    "src/lib/online-ai",
  ] as string[],

  // These patterns must NOT appear in production source (except whitelist)
  // Split literals so this config file does not self-trigger the CODE-PURITY scanner.
  forbiddenConsolePatterns: [
    "console" + ".log",
    "console" + ".error",
    "console" + ".warn",
    "console" + ".debug",
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
    "invokeGemini",
  ] as string[],

  // ── RLOG-AST-009: RuntimeLogger must expose these helper methods ──────────
  loggerHelperMethods: ["isDebugEnabled", "isTraceEnabled"] as string[],

  // ── RLOG-AST-010: All boundary event types must have emit() call sites ────
  // Exclude event-types.ts (the registry file) from the scan.
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

  // ── RLOG-AST-011: Heavy tokens must not appear as direct emit() arg props ─
  // These tokens in a direct emit() arg object indicate a payload leak;
  // they must only be constructed inside an isTraceEnabled() guard.
  heavyPayloadTokens: [
    "rawText",
    "fullPrompt",
    "rawResponseText",
    "imageBytes",
    "base64Content",
  ] as string[],
} as const;
