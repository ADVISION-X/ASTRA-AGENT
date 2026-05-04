import type { Finding, InspectorPhase } from "../../core/schema.js";

import type { KernelCheckFindingGroups } from "./kernel-check-finding-groups.js";
import { loadKernelCheckFindingGroups } from "./kernel-check-finding-groups.js";
import { buildKernelCheckPhases } from "./kernel-check-phases.js";

const flattenKernelCheckFindings = (groups: KernelCheckFindingGroups): Finding[] => {
  return [
    ...groups.supportLawBoundaryFindings,
    ...groups.frozenConclusionFindings,
    ...groups.kernelListFindings,
    ...groups.blueprintListFindings,
    ...groups.foundationLawFindings,
    ...groups.supportGovernanceDomainFindings,
    ...groups.localDevelopmentToolingFindings,
    ...groups.capabilityRootFindings,
    ...groups.forbiddenOwnerLiteralFindings,
  ];
};

export async function runKernelChecks(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const groups = await loadKernelCheckFindingGroups();
  return {
    findings: flattenKernelCheckFindings(groups),
    phases: buildKernelCheckPhases(groups),
  };
}
