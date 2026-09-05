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

const MODE_CHECKS = {
  "static.ast": ["inspectAgentProductionRuntime"],
  "static.contract": ["inspectAgentContracts"],
  "static.dependency": ["inspectAgentDependencies"],
  "static.filesystem": ["inspectAgentFilesystem"],
  "static.sql": ["inspectAgentSql"],
  "static.types": ["inspectAgentTypes"],
} as const;

type EvidenceMode = keyof typeof MODE_CHECKS;
const LAW_MODE_CLAUSES: Readonly<Record<string, Readonly<Partial<Record<EvidenceMode, readonly string[]>>>>> = {
  "LAW-AGENT-PRODUCTION-RUNTIME-001-V37": {
    "static.ast": staticForbiddenClauses(0, 3),
    "static.types": staticForbiddenClauses(0),
    "static.contract": staticForbiddenClauses(0, 1, 2),
    "static.dependency": staticClauses(3),
  },
  "LAW-AGENT-PRODUCTION-RUNTIME-002-V2": {
    "static.filesystem": staticForbiddenClauses(0),
    "static.ast": staticForbiddenClauses(0, 2),
    "static.types": staticForbiddenClauses(0),
    "static.contract": staticClauses(1),
  },
  "LAW-AGENT-PRODUCTION-RUNTIME-003-V6": {
    "static.ast": staticForbiddenClauses(1, 2),
    "static.types": staticForbiddenClauses(1),
    "static.contract": staticForbiddenClauses(0, 1),
    "static.dependency": staticClauses(0),
  },
  "LAW-AGENT-PRODUCTION-RUNTIME-004-V6": {
    "static.ast": staticForbiddenClauses(0),
    "static.types": staticForbiddenClauses(0),
    "static.contract": staticClauses(0, 1),
  },
  "LAW-AGENT-PRODUCTION-RUNTIME-005-V6": {
    "static.ast": staticForbiddenClauses(1),
    "static.types": staticForbiddenClauses(1),
    "static.sql": staticClauses(0),
  },
  "LAW-AGENT-PRODUCTION-RUNTIME-006-V6": {
    "static.filesystem": staticForbiddenClauses(0),
    "static.ast": staticForbiddenClauses(0, 1, 2),
    "static.types": staticForbiddenClauses(0),
    "static.contract": staticClauses(0),
  },
  "LAW-AGENT-PRODUCTION-RUNTIME-007-V6": {
    "static.filesystem": staticForbiddenClauses(0),
    "static.ast": staticForbiddenClauses(1),
    "static.types": staticForbiddenClauses(1),
    "static.contract": staticForbiddenClauses(1),
    "static.dependency": staticClauses(0),
  },
  "LAW-AGENT-PRODUCTION-RUNTIME-008-V7": {
    "static.filesystem": staticForbiddenClauses(0),
    "static.ast": staticForbiddenClauses(0),
    "static.contract": staticForbiddenClauses(0, 1, 2),
    "static.dependency": staticClauses(0, 1),
  },
};

const evidenceChecks = (lawId: string, mode: string): readonly string[] => {
  if (!(mode in MODE_CHECKS)) {
    throw new Error(`AGENT_PRODUCTION_RUNTIME_STATIC_MODE_UNMAPPED:${lawId}:${mode}`);
  }
  return MODE_CHECKS[mode as EvidenceMode];
};
const clausesFor = (
  requirement: InspectorContext["lawRequirements"][number],
  evidenceMode: string,
): string[] => {
  if (!(evidenceMode in MODE_CHECKS)) {
    throw new Error(`AGENT_PRODUCTION_RUNTIME_STATIC_MODE_UNMAPPED:${requirement.lawId}:${evidenceMode}`);
  }
  const routes = LAW_MODE_CLAUSES[requirement.lawId];
  const clauses = routes?.[evidenceMode as EvidenceMode];
  const routedDenominator = [...new Set(requirement.requiredStaticModes.flatMap((mode) =>
    mode in MODE_CHECKS ? routes?.[mode as EvidenceMode] ?? [] : []))].sort();
  const expectedDenominator = staticClauses(...Array.from(
    { length: requirement.forbiddenCount }, (_, index) => index,
  ));
  if (!clauses || JSON.stringify(routedDenominator) !== JSON.stringify(expectedDenominator)) {
    throw new Error(`AGENT_PRODUCTION_RUNTIME_STATIC_CLAUSE_UNMAPPED:${requirement.lawId}:${evidenceMode}`);
  }
  return [...clauses];
};

export const buildAgentProductionSessionOutput = (
  context: InspectorContext,
  evaluation: InspectorEvaluation,
): SessionInspectorOutput => validateStaticInspection(context, {
  capabilityDomain: evaluation.capabilityDomain,
  reportedLawIds: evaluation.reportedLawIds,
  lawResults: context.lawRequirements.map((requirement) => ({
    lawId: requirement.lawId,
    assertions: requirement.requiredStaticModes.map((evidenceMode) => {
      const checks = evidenceChecks(requirement.lawId, evidenceMode);
      const clauses = clausesFor(requirement, evidenceMode);
      return {
        clauses,
        evidenceMode,
        passed: producerModePassed(evaluation.staticCheckReceipts, requirement.lawId, checks),
        refs: staticEvidenceRefs(context, requirement.lawId, evidenceMode, clauses,
          evaluation.staticCheckReceipts, checks),
      };
    }),
    findings: evaluation.findings.filter((finding) => finding.lawId === requirement.lawId),
  })),
  inspectedFiles: evaluation.inspectedFiles,
});
