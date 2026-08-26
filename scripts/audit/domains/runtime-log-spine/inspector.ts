import { type InspectorContext, type InspectorEvaluation, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { selectLawId } from "../../shared/finding-utils.js";
import { toInspectorFinding } from "./finding-adapter.js";
import { collectRuntimeLogPhaseRuns, type CollectedPhaseRuns } from "./phase-runs.js";
import { producerModePassed, recordStaticCheck, staticClauses, staticEvidenceRefs, validateStaticInspection } from "../../shared/static-inspection-contract.js";

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
  const operationalLawId = selectLawId(context.planEntry.lawIds, "LAW-RUNTIME-LOG-SPINE-001-V3");
  const redactionLawId = selectLawId(context.planEntry.lawIds, "LAW-RUNTIME-LOG-SPINE-002-V3");
  const contractLawId = selectLawId(context.planEntry.lawIds, "LAW-RUNTIME-LOG-SPINE-003-V3");
  const findings: ReturnType<typeof toInspectorFinding>[] = [];
  const staticCheckReceipts: InspectorEvaluation["staticCheckReceipts"] = [];
  const run = (check: string, lawId: string, action: () => ReturnType<typeof toInspectorFinding>[]): void => recordStaticCheck({
    check, findings, lawIds: [lawId], receipts: staticCheckReceipts, run: () => { findings.push(...action()); },
  });
  run("collectRuntimeOperationalTraceFindings", operationalLawId, () => collectRuntimeOperationalTraceFindings(context, operationalLawId));
  run("collectRuntimeRedactionFindings", redactionLawId, () => collectRuntimeRedactionFindings(context, redactionLawId));
  run("collectRuntimeContractFindings", contractLawId, () => collectRuntimeContractFindings(context, contractLawId));
  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...context.targetPaths],
    staticCheckReceipts,
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  const evaluation = await inspectDomainEvaluation(context);
  const semanticChecks = (lawId: string): string[] => lawId.endsWith("001-V3")
    ? ["collectRuntimeOperationalTraceFindings"]
    : lawId.endsWith("002-V3") ? ["collectRuntimeRedactionFindings"] : ["collectRuntimeContractFindings"];
  const lawResult = (lawId: string) => {
    const findings = evaluation.findings.filter((finding) => finding.lawId === lawId);
    const checks = semanticChecks(lawId);
      return { lawId, assertions: ["static.ast", "static.contract"].map((evidenceMode) => ({
      clauses: staticClauses(0), evidenceMode, passed: producerModePassed(evaluation.staticCheckReceipts, lawId, checks), refs: staticEvidenceRefs(context, lawId, evidenceMode, staticClauses(0), evaluation.staticCheckReceipts, checks),
    })), findings };
  };
  return validateStaticInspection(context, {
    capabilityDomain: evaluation.capabilityDomain, reportedLawIds: evaluation.reportedLawIds,
    lawResults: [lawResult("LAW-RUNTIME-LOG-SPINE-001-V3"), lawResult("LAW-RUNTIME-LOG-SPINE-002-V3"),
      lawResult("LAW-RUNTIME-LOG-SPINE-003-V3")], inspectedFiles: evaluation.inspectedFiles,
  });
};
