import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveArchitectureLawIds } from "./components/architecture-boundary-shared.js";
import { inspectProjectSources } from "./components/scan-project-sources.js";
import { inspectRootAllowlist } from "./components/scan-root-allowlist.js";

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const lawIds = resolveArchitectureLawIds(context.planEntry);
  const findings: ReturnType<typeof createFinding>[] = [];
  const inspectedFiles = new Set<string>();

  inspectRootAllowlist(findings, lawIds.rootLawId);
  inspectProjectSources(context.project, findings, inspectedFiles, lawIds);

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...inspectedFiles].sort(),
  };
};