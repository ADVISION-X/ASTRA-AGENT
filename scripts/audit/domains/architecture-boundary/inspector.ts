import { createFinding } from "../../shared/finding-utils.js";
import { type InspectorContext, type InspectorOutput, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveArchitectureLawIds } from "./components/architecture-boundary-shared.js";
import { inspectActivePluginGate } from "./components/scan-active-plugin-gate.js";
import { inspectActivePluginMediators } from "./components/scan-active-plugin-mediators.js";
import { inspectProjectSources } from "./components/scan-project-sources.js";
import { inspectRootAllowlist } from "./components/scan-root-allowlist.js";
import { inspectTypesContractRoot } from "./components/scan-types-contract-root.js";



const inspectDomainEvaluation = async (context: InspectorContext): Promise<Omit<InspectorOutput, "executedChecks">> => {
  const lawIds = resolveArchitectureLawIds(context.planEntry);
  const findings: ReturnType<typeof createFinding>[] = [];
  const inspectedFiles = new Set<string>();

  inspectRootAllowlist(findings, lawIds.rootLawId);
  inspectProjectSources(context.project, findings, inspectedFiles, lawIds);
  const activePluginGate = inspectActivePluginGate({
    lawId: lawIds.pluginStageLawId,
    project: context.project,
    inspectedFiles,
    targetPaths: context.targetPaths,
  });
  findings.push(...activePluginGate.findings);
  inspectActivePluginMediators({
    entries: activePluginGate.activeContracts,
    findings,
    inspectedFiles,
    lawId: lawIds.intakeLawId,
    project: context.project,
  });
  inspectTypesContractRoot({
    findings,
    inspectedFiles,
    lawId: lawIds.lawFirstChangeLawId,
    project: context.project,
  });

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,

    findings,
    inspectedFiles: [...inspectedFiles].sort(),
    reportJson: {
      generatedAt: new Date().toISOString(),
      capabilityDomain: context.planEntry.capabilityDomain,
      lawIds: context.planEntry.lawIds,
      actualPluginIds: activePluginGate.actualPluginIds,
      activePluginContracts: activePluginGate.activeContracts,
      pluginExposureFilesByPluginId: activePluginGate.exposureFilesByPluginId,
      governedAcceptanceScripts: activePluginGate.governedAcceptanceScripts,
      activePluginViolations: activePluginGate.findings,
      status: findings.length === 0 ? "PASS" : "FAIL",
      findings,
      inspectedFiles: [...inspectedFiles].sort(),
    },
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  if (!context.checks) throw new Error("architecture-boundary requires a runner-owned check session.");
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
