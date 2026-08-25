export const RuntimeLogSpineLaw = {
  NO_CONSOLE: "LAW-RUNTIME-LOG-SPINE-001-V3",
  MODE_VISIBILITY: "LAW-RUNTIME-LOG-SPINE-003-V3",
  TRACE_CONTRACT: "LAW-RUNTIME-LOG-SPINE-003-V3",
  NO_SILENT_BRANCH: "LAW-RUNTIME-LOG-SPINE-001-V3",
  STAGE_PAIR: "LAW-RUNTIME-LOG-SPINE-001-V3",
  ARTIFACT_REFS: "LAW-RUNTIME-LOG-SPINE-003-V3",
  REDACTION: "LAW-RUNTIME-LOG-SPINE-002-V3",
  FAILURE_CLASS: "LAW-RUNTIME-LOG-SPINE-003-V3",
  DEBUG_BUNDLE: "LAW-RUNTIME-LOG-SPINE-003-V3",
  AI_CONTRACT: "LAW-RUNTIME-LOG-SPINE-001-V3",
  BROWSER_ACTION_CONTRACT: "LAW-RUNTIME-LOG-SPINE-001-V3",
  RECOVERY_TRAIL: "LAW-RUNTIME-LOG-SPINE-003-V3",
  MATRIX: "LAW-RUNTIME-LOG-SPINE-003-V3",
  EVENT_REGISTRY: "LAW-RUNTIME-LOG-SPINE-003-V3",
  COVERAGE_REPORT: "LAW-RUNTIME-LOG-SPINE-003-V3",
} as const;

type RuntimeLogSpineLawId = (typeof RuntimeLogSpineLaw)[keyof typeof RuntimeLogSpineLaw];

export type RuntimeLogSpineFinding = {
  lawId: RuntimeLogSpineLawId;
  file: string;
  line: number;
  severity: "fatal";
  message: string;
  hint: string;
  checkId: string;
};

export const RUNTIME_LOG_REQUIRED_FILES = [
  "src/lib/runtime-logs/event-types.ts",
  "src/lib/runtime-logs/failure-classes.ts",
  "src/lib/runtime-logs/redaction.ts",
  "src/lib/runtime-logs/sinks.ts",
  "src/lib/runtime-logs/trace-context.ts",
  "src/lib/runtime-logs/event-factory.ts",
  "src/lib/runtime-logs/stage-logger.ts",
  "src/lib/runtime-logs/debug-bundle.ts",
  "src/lib/runtime-logs/debug-bundle-index.ts",
] as const;
