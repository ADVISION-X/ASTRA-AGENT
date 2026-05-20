import { createPhase } from "../../../core/result.js";
import type {
  Finding,
  InspectionClassification,
} from "../../../core/schema.js";
import type { DomAutomationValidationResult } from "./dom-automation-project-types.js";

export const buildValidationResult = (input: {
  name: string;
  findings: Finding[];
  coveredClauseIds: readonly string[];
  passSummary: string;
  failSummary: string;
  failureClassification?: InspectionClassification;
}): DomAutomationValidationResult => {
  const passed = input.findings.length === 0;
  return {
    findings: input.findings,
    coveredClauseIds: [...new Set(input.coveredClauseIds)],
    phase: createPhase(
      input.name,
      passed ? "PASS" : input.failureClassification ?? "CODE VIOLATION",
      passed,
      passed ? input.passSummary : input.failSummary,
    ),
  };
};
