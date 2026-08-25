import { type InspectorContext, type InspectorEvaluation, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { runCodePurityPhases } from "./components/code-purity-phase-runner.js";
import { staticClauses, staticEvidenceRefs, validateStaticInspection } from "../../shared/static-inspection-contract.js";



const inspectDomainEvaluation = async (context: InspectorContext): Promise<InspectorEvaluation> => {
  const project = context.project;
  const phaseRun = await runCodePurityPhases({ ...context, project });
  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings: phaseRun.findings,
    inspectedFiles: [...context.targetPaths],
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  const evaluation = await inspectDomainEvaluation(context);
  const lawId = "LAW-CODE-PURITY-001-V3";
  const findings = evaluation.findings.filter((finding) => finding.lawId === lawId);
  const passed = findings.length === 0;
  return validateStaticInspection(context, {
    capabilityDomain: evaluation.capabilityDomain, reportedLawIds: evaluation.reportedLawIds,
    lawResults: [{ lawId, assertions: [
      { clauses: staticClauses(0, 1, 4, 5, 6, 8, 9, 11), evidenceMode: "static.ast", passed, refs: staticEvidenceRefs(context, lawId, "static.ast") },
      { clauses: staticClauses(), evidenceMode: "static.config", passed, refs: staticEvidenceRefs(context, lawId, "static.config") },
      { clauses: staticClauses(), evidenceMode: "static.dependency", passed, refs: staticEvidenceRefs(context, lawId, "static.dependency") },
      { clauses: staticClauses(), evidenceMode: "static.filesystem", passed, refs: staticEvidenceRefs(context, lawId, "static.filesystem") },
      { clauses: staticClauses(), evidenceMode: "static.json", passed, refs: staticEvidenceRefs(context, lawId, "static.json") },
      { clauses: staticClauses(), evidenceMode: "static.types", passed, refs: staticEvidenceRefs(context, lawId, "static.types") },
    ], findings }], inspectedFiles: evaluation.inspectedFiles,
  });
};
