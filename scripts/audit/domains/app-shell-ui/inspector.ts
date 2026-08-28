import { selectLawId } from "../../shared/finding-utils.js";
import { type InspectorContext, type InspectorEvaluation, type InspectorFinding, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { inspectForbiddenAppShellActions } from "./inspector-forbidden-actions.js";
import { inspectAppShellLayout } from "./inspector-layout.js";
import { inspectAppShellLocalization } from "./inspector-localization.js";
import { inspectLegacyAppUserDemandPhysicalAbsence } from "./inspector-retired-authority-absence.js";
import { inspectSkillRegistry } from "./inspector-skill-registry.js";
import { producerModePassed, recordStaticCheck, staticClauses, staticEvidenceRefs, validateStaticInspection } from "../../shared/static-inspection-contract.js";

const inspectDomainEvaluation = async (context: InspectorContext): Promise<InspectorEvaluation> => {
  const lawId = selectLawId(context.planEntry.lawIds, "LAW-APP-SHELL-UI-001-V2");
  const localizationLawId = selectLawId(context.planEntry.lawIds, "LAW-APP-SHELL-UI-002-V1");
  const legacyLawId = selectLawId(context.planEntry.lawIds, "LAW-APP-SHELL-UI-003-V3");
  const findings: InspectorFinding[] = [];
  const inspectedFiles = new Set<string>();
  const staticCheckReceipts: InspectorEvaluation["staticCheckReceipts"] = [];
  const run = (check: string, ownerLawId: string, implementation: (...args: never[]) => unknown,
    action: () => void): void => recordStaticCheck({
    check, findings, implementation, lawIds: [ownerLawId], receipts: staticCheckReceipts, run: action,
  });
  run("inspectAppShellLocalization", localizationLawId, inspectAppShellLocalization, () => inspectAppShellLocalization(context, findings, inspectedFiles, localizationLawId));
  run("inspectSkillRegistry", lawId, inspectSkillRegistry, () => inspectSkillRegistry(context, findings, inspectedFiles, lawId));
  run("inspectAppShellLayout", lawId, inspectAppShellLayout, () => inspectAppShellLayout(context, findings, inspectedFiles, lawId));
  run("inspectForbiddenAppShellActions", lawId, inspectForbiddenAppShellActions, () => inspectForbiddenAppShellActions(context, findings, inspectedFiles, lawId));
  run("inspectLegacyAppUserDemandPhysicalAbsence", legacyLawId, inspectLegacyAppUserDemandPhysicalAbsence, () => inspectLegacyAppUserDemandPhysicalAbsence(
        context,
        findings,
        inspectedFiles,
        legacyLawId,
      ));
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
  const semanticChecks = (lawId: string): string[] => lawId === "LAW-APP-SHELL-UI-001-V2"
    ? ["inspectAppShellLayout", "inspectForbiddenAppShellActions", "inspectSkillRegistry"]
    : lawId === "LAW-APP-SHELL-UI-002-V1"
      ? ["inspectAppShellLocalization"]
      : ["inspectLegacyAppUserDemandPhysicalAbsence"];
  const lawResult = (lawId: string) => {
    const findings = evaluation.findings.filter((finding) => finding.lawId === lawId);
    const clauses = lawId === "LAW-APP-SHELL-UI-001-V2"
      ? staticClauses(0, 1, 2, 3, 4, 5, 6, 7, 8, 9)
      : staticClauses(0);
      const checks = semanticChecks(lawId);
      return { lawId, assertions: [{ clauses, evidenceMode: "static.ast", passed: producerModePassed(evaluation.staticCheckReceipts, lawId, checks),
      refs: staticEvidenceRefs(context, lawId, "static.ast", clauses, evaluation.staticCheckReceipts, checks) }], findings };
  };
  return validateStaticInspection(context, {
    capabilityDomain: evaluation.capabilityDomain, reportedLawIds: evaluation.reportedLawIds,
    lawResults: [lawResult("LAW-APP-SHELL-UI-001-V2"), lawResult("LAW-APP-SHELL-UI-002-V1"),
      lawResult("LAW-APP-SHELL-UI-003-V3")], inspectedFiles: evaluation.inspectedFiles,
  });
};
