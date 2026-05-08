import { createFinding, createPhase } from "../../core/result.js";

import { getSourceFileOrThrow } from "./inspection-ast-helpers.js";
import { orchestrationInspectionConstants as config } from "./inspection-constants.js";

const GOVERNED_SCHEMA_NAMES = [
  "MissionConfiguredMaxRoundsSchema",
  "MissionConfiguredMaxMinutesSchema",
] as const;

export function runOrchestrationRunLimitGovernanceChecks(project: import("ts-morph").Project) {
  const source = getSourceFileOrThrow(project, config.SCHEMA_PATH);
  const findings = GOVERNED_SCHEMA_NAMES.flatMap((schemaName) => {
    const declaration = source.getVariableDeclaration(schemaName);
    if (!declaration) {
      return [createFinding({
        lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V3",
        file: config.SCHEMA_PATH,
        line: 1,
        severity: "fatal",
        message: `Orchestration schema is missing governed run-limit declaration ${schemaName}.`,
      })];
    }

    const initializerText = declaration.getInitializer()?.getText() ?? "";
    if (initializerText.includes(".max(")) {
      return [createFinding({
        lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V3",
        file: config.SCHEMA_PATH,
        line: 1,
        severity: "fatal",
        message: `${schemaName} must remain positive-only and must not reintroduce a hard cap.`,
      })];
    }
    return initializerText.includes(".positive()")
      ? []
      : [createFinding({
          lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V3",
          file: config.SCHEMA_PATH,
          line: 1,
          severity: "fatal",
          message: `${schemaName} must validate positive integers without a fixed upper bound.`,
        })];
  });

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "run-limit-governance",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "Orchestration consumes positive run limits without restoring a fixed upper cap."
        : "Orchestration schema still enforces or risks restoring a fixed run-limit cap.",
    ),
  };
}