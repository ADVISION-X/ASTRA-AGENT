import { createFinding } from "../../shared/finding-utils.js";
import { type InspectorContext, type InspectorEvaluation, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveArchitectureLawIds } from "./components/architecture-boundary-shared.js";
import { inspectActivePluginGate } from "./components/scan-active-plugin-gate.js";
import { inspectActivePluginMediators } from "./components/scan-active-plugin-mediators.js";
import { inspectProjectSources } from "./components/scan-project-sources.js";
import { inspectRootAllowlist } from "./components/scan-root-allowlist.js";
import { inspectTypesContractRoot } from "./components/scan-types-contract-root.js";
import { authenticatedStaticChecks, finalizeStaticInspection } from "../../shared/static-inspector-result.js";



const inspectDomainEvaluation = async (context: InspectorContext): Promise<InspectorEvaluation> => {
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
    executedChecks: authenticatedStaticChecks(context.planEntry.capabilityDomain),
    findings,
    inspectedFiles: [...context.targetPaths],
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  return finalizeStaticInspection(context, [{
    lawId: "LAW-ARCHITECTURE-BOUNDARY-001-V1",
  }], inspectDomainEvaluation);
};
