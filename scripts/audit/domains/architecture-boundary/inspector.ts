import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveArchitectureLawIds } from "./components/architecture-boundary-shared.js";
import { inspectActivePluginGate } from "./components/scan-active-plugin-gate.js";
import { inspectProjectSources } from "./components/scan-project-sources.js";
import { inspectRootAllowlist } from "./components/scan-root-allowlist.js";

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const lawIds = resolveArchitectureLawIds(context.planEntry);
  const findings: ReturnType<typeof createFinding>[] = [];
  const inspectedFiles = new Set<string>();

  inspectRootAllowlist(findings, lawIds.rootLawId);
  inspectProjectSources(context.project, findings, inspectedFiles, lawIds);
  const activePluginGate = inspectActivePluginGate({
    lawId: lawIds.pluginStageLawId,
    project: context.project,
    inspectedFiles,
  });
  findings.push(...activePluginGate.findings);

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
      pluginStatusEntries: activePluginGate.statusEntries,
      pluginExposureFilesByPluginId: activePluginGate.exposureFilesByPluginId,
      ciFullAcceptanceScripts: activePluginGate.ciFullAcceptanceScripts,
      activePluginViolations: activePluginGate.findings,
      status: findings.length === 0 ? "PASS" : "FAIL",
      findings,
      inspectedFiles: [...inspectedFiles].sort(),
    },
  };
};