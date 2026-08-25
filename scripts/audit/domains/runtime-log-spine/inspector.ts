import { type InspectorContext, type InspectorEvaluation, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { toInspectorFinding } from "./finding-adapter.js";
import { collectRuntimeLogPhaseRuns } from "./phase-runs.js";
import { finalizeStaticInspection } from "../../shared/static-inspector-result.js";
const inspectDomainEvaluation = async (context: InspectorContext): Promise<InspectorEvaluation> => {
  const collected = collectRuntimeLogPhaseRuns({ ...context, project: context.project });
  const findings = collected.phaseRuns.flatMap((phase) => phase.findings).map(toInspectorFinding);
  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,

    findings,
    inspectedFiles: [...context.targetPaths],
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  return finalizeStaticInspection(context, [
    { lawId: "LAW-RUNTIME-LOG-SPINE-001-V3", semanticDigest: "16b0426f69c658ac5f50f47abcf8ff5b53cf14e30af64c13c428092b858d8823" },
    { lawId: "LAW-RUNTIME-LOG-SPINE-002-V2", semanticDigest: "06b7b01e5a0a3b411acf04c412e6fe5f382233031baae2271afcc194cf0152ba" },
    { lawId: "LAW-RUNTIME-LOG-SPINE-003-V2", semanticDigest: "0f272e1a42e45a71352503cbefcb584e944d57c527c92436f1167e7bb5d625e9" },
  ], inspectDomainEvaluation);
};
