import type { InspectorContext, InspectorEvaluation } from "../../shared/inspector-contracts.js";
import { producerModePassed, staticClauses, staticEvidenceRefs, staticForbiddenClauses, validateStaticInspection } from "../../shared/static-inspection-contract.js";
import { LAWS } from "./contract-inspection.js";

const producers = {
  "static.ast": "inspectAgentProductionRuntime", "static.contract": "inspectAgentContracts",
  "static.dependency": "inspectAgentDependencies", "static.filesystem": "inspectAgentFilesystem",
  "static.sql": "inspectAgentSql", "static.types": "inspectAgentTypes",
} as const;
const clauses: Record<string, Partial<Record<keyof typeof producers, string[]>>> = {
  [LAWS.core]: { "static.ast": staticClauses(0, 2, 3, 4, 5, 7, 8, 9),
    "static.contract": staticForbiddenClauses(0, 1, 4, 5), "static.types": staticForbiddenClauses(0),
    "static.dependency": staticForbiddenClauses(6) },
  [LAWS.credential]: { "static.ast": staticClauses(0, 2), "static.contract": staticForbiddenClauses(1),
    "static.types": staticForbiddenClauses(0), "static.filesystem": staticForbiddenClauses(0) },
  [LAWS.route]: { "static.ast": staticClauses(2), "static.contract": staticForbiddenClauses(0, 1, 3),
    "static.types": staticForbiddenClauses(2), "static.dependency": staticForbiddenClauses(0) },
  [LAWS.admission]: { "static.ast": staticClauses(1), "static.contract": staticForbiddenClauses(0),
    "static.types": staticForbiddenClauses(0) },
  [LAWS.database]: { "static.ast": staticForbiddenClauses(2, 3), "static.sql": staticClauses(0, 1),
    "static.types": staticForbiddenClauses(1) },
  [LAWS.storage]: { "static.ast": staticClauses(1, 2), "static.contract": staticForbiddenClauses(0),
    "static.types": staticForbiddenClauses(0), "static.filesystem": staticForbiddenClauses(0) },
  [LAWS.staticQuality]: { "static.ast": staticForbiddenClauses(1), "static.contract": staticForbiddenClauses(1),
    "static.types": staticForbiddenClauses(1), "static.filesystem": staticForbiddenClauses(0),
    "static.dependency": staticClauses(0) },
  [LAWS.dynamicProof]: { "static.ast": staticForbiddenClauses(0), "static.contract": staticClauses(0, 1, 2),
    "static.filesystem": staticForbiddenClauses(0), "static.dependency": staticForbiddenClauses(0, 1) },
};

export const buildAgentProductionSessionOutput = (context: InspectorContext, evaluation: InspectorEvaluation) => {
  const lawResults = context.lawRequirements.map((law) => {
    const route = clauses[law.lawId];
    const union = [...new Set(law.requiredStaticModes.flatMap((mode) => route?.[mode as keyof typeof producers] ?? []))].sort();
    const expected = staticClauses(...Array.from({ length: law.forbiddenCount }, (_, index) => index));
    if (!route || JSON.stringify(union) !== JSON.stringify(expected)
      || JSON.stringify(Object.keys(route).sort()) !== JSON.stringify([...law.requiredStaticModes].sort())) {
      throw new Error(`AGENT_RUNTIME_STATIC_CLAUSE_DENOMINATOR_MISMATCH:${law.lawId}`);
    }
    return { lawId: law.lawId, assertions: law.requiredStaticModes.map((mode) => {
      if (!(mode in producers)) throw new Error(`AGENT_RUNTIME_STATIC_MODE_UNMAPPED:${mode}`);
      const evidenceMode = mode as keyof typeof producers;
      const checks = [producers[evidenceMode]], boundClauses = route[evidenceMode]!;
      return { clauses: [...boundClauses], evidenceMode, passed: producerModePassed(evaluation.staticCheckReceipts, law.lawId, checks),
        refs: staticEvidenceRefs(context, law.lawId, evidenceMode, boundClauses, evaluation.staticCheckReceipts, checks) };
    }), findings: evaluation.findings.filter((finding) => finding.lawId === law.lawId) };
  });
  return validateStaticInspection(context, { capabilityDomain: evaluation.capabilityDomain,
    reportedLawIds: evaluation.reportedLawIds, lawResults, inspectedFiles: evaluation.inspectedFiles });
};
