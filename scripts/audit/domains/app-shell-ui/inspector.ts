import { selectLawId } from "../../shared/finding-utils.js";
import { type InspectorContext, type InspectorEvaluation, type InspectorFinding, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { inspectForbiddenAppShellActions } from "./inspector-forbidden-actions.js";
import { inspectAppShellLayout } from "./inspector-layout.js";
import { inspectAppShellLocalization } from "./inspector-localization.js";
import { inspectLegacyAppUserDemandPhysicalAbsence } from "./inspector-retired-authority-absence.js";
import { inspectSkillRegistry } from "./inspector-skill-registry.js";
import { staticClauses, staticEvidenceRefs, validateStaticInspection } from "../../shared/static-inspection-contract.js";

const inspectDomainEvaluation = async (context: InspectorContext): Promise<InspectorEvaluation> => {
  const lawId = selectLawId(context.planEntry.lawIds, "LAW-APP-SHELL-UI-001-V2");
  const localizationLawId = selectLawId(context.planEntry.lawIds, "LAW-APP-SHELL-UI-002-V1");
  const legacyLawId = selectLawId(context.planEntry.lawIds, "LAW-APP-SHELL-UI-003-V3");
  const findings: InspectorFinding[] = [];
  const inspectedFiles = new Set<string>();
  inspectAppShellLocalization(context, findings, inspectedFiles, localizationLawId);
  inspectSkillRegistry(context, findings, inspectedFiles, lawId);
  inspectAppShellLayout(context, findings, inspectedFiles, lawId);
  inspectForbiddenAppShellActions(context, findings, inspectedFiles, lawId);
  inspectLegacyAppUserDemandPhysicalAbsence(
        context,
        findings,
        inspectedFiles,
        legacyLawId,
      );
  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    coverage: [
      staticLawCoverage("LAW-APP-SHELL-UI-001-V2", 10, ["static.ast"], []),
      staticLawCoverage("LAW-APP-SHELL-UI-002-V1", 5, ["static.ast"], []),
      staticLawCoverage("LAW-APP-SHELL-UI-003-V3", 3, ["static.ast"], []),
    ],
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...context.targetPaths],
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  return finalizeStaticInspection(context, inspectDomainEvaluation);
};
