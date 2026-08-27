import { type InspectorContext, type InspectorEvaluation, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { selectLawId } from "../../shared/finding-utils.js";
import { toInspectorFinding } from "./finding-adapter.js";
import { collectRuntimeLogPhaseRuns, type CollectedPhaseRuns } from "./phase-runs.js";
import { producerModePassed, recordStaticCheck, staticClauses, staticEvidenceRefs, validateStaticInspection } from "../../shared/static-inspection-contract.js";
import { observeStaticAst, observeStaticContract } from "../../shared/static-target-object-inspector.js";

const findingsForLaw = (collected: CollectedPhaseRuns, lawId: string, phaseNames: readonly string[],
  evidenceMode: "static.ast" | "static.contract") => collected.phaseRuns
  .filter((phase) => phaseNames.includes(phase.name)).flatMap((phase) => phase.findings)
  .filter((finding) => finding.lawId === lawId)
  .map((finding) => toInspectorFinding(finding, evidenceMode));

const collectRuntimeOperationalAstFindings = (collected: CollectedPhaseRuns, lawId: string) =>
  findingsForLaw(collected, lawId, ["forbidden-console", "stage-pair-coverage", "catch-branch-log", "failure-class"], "static.ast");
const collectRuntimeOperationalContractFindings = (collected: CollectedPhaseRuns, lawId: string) =>
  findingsForLaw(collected, lawId, ["event-type-registry", "runtime-log-emit-contract", "mode-visibility"], "static.contract");

const collectRuntimeRedactionAstFindings = (collected: CollectedPhaseRuns, lawId: string) =>
  findingsForLaw(collected, lawId, ["redaction"], "static.ast");
const collectRuntimeRedactionContractFindings = (collected: CollectedPhaseRuns, lawId: string) =>
  findingsForLaw(collected, lawId, ["ai-log-contract", "browser-action-log-contract"], "static.contract");

const collectRuntimeStructureAstFindings = (collected: CollectedPhaseRuns, lawId: string) =>
  findingsForLaw(collected, lawId, ["debug-bundle", "anti-fake-inspector"], "static.ast");
const collectRuntimeStructureContractFindings = (collected: CollectedPhaseRuns, lawId: string) =>
  findingsForLaw(collected, lawId, ["runtime-log-emit-contract", "mode-visibility", "semantic-metrics-self-audit"], "static.contract");

const inspectDomainEvaluation = async (context: InspectorContext): Promise<InspectorEvaluation> => {
  const operationalLawId = selectLawId(context.planEntry.lawIds, "LAW-RUNTIME-LOG-SPINE-001-V3");
  const redactionLawId = selectLawId(context.planEntry.lawIds, "LAW-RUNTIME-LOG-SPINE-002-V3");
  const contractLawId = selectLawId(context.planEntry.lawIds, "LAW-RUNTIME-LOG-SPINE-003-V3");
  const findings: ReturnType<typeof toInspectorFinding>[] = [];
  const staticCheckReceipts: InspectorEvaluation["staticCheckReceipts"] = [];
  const collected = collectRuntimeLogPhaseRuns(context);
  recordStaticCheck({
    check: "collectRuntimeOperationalAstFindings", findings, lawIds: [operationalLawId], receipts: staticCheckReceipts,
    run: () => { findings.push(...collectRuntimeOperationalAstFindings(collected, operationalLawId)); },
  });
  recordStaticCheck({
    check: "collectRuntimeOperationalContractFindings", findings, lawIds: [operationalLawId], receipts: staticCheckReceipts,
    run: () => { findings.push(...collectRuntimeOperationalContractFindings(collected, operationalLawId)); },
  });
  recordStaticCheck({
    check: "collectRuntimeRedactionAstFindings", findings, lawIds: [redactionLawId], receipts: staticCheckReceipts,
    run: () => { findings.push(...collectRuntimeRedactionAstFindings(collected, redactionLawId)); },
  });
  recordStaticCheck({
    check: "collectRuntimeRedactionContractFindings", findings, lawIds: [redactionLawId], receipts: staticCheckReceipts,
    run: () => { findings.push(...collectRuntimeRedactionContractFindings(collected, redactionLawId)); },
  });
  recordStaticCheck({
    check: "collectRuntimeStructureAstFindings", findings, lawIds: [contractLawId], receipts: staticCheckReceipts,
    run: () => { findings.push(...collectRuntimeStructureAstFindings(collected, contractLawId)); },
  });
  recordStaticCheck({
    check: "collectRuntimeStructureContractFindings", findings, lawIds: [contractLawId], receipts: staticCheckReceipts,
    run: () => { findings.push(...collectRuntimeStructureContractFindings(collected, contractLawId)); },
  });
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
  const semanticChecks = (lawId: string, evidenceMode: string): string[] => lawId.endsWith("001-V3")
    ? evidenceMode === "static.ast" ? ["collectRuntimeOperationalAstFindings"] : ["collectRuntimeOperationalContractFindings"]
    : lawId.endsWith("002-V3")
      ? evidenceMode === "static.ast" ? ["collectRuntimeRedactionAstFindings"] : ["collectRuntimeRedactionContractFindings"]
      : evidenceMode === "static.ast" ? ["collectRuntimeStructureAstFindings"] : ["collectRuntimeStructureContractFindings"];
  const lawResult = (lawId: string) => {
    const findings = evaluation.findings.filter((finding) => finding.lawId === lawId);
      return { lawId, assertions: ["static.ast", "static.contract"].map((evidenceMode) => {
      const checks = semanticChecks(lawId, evidenceMode);
      return ({
      clauses: staticClauses(0), evidenceMode, passed: producerModePassed(evaluation.staticCheckReceipts, lawId, checks), refs: staticEvidenceRefs(context, lawId, evidenceMode, staticClauses(0), evaluation.staticCheckReceipts, checks,
        (evidenceMode === "static.ast" ? observeStaticAst : observeStaticContract)({ context, lawId, evidenceMode, clauses: staticClauses(0), checks,
          executionPassed: producerModePassed(evaluation.staticCheckReceipts, lawId, checks) })),
    }); }), findings };
  };
  return validateStaticInspection(context, {
    capabilityDomain: evaluation.capabilityDomain, reportedLawIds: evaluation.reportedLawIds,
    lawResults: [lawResult("LAW-RUNTIME-LOG-SPINE-001-V3"), lawResult("LAW-RUNTIME-LOG-SPINE-002-V3"),
      lawResult("LAW-RUNTIME-LOG-SPINE-003-V3")], inspectedFiles: evaluation.inspectedFiles,
  });
};
