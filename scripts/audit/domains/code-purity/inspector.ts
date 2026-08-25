import { type InspectorContext, type InspectorEvaluation, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { runCodePurityPhases } from "./components/code-purity-phase-runner.js";
import { authenticatedStaticChecks, finalizeStaticInspection, recordSemanticCheck } from "../../shared/static-inspector-result.js";



const inspectDomainEvaluation = async (context: InspectorContext): Promise<InspectorEvaluation> => {
  const project = context.project;
  const executedSemanticChecks: Array<{ lawId: string; name: string }> = [];
  const phaseRun = recordSemanticCheck(executedSemanticChecks, "LAW-CODE-PURITY-001-V2", "runCodePurityPhases",
    await runCodePurityPhases({ ...context, project }));
  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    executedChecks: authenticatedStaticChecks(context.planEntry.capabilityDomain),
    executedSemanticChecks,
    findings: phaseRun.findings,
    inspectedFiles: [...context.targetPaths],
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  return finalizeStaticInspection(context, [{
    lawId: "LAW-CODE-PURITY-001-V2",
  }], inspectDomainEvaluation);
};
