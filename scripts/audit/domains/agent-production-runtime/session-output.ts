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
import {
  observeStaticAst,
  observeStaticContract,
  observeStaticDependency,
  observeStaticFilesystem,
  observeStaticTypes,
} from "../../shared/static-target-object-inspector.js";

const LAW_ID = "LAW-AGENT-PRODUCTION-RUNTIME-001-V6";
const MODE_CLAUSES = {
  "static.filesystem": staticForbiddenClauses(1, 16, 17),
  "static.ast": staticClauses(2, 4, 5, 9, 10, 11, 13, 14, 15, 17, 18, 19, 20, 21, 23, 24, 25),
  "static.types": staticForbiddenClauses(3, 5, 8, 11, 12),
  "static.contract": staticForbiddenClauses(3, 5, 6, 7, 8, 12, 13, 15),
  "static.dependency": staticForbiddenClauses(0, 1, 2, 4, 6, 16),
} as const;
const MODE_CHECKS = {
  "static.filesystem": ["inspectAgentFilesystem"],
  "static.ast": ["inspectAgentProductionRuntime"],
  "static.types": ["inspectAgentTypes"],
  "static.contract": ["inspectAgentContracts"],
  "static.dependency": ["inspectAgentDependencies"],
} as const;
type EvidenceMode = keyof typeof MODE_CLAUSES;

const observationFor = (
  context: InspectorContext,
  evidenceMode: EvidenceMode,
  receipts: InspectorEvaluation["staticCheckReceipts"],
): string[] => {
  const checks = MODE_CHECKS[evidenceMode];
  const input = {
    context, lawId: LAW_ID, evidenceMode, clauses: MODE_CLAUSES[evidenceMode], checks,
    executionPassed: producerModePassed(receipts, LAW_ID, checks),
  };
  const observers = {
    "static.filesystem": observeStaticFilesystem,
    "static.ast": observeStaticAst,
    "static.types": observeStaticTypes,
    "static.contract": observeStaticContract,
    "static.dependency": observeStaticDependency,
  } as const;
  return observers[evidenceMode](input);
};

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
        evaluation.staticCheckReceipts, checks, observationFor(context, evidenceMode, evaluation.staticCheckReceipts)),
    };
  });
  return validateStaticInspection(context, {
    capabilityDomain: evaluation.capabilityDomain,
    reportedLawIds: evaluation.reportedLawIds,
    lawResults: [{ lawId: LAW_ID, assertions, findings: evaluation.findings }],
    inspectedFiles: evaluation.inspectedFiles,
  });
};
