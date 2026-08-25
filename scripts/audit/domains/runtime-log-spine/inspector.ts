import { type InspectorContext, type InspectorEvaluation, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { toInspectorFinding } from "./finding-adapter.js";
import { collectRuntimeLogPhaseRuns } from "./phase-runs.js";
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
  if (!context.checks) throw new Error("runtime-log-spine requires a runner-owned check session.");
  await context.checks.runAll(async () => {
    const evaluation = await inspectDomainEvaluation(context);
    return {
      findings: evaluation.findings,
      evidenceRefs: [context.planEntry.ownerInspectorPath, ...evaluation.inspectedFiles],
    };
  });
  return context.checks.output();
};
