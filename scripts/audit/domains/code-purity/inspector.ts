import type { InspectorContext, InspectorOutput } from "../../shared/inspector-contracts.js";
import { runCodePurityPhases } from "./components/code-purity-phase-runner.js";

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const project = context.project;
  const phaseRun = await runCodePurityPhases({ ...context, project });

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings: phaseRun.findings,
    inspectedFiles: [...phaseRun.inspectedFiles].sort(),
  };
};