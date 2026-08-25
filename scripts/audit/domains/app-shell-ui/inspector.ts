import { selectLawId } from "../../shared/finding-utils.js";
import { type InspectorContext, type InspectorFinding, type InspectorOutput, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { inspectForbiddenAppShellActions } from "./inspector-forbidden-actions.js";
import { inspectAppShellLayout } from "./inspector-layout.js";
import { inspectAppShellLocalization } from "./inspector-localization.js";
import { inspectLegacyAppUserDemandPhysicalAbsence } from "./inspector-retired-authority-absence.js";
import { inspectSkillRegistry } from "./inspector-skill-registry.js";

const inspectDomainEvaluation = async (context: InspectorContext): Promise<Omit<InspectorOutput, "executedChecks">> => {
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
    inspectedFiles: [...inspectedFiles].sort(),
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  if (!context.checks) throw new Error("app-shell-ui requires a runner-owned check session.");
  let reportJson: unknown;
  let reportMarkdown: string | undefined;
  await context.checks.runAll(async () => {
    const evaluation = await inspectDomainEvaluation(context);
    reportJson = evaluation.reportJson;
    reportMarkdown = evaluation.reportMarkdown;
    return {
      findings: evaluation.findings,
      evidenceRefs: [context.planEntry.ownerInspectorPath, ...evaluation.inspectedFiles],
    };
  });
  return context.checks.output({
    ...(reportJson === undefined ? {} : { reportJson }),
    ...(reportMarkdown === undefined ? {} : { reportMarkdown }),
  });
};
