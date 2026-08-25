import { type InspectorContext, type InspectorEvaluation, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { runCodePurityPhases } from "./components/code-purity-phase-runner.js";
import { finalizeStaticInspection, staticLawCoverage } from "../../shared/static-inspector-result.js";



const inspectDomainEvaluation = async (context: InspectorContext): Promise<InspectorEvaluation> => {
  const project = context.project;
  const phaseRun = await runCodePurityPhases({ ...context, project });
  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    coverage: [staticLawCoverage("LAW-CODE-PURITY-001-V3", 13, [
      "static.filesystem", "static.ast", "static.types", "static.dependency", "static.config", "static.json",
    ], [0, 1, 4, 5, 6, 8, 9, 11])],
    reportedLawIds: context.planEntry.lawIds,
    findings: phaseRun.findings,
    inspectedFiles: [...context.targetPaths],
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  return finalizeStaticInspection(context, inspectDomainEvaluation);
};
