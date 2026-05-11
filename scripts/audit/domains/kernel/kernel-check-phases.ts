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
    name: "current-narrative-authority",
    findingsKey: "frozenConclusionFindings",
    passSummary: "Kernel current narrative authority points only to the simple capability-machine blueprints.",
    failSummary: "Kernel current narrative authority drifted away from the simple capability-machine blueprints.",
  },
  {
    name: "active-owner-inventory-split",
    findingsKey: "kernelListFindings",
    passSummary: "Kernel frames current roots as implementation inventory and keeps support surfaces subordinate.",
    failSummary: "Kernel Active Ability Groups drifted away from the implementation-inventory and support-surface split.",
  },
  {
    name: "optional-blueprint-baseline-slot",
    findingsKey: "blueprintListFindings",
    passSummary: "Kernel does not require a second frozen owner table to route current work.",
    failSummary: "An obsolete frozen owner table is still being enforced as current routing truth.",
  },
  {
    name: "foundation-laws-baseline",
    findingsKey: "foundationLawFindings",
    passSummary: "Kernel keeps the current five foundation laws.",
    failSummary: "Kernel foundation laws drifted away from the current five-law baseline.",
  },
  {
    name: "support-governance-domain-baseline",
    findingsKey: "supportGovernanceDomainFindings",
    passSummary: "Kernel keeps support-governance domains empty.",
    failSummary: "Kernel support-governance domains drifted away from the current empty baseline.",
  },
  {
    name: "local-development-tooling-baseline",
    findingsKey: "localDevelopmentToolingFindings",
    passSummary: "Kernel keeps local development tooling outside active governance.",
    failSummary: "Kernel reintroduced local development tooling into active governance.",
  },
  {
    name: "capability-root-top-level-owners",
    findingsKey: "capabilityRootFindings",
    passSummary: "src/capabilities exposes only the current governed top-level roots.",
    failSummary: "src/capabilities still exposes top-level roots outside the current implementation inventory.",
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