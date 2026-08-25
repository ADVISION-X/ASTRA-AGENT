import { selectLawId } from "../../shared/finding-utils.js";
import { type InspectorContext, type InspectorEvaluation, type InspectorFinding, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { inspectForbiddenAppShellActions } from "./inspector-forbidden-actions.js";
import { inspectAppShellLayout } from "./inspector-layout.js";
import { inspectAppShellLocalization } from "./inspector-localization.js";
import { inspectLegacyAppUserDemandPhysicalAbsence } from "./inspector-retired-authority-absence.js";
import { inspectSkillRegistry } from "./inspector-skill-registry.js";
import { finalizeStaticInspection } from "../../shared/static-inspector-result.js";

const inspectDomainEvaluation = async (context: InspectorContext): Promise<InspectorEvaluation> => {
  const lawId = selectLawId(context.planEntry.lawIds, "LAW-APP-SHELL-UI-001-V2");
  const findings: InspectorFinding[] = [];
  const inspectedFiles = new Set<string>();
  inspectAppShellLocalization(context, findings, inspectedFiles, selectLawId(context.planEntry.lawIds, "LAW-APP-SHELL-UI-002-V1"));
  inspectSkillRegistry(context, findings, inspectedFiles, lawId);
  inspectAppShellLayout(context, findings, inspectedFiles, lawId);
  inspectForbiddenAppShellActions(context, findings, inspectedFiles, lawId);
  inspectLegacyAppUserDemandPhysicalAbsence(context, findings, inspectedFiles);
  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,

    findings,
    inspectedFiles: [...context.targetPaths],
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  return finalizeStaticInspection(context, [
    { lawId: "LAW-APP-SHELL-UI-001-V2", semanticDigest: "b28242d3a0acb39c10c53bade469c427f2274d0dccffcccdcf12466be8381254" },
    { lawId: "LAW-APP-SHELL-UI-002-V1", semanticDigest: "1e06eb7b2c61f162d1cfa2d29fc947125c5bfe5b3f310c842bf05ff76809e509" },
    { lawId: "LAW-APP-SHELL-UI-003-V2", semanticDigest: "560aaffa59c376cbff61438e92c97a62a0a81e4195436e00855523f1168316f9" },
  ], inspectDomainEvaluation);
};
