import { type InspectorContext, type InspectorEvaluation, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { selectLawId } from "../../shared/finding-utils.js";
import { toInspectorFinding } from "./finding-adapter.js";
import { collectRuntimeLogPhaseRuns, type CollectedPhaseRuns } from "./phase-runs.js";
import { authenticatedStaticChecks, finalizeStaticInspection } from "../../shared/static-inspector-result.js";

const findingsForLaw = (collected: CollectedPhaseRuns, lawId: string) => collected.phaseRuns
  .flatMap((phase) => phase.findings)
  .filter((finding) => finding.lawId === lawId)
  .map(toInspectorFinding);

const collectRuntimeOperationalTraceFindings = (context: InspectorContext, lawId: string) =>
  findingsForLaw(collectRuntimeLogPhaseRuns(context), lawId);

const collectRuntimeRedactionFindings = (context: InspectorContext, lawId: string) =>
  findingsForLaw(collectRuntimeLogPhaseRuns(context), lawId);

const collectRuntimeContractFindings = (context: InspectorContext, lawId: string) =>
  findingsForLaw(collectRuntimeLogPhaseRuns(context), lawId);

const inspectDomainEvaluation = async (context: InspectorContext): Promise<InspectorEvaluation> => {
  const findings = [
    ...collectRuntimeOperationalTraceFindings(context, selectLawId(context.planEntry.lawIds, "LAW-RUNTIME-LOG-SPINE-001-V3")),
    ...collectRuntimeRedactionFindings(context, selectLawId(context.planEntry.lawIds, "LAW-RUNTIME-LOG-SPINE-002-V2")),
    ...collectRuntimeContractFindings(context, selectLawId(context.planEntry.lawIds, "LAW-RUNTIME-LOG-SPINE-003-V2")),
  ];
  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    executedChecks: authenticatedStaticChecks(context.planEntry.capabilityDomain),
    findings,
    inspectedFiles: [...context.targetPaths],
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  return finalizeStaticInspection(context, [
    { lawId: "LAW-RUNTIME-LOG-SPINE-001-V3" },
    { lawId: "LAW-RUNTIME-LOG-SPINE-002-V2" },
    { lawId: "LAW-RUNTIME-LOG-SPINE-003-V2" },
  ], inspectDomainEvaluation);
};
