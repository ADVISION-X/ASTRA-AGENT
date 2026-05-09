import type { CapabilityCatalogEntry } from "../authoring/capability-catalog/index.js";
import { buildCapabilityCatalog } from "../authoring/capability-catalog/index.js";
import type { MapPackageValidationIssue } from "../shared/map-package-failure.js";
import type { MapPackage } from "../shared/map-package-types.js";
import { MAP_PLUGIN_ALLOWED_ABILITY_GROUP_IDS } from "../schema/operational-map-ability.schema.js";
import { findRoutePlanById } from "../route-plans/index.js";

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

function hasRequiredCoordinateInput(step: MapPackage["operationalMap"]["steps"][number]): boolean {
  if (step.targetAbilityGroupId === "mouse-click") {
    return step.inputRefs.includes("geometryGuardResultRef");
  }

  return step.inputRefs.includes("geometryProofRef");
}

function buildCoordinateInputRequirementMessage(step: MapPackage["operationalMap"]["steps"][number]): string {
  return step.targetAbilityGroupId === "mouse-click"
    ? `Target child capability ${step.targetAbilityGroupId}/${step.childCapabilityId} requires geometryGuardResultRef.`
    : `Target child capability ${step.targetAbilityGroupId}/${step.childCapabilityId} requires geometryProofRef.`;
}

function createStepPath(step: MapPackage["operationalMap"]["steps"][number]): string {
  return `operationalMap.steps.${step.stepId}`;
}

function validateTargetAbilityGroup(step: MapPackage["operationalMap"]["steps"][number]): MapPackageValidationIssue[] {
  if (!step.targetAbilityGroupId || GOVERNED_ABILITY_GROUP_REGISTRY.has(step.targetAbilityGroupId)) {
    return [];
  }

  return [createCapabilityIssue(
    `Target ability group ${step.targetAbilityGroupId} is outside the governed registry snapshot.`,
    createStepPath(step),
  )];
}

function validateCapabilityEntry(
  step: MapPackage["operationalMap"]["steps"][number],
  capabilityEntries: Map<string, CapabilityCatalogEntry>,
) {
  if (!step.targetAbilityGroupId) {
    return null;
  }

  return capabilityEntries.get(buildCapabilityKey(step.targetAbilityGroupId, step.childCapabilityId)) ?? null;
}

function validateCapabilityPolicies(
  step: MapPackage["operationalMap"]["steps"][number],
  capabilityEntry: CapabilityCatalogEntry | null,
): MapPackageValidationIssue[] {
  if (!step.targetAbilityGroupId) {
    return [];
  }
  if (!capabilityEntry) {
    return [createCapabilityIssue(
      `Target child capability ${step.targetAbilityGroupId}/${step.childCapabilityId} is outside the governed capability catalog.`,
      createStepPath(step),
    )];
  }

  const issues: MapPackageValidationIssue[] = [];
  if (!capabilityEntry.routableByMap) {
    issues.push(createCapabilityIssue(
      `Target child capability ${step.targetAbilityGroupId}/${step.childCapabilityId} is not routable by governed maps.`,
      createStepPath(step),
    ));
  }
  if (capabilityEntry.requiresGeometryProof && !hasRequiredCoordinateInput(step)) {
    issues.push(createCapabilityIssue(
      buildCoordinateInputRequirementMessage(step),
      createStepPath(step),
    ));
  }
  return issues;
}

function validateCapabilityStep(
  step: MapPackage["operationalMap"]["steps"][number],
  capabilityEntries: Map<string, CapabilityCatalogEntry>,
): MapPackageValidationIssue[] {
  if (!step.targetAbilityGroupId) {
    return [];
  }

  const targetAbilityIssues = validateTargetAbilityGroup(step);
  return targetAbilityIssues.length > 0
    ? targetAbilityIssues
    : validateCapabilityPolicies(step, validateCapabilityEntry(step, capabilityEntries));
}

export function validateCapabilityRegistry(mapPackage: MapPackage): MapPackageValidationIssue[] {
  const issues: MapPackageValidationIssue[] = [];
  const capabilityEntries = buildCapabilityEntryIndex();
  const routePlan = findRoutePlanById(mapPackage.operationalMap.routePlanId);
  const effectiveSteps = routePlan ? [...mapPackage.operationalMap.steps, ...routePlan.steps] : mapPackage.operationalMap.steps;

  for (const step of effectiveSteps) {
    issues.push(...validateCapabilityStep(step, capabilityEntries));
  }
  return issues;
}
