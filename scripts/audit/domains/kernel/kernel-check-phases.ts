import { createPhase } from "../../core/result.js";
import type { InspectorPhase } from "../../core/schema.js";

import type { KernelCheckFindingGroups } from "./kernel-check-finding-groups.js";

type KernelCheckPhaseDefinition = {
  name: string;
  findingsKey: keyof KernelCheckFindingGroups;
  passSummary: string;
  failSummary: string;
};

const KERNEL_CHECK_PHASE_DEFINITIONS: KernelCheckPhaseDefinition[] = [
  {
    name: "support-law-runtime-boundary",
    findingsKey: "supportLawBoundaryFindings",
    passSummary: "Kernel Fixed Formula keeps support laws as governance boundaries only, not a second runtime chain.",
    failSummary: "Kernel Fixed Formula drifted and now allows a second runtime chain through support laws.",
  },
  {
    name: "frozen-baseline-conclusion",
    findingsKey: "frozenConclusionFindings",
    passSummary: "Frozen baseline conclusion keeps the governed owner-count summary.",
    failSummary: "Frozen baseline conclusion drifted away from the governed owner-count summary.",
  },
  {
    name: "kernel-active-ability-groups",
    findingsKey: "kernelListFindings",
    passSummary: "Kernel keeps the fixed 14 active ability-group owners.",
    failSummary: "Kernel Active Ability Groups drifted away from the fixed 14-owner constitution.",
  },
  {
    name: "frozen-baseline-active-ability-groups",
    findingsKey: "blueprintListFindings",
    passSummary: "Frozen baseline keeps the fixed 14 active ability-group owners.",
    failSummary: "Frozen baseline Active Ability Groups drifted away from the fixed 14-owner constitution.",
  },
  {
    name: "foundation-laws-baseline",
    findingsKey: "foundationLawFindings",
    passSummary: "Kernel and frozen baseline keep the fixed five foundation laws.",
    failSummary: "Kernel or frozen baseline foundation laws drifted away from the fixed five-law baseline.",
  },
  {
    name: "support-governance-domain-baseline",
    findingsKey: "supportGovernanceDomainFindings",
    passSummary: "Kernel and frozen baseline keep the fixed support governance domain set.",
    failSummary: "Kernel or frozen baseline support governance domains drifted away from the fixed single-domain baseline.",
  },
  {
    name: "local-development-tooling-baseline",
    findingsKey: "localDevelopmentToolingFindings",
    passSummary: "Kernel and frozen baseline keep the fixed local development tooling set.",
    failSummary: "Kernel or frozen baseline local development tooling drifted away from the fixed debug-loop-controller baseline.",
  },
  {
    name: "capability-root-top-level-owners",
    findingsKey: "capabilityRootFindings",
    passSummary: "src/capabilities exposes only the 14 governed top-level ability-group roots.",
    failSummary: "src/capabilities still exposes non-constitutional top-level roots.",
  },
  {
    name: "forbidden-top-level-owner-literals",
    findingsKey: "forbiddenOwnerLiteralFindings",
    passSummary: "Governed source does not emit forbidden top-level owner literals.",
    failSummary: "Governed source still emits forbidden top-level owner literals.",
  },
];

const createKernelCheckPhase = (
  name: string,
  findingsCount: number,
  passSummary: string,
  failSummary: string,
): InspectorPhase => {
  return createPhase(name, findingsCount === 0 ? "PASS" : "CODE VIOLATION", findingsCount === 0, findingsCount === 0 ? passSummary : failSummary);
};

export function buildKernelCheckPhases(groups: KernelCheckFindingGroups): InspectorPhase[] {
  return KERNEL_CHECK_PHASE_DEFINITIONS.map((definition) => {
    return createKernelCheckPhase(
      definition.name,
      groups[definition.findingsKey].length,
      definition.passSummary,
      definition.failSummary,
    );
  });
}