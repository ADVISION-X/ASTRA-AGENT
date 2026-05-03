import type { CapabilityCatalogEntry } from "../authoring/capability-catalog/index.js";
import { buildCapabilityCatalog } from "../authoring/capability-catalog/index.js";
import type { MapPackageValidationIssue } from "../shared/map-package-failure.js";
import type { MapPackage } from "../shared/map-package-types.js";
import { MAP_PLUGIN_ALLOWED_ABILITY_GROUP_IDS } from "../schema/operational-map-ability.schema.js";

const GOVERNED_ABILITY_GROUP_REGISTRY = new Set(MAP_PLUGIN_ALLOWED_ABILITY_GROUP_IDS);

const buildCapabilityKey = (abilityGroupId: string, childCapabilityId: string): string =>
  `${abilityGroupId}:${childCapabilityId}`;

const buildCapabilityEntryIndex = (): Map<string, CapabilityCatalogEntry> =>
  new Map(
    buildCapabilityCatalog().entries.map((entry) => [buildCapabilityKey(entry.abilityGroupId, entry.childCapabilityId), entry]),
  );

function createCapabilityIssue(message: string, path: string): MapPackageValidationIssue {
  return {
    code: "missing_dependency",
    message,
    path,
    severity: "fatal",
  };
}

function hasGeometryProofInput(step: MapPackage["operationalMap"]["steps"][number]): boolean {
  return step.inputRefs.includes("geometryProofRef");
}

export function validateCapabilityRegistry(mapPackage: MapPackage): MapPackageValidationIssue[] {
  const issues: MapPackageValidationIssue[] = [];
  const capabilityEntries = buildCapabilityEntryIndex();

  for (const step of mapPackage.operationalMap.steps) {
    if (step.targetAbilityGroupId && !GOVERNED_ABILITY_GROUP_REGISTRY.has(step.targetAbilityGroupId)) {
      issues.push(createCapabilityIssue(
        `Target ability group ${step.targetAbilityGroupId} is outside the governed registry snapshot.`,
        `operationalMap.steps.${step.stepId}`,
      ));
      continue;
    }
    if (!step.targetAbilityGroupId) {
      continue;
    }

    const capabilityEntry = capabilityEntries.get(buildCapabilityKey(step.targetAbilityGroupId, step.childCapabilityId));
    if (!capabilityEntry) {
      issues.push(createCapabilityIssue(
        `Target child capability ${step.targetAbilityGroupId}/${step.childCapabilityId} is outside the governed capability catalog.`,
        `operationalMap.steps.${step.stepId}`,
      ));
      continue;
    }
    if (!capabilityEntry.routableByMap) {
      issues.push(createCapabilityIssue(
        `Target child capability ${step.targetAbilityGroupId}/${step.childCapabilityId} is not routable by governed maps.`,
        `operationalMap.steps.${step.stepId}`,
      ));
    }
    if (capabilityEntry.requiresGeometryProof && !hasGeometryProofInput(step)) {
      issues.push(createCapabilityIssue(
        `Target child capability ${step.targetAbilityGroupId}/${step.childCapabilityId} requires geometryProofRef.`,
        `operationalMap.steps.${step.stepId}`,
      ));
    }
    if (capabilityEntry.requiresPostActionVerification && step.postActionVerification === null) {
      issues.push(createCapabilityIssue(
        `Target child capability ${step.targetAbilityGroupId}/${step.childCapabilityId} requires postActionVerification.`,
        `operationalMap.steps.${step.stepId}`,
      ));
    }
  }
  return issues;
}
