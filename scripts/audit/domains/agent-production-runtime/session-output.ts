import type {
  InspectorContext,
  InspectorEvaluation,
  SessionInspectorOutput,
} from "../../shared/inspector-contracts.js";
import {
  producerModePassed,
  staticClauses,
  staticEvidenceRefs,
  staticForbiddenClauses,
  validateStaticInspection,
} from "../../shared/static-inspection-contract.js";

const LAW_ID = "LAW-AGENT-PRODUCTION-RUNTIME-001-V31";
const MODE_CLAUSES = {
  "static.filesystem": staticForbiddenClauses(0, 7, 8, 21, 30, 32),
  "static.ast": staticClauses(5, 7, 8, 11, 12, 13, 15, 16, 21, 22, 26, 27, 29, 30, 31, 32),
  "static.types": staticForbiddenClauses(5, 10, 13, 14),
  "static.contract": staticForbiddenClauses(5, 6, 9, 10, 14, 15, 17, 23, 28),
  "static.dependency": staticForbiddenClauses(0, 6, 7, 8, 10, 11, 21, 32),
} as const;
const MODE_CHECKS = {
  "static.filesystem": ["inspectAgentFilesystem"],
  "static.ast": ["inspectAgentProductionRuntime"],
  "static.types": ["inspectAgentTypes"],
  "static.contract": ["inspectAgentContracts"],
  "static.dependency": ["inspectAgentDependencies"],
} as const;
type EvidenceMode = keyof typeof MODE_CLAUSES;

export const buildAgentProductionSessionOutput = (
  context: InspectorContext,
  evaluation: InspectorEvaluation,
): SessionInspectorOutput => {
  const modes = Object.keys(MODE_CLAUSES) as EvidenceMode[];
  const assertions = modes.map((evidenceMode) => {
    const checks = MODE_CHECKS[evidenceMode];
    return {
      clauses: [...MODE_CLAUSES[evidenceMode]], evidenceMode,
      passed: producerModePassed(evaluation.staticCheckReceipts, LAW_ID, checks),
      refs: staticEvidenceRefs(context, LAW_ID, evidenceMode, MODE_CLAUSES[evidenceMode],
        evaluation.staticCheckReceipts, checks),
    };
  });
  return validateStaticInspection(context, {
    capabilityDomain: evaluation.capabilityDomain,
    reportedLawIds: evaluation.reportedLawIds,
    lawResults: [{ lawId: LAW_ID, assertions, findings: evaluation.findings }],
    inspectedFiles: evaluation.inspectedFiles,
  });
};
