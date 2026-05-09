import { createFinding, createPhase } from "../../core/result.js";

import { getSourceFileOrThrow } from "./inspection-ast-helpers.js";
import { orchestrationInspectionConstants as config } from "./inspection-constants.js";

const GOVERNED_SCHEMA_NAMES = [
  "MissionConfiguredMaxRoundsSchema",
  "MissionConfiguredMaxMinutesSchema",
] as const;

const createRunLimitFinding = (message: string) => createFinding({
  lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V3",
  file: config.SCHEMA_PATH,
  line: 1,
  severity: "fatal",
  message,
});

const inspectGovernedRunLimitSchema = (
  source: ReturnType<typeof getSourceFileOrThrow>,
  schemaName: (typeof GOVERNED_SCHEMA_NAMES)[number],
) => {
  const declaration = source.getVariableDeclaration(schemaName);
  if (!declaration) {
    return [createRunLimitFinding(`Orchestration schema is missing governed run-limit declaration ${schemaName}.`)];
  }

  const initializerText = declaration.getInitializer()?.getText() ?? "";
  if (initializerText.includes(".max(")) {
    return [createRunLimitFinding(`${schemaName} must remain positive-only and must not reintroduce a hard cap.`)];
  }

  return initializerText.includes(".positive()")
    ? []
    : [createRunLimitFinding(`${schemaName} must validate positive integers without a fixed upper bound.`)];
};

const createRunLimitPhase = (findings: ReturnType<typeof inspectGovernedRunLimitSchema>) => {
  const passed = findings.length === 0;
  return createPhase(
    "run-limit-governance",
    passed ? "PASS" : "CODE VIOLATION",
    passed,
    passed
      ? "Orchestration consumes positive run limits without restoring a fixed upper cap."
      : "Orchestration schema still enforces or risks restoring a fixed run-limit cap.",
  );
};

export function runOrchestrationRunLimitGovernanceChecks(project: import("ts-morph").Project) {
  const source = getSourceFileOrThrow(project, config.SCHEMA_PATH);
  const findings = GOVERNED_SCHEMA_NAMES.flatMap((schemaName) => inspectGovernedRunLimitSchema(source, schemaName));
  return {
    findings,
    phase: createRunLimitPhase(findings),
  };
}