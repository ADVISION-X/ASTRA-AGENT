import { type InspectorContext, type InspectorEvaluation, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { toInspectorFinding } from "./finding-adapter.js";
import { collectRuntimeLogPhaseRuns } from "./phase-runs.js";
import { finalizeStaticInspection } from "../../shared/static-inspector-result.js";
const inspectDomainEvaluation = async (context: InspectorContext): Promise<InspectorEvaluation> => {
  const collected = collectRuntimeLogPhaseRuns({ ...context, project: context.project });
  const findings = collected.phaseRuns.flatMap((phase) => phase.findings).map(toInspectorFinding);
  const inspectedFiles = [...new Set(collected.phaseRuns.flatMap((phase) => phase.inspectedFiles))]
    .filter((path) => context.targetPaths.includes(path)).sort();

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,

    findings,
    inspectedFiles,
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  return finalizeStaticInspection(context, [
    { lawId: "LAW-RUNTIME-LOG-SPINE-001-V3", forbiddenCount: 6 },
    { lawId: "LAW-RUNTIME-LOG-SPINE-002-V2", forbiddenCount: 1 },
    { lawId: "LAW-RUNTIME-LOG-SPINE-003-V2", forbiddenCount: 1 },
  ], inspectDomainEvaluation);
};
