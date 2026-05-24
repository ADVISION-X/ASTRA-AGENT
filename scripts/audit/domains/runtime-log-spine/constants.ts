export const RuntimeLogSpineLaw = {
  NO_CONSOLE: "GRASSEYE-RUNTIME-LOG-SPINE-001-V1",
  MODE_VISIBILITY: "GRASSEYE-RUNTIME-LOG-SPINE-002-V1",
  TRACE_CONTRACT: "GRASSEYE-RUNTIME-LOG-SPINE-003-V1",
  NO_SILENT_BRANCH: "GRASSEYE-RUNTIME-LOG-SPINE-004-V1",
  STAGE_PAIR: "GRASSEYE-RUNTIME-LOG-SPINE-005-V1",
  ARTIFACT_REFS: "GRASSEYE-RUNTIME-LOG-SPINE-006-V1",
  REDACTION: "GRASSEYE-RUNTIME-LOG-SPINE-007-V1",
  FAILURE_CLASS: "GRASSEYE-RUNTIME-LOG-SPINE-010-V1",
  DEBUG_BUNDLE: "GRASSEYE-RUNTIME-LOG-SPINE-012-V1",
  AI_CONTRACT: "GRASSEYE-RUNTIME-LOG-SPINE-013-V1",
  BROWSER_ACTION_CONTRACT: "GRASSEYE-RUNTIME-LOG-SPINE-014-V1",
  RECOVERY_TRAIL: "GRASSEYE-RUNTIME-LOG-SPINE-015-V1",
  MATRIX: "GRASSEYE-RUNTIME-LOG-SPINE-016-V1",
  EVENT_REGISTRY: "GRASSEYE-RUNTIME-LOG-SPINE-017-V1",
  COVERAGE_REPORT: "GRASSEYE-RUNTIME-LOG-SPINE-018-V1",
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

export type RuntimeLogSpinePhase = {
  name: string;
  status: "PASS" | "FAIL";
  findingCount: number;
  scannedFiles?: number;
  metrics?: Record<string, number>;
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
