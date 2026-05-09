import { buildCapabilityCatalog, CAPABILITY_CATALOG_VERSION } from "./capability-catalog/index.js";
import { humanize } from "./capability-catalog/policies.js";
import type {
  MapAuthoringCapabilityChild,
  MapAuthoringCapabilityGroup,
  MapAuthoringInputPackage,
} from "./map-authoring-input-package.schema.js";

const PRODUCED_OUTPUT_REFS_BY_ABILITY_GROUP: Record<string, string[]> = {
  ai: ["aiResultRef", "aiProofRef"],
  "visual-target": ["visualTargetResultRef"],
  screenshot: ["screenshotRef", "captureProofRef"],
  "geometry-guard": ["geometryGuardResultRef"],
  "mouse-click": ["clickResultRef"],
  "text-input": ["textInputResultRef", "postActionVerificationRef"],
  "mouse-scroll": ["scrollResultRef", "postScrollVerificationRef"],
  open: ["pageOpenRef", "navigationProofRef"],
  "page-state": ["pageStateRef"],
  "post-action-verification": ["postActionVerificationResultRef"],
  "forensics-persistence": ["forensicsRecordRef"],
};

const ACTIVE_ABILITY_GROUP_IDS = [
  "commander-console",
  "orchestration",
  "nerve-bus",
  "ai",
  "open",
  "screenshot",
  "visual-target",
  "geometry-guard",
  "mouse-click",
  "text-input",
  "mouse-scroll",
  "post-action-verification",
  "forensics-persistence",
  "page-state",
] as const;

const RUNTIME_ONLY_OWNER_IDS = ["commander-console", "orchestration", "nerve-bus"] as const;

const REQUIRED_INPUT_REFS_BY_ABILITY_GROUP: Record<string, string[]> = {
  ai: ["promptInputRef"],
  "visual-target": ["sourceImageRef"],
  screenshot: ["captureTargetRef"],
  "geometry-guard": ["visualTargetResultRef"],
  "mouse-click": ["geometryGuardResultRef"],
  "text-input": ["approvedTextRef", "targetProofRef", "focusProofRef"],
  "mouse-scroll": ["scrollAnchorRef"],
  open: ["targetUrlRef"],
  "page-state": ["pageRef"],
  "post-action-verification": ["clickResultRef"],
  "forensics-persistence": ["proofRef"],
};

const ALLOWED_STEP_KINDS_BY_ABILITY_GROUP: Record<string, string[]> = {
  ai: ["ai"],
  open: ["action"],
  "mouse-click": ["action"],
  "mouse-scroll": ["action"],
  "text-input": ["action"],
  "forensics-persistence": ["evidence"],
};

const FAILURE_MODES_BY_ABILITY_GROUP: Record<string, string[]> = {
  ai: ["schema_validation_failed", "provider_blocked", "low_confidence_review"],
  "mouse-click": ["target_not_ready", "post_action_verification_failed", "timeout"],
  "text-input": ["target_not_ready", "post_action_verification_failed", "timeout"],
  "mouse-scroll": ["target_not_ready", "post_action_verification_failed", "timeout"],
  open: ["navigation_failed", "unsafe_target_blocked", "timeout"],
};

const GEOMETRY_PROOF_GROUPS = new Set(["mouse-scroll", "text-input", "geometry-guard"]);
const GEOMETRY_GUARD_RESULT_GROUPS = new Set(["mouse-click"]);
const TARGET_PROOF_GROUPS = new Set(["text-input"]);

const buildProducedOutputRefs = (abilityGroupId: string): string[] => {
  return PRODUCED_OUTPUT_REFS_BY_ABILITY_GROUP[abilityGroupId] ?? ["runtimeProofRef"];
};

const buildRequiredInputRefs = (abilityGroupId: string, childCapabilityId: string): string[] => {
  if (abilityGroupId === "text-input" && childCapabilityId === "press-navigation-key") {
    return ["targetProofRef", "focusProofRef"];
  }
  return REQUIRED_INPUT_REFS_BY_ABILITY_GROUP[abilityGroupId] ?? [];
};

const buildAllowedStepKinds = (abilityGroupId: string): string[] => {
  return ALLOWED_STEP_KINDS_BY_ABILITY_GROUP[abilityGroupId] ?? ["observation", "verification"];
};

const buildSideEffectLevel = (
  abilityGroupId: string,
  childCapabilityId: string,
): MapAuthoringCapabilityChild["sideEffectLevel"] => {
  if (abilityGroupId === "forensics-persistence" || abilityGroupId === "mouse-click") {
    return "write";
  }
  if (abilityGroupId === "text-input") {
    return childCapabilityId.includes("commit") || childCapabilityId.includes("press-key") ? "submit" : "write";
  }
  return "read";
};

const buildFailureModes = (abilityGroupId: string): string[] => {
  return FAILURE_MODES_BY_ABILITY_GROUP[abilityGroupId] ?? ["precondition_failed", "timeout", "failed"];
};

const includeProofRequirements = (condition: boolean, refs: string[]): string[] => {
  return condition ? refs : [];
};

const buildProofRequirements = (abilityGroupId: string, childCapabilityId: string): string[] => {
  if (abilityGroupId === "text-input" && childCapabilityId === "press-navigation-key") {
    return ["runtimeProofRef", "targetProofRef", "focusProofRef"];
  }
  return [
    "runtimeProofRef",
    ...includeProofRequirements(GEOMETRY_PROOF_GROUPS.has(abilityGroupId), ["geometryProofRef"]),
    ...includeProofRequirements(GEOMETRY_GUARD_RESULT_GROUPS.has(abilityGroupId), ["geometryGuardResultRef"]),
    ...includeProofRequirements(TARGET_PROOF_GROUPS.has(abilityGroupId), ["targetProofRef"]),
    ...includeProofRequirements(abilityGroupId === "text-input", ["focusProofRef", "approvedTextRef"]),
    ...includeProofRequirements(abilityGroupId === "ai", ["promptContractId", "outputSchemaRef", "aiProofRef"]),
    ...includeProofRequirements(abilityGroupId === "screenshot", ["captureProofRef"]),
    ...includeProofRequirements(abilityGroupId === "forensics-persistence", ["evidencePacketRef"]),
    ...includeProofRequirements(abilityGroupId === "mouse-scroll" && childCapabilityId.includes("region"), ["scrollRegionRef"]),
  ];
};

type CapabilityCatalogEntry = ReturnType<typeof buildCapabilityCatalog>["entries"][number];
type CapabilityCatalogDocument = ReturnType<typeof buildCapabilityCatalog>;

const buildCapabilityChild = (
  entry: CapabilityCatalogEntry,
): MapAuthoringCapabilityChild => {
  const sideEffectLevel = buildSideEffectLevel(entry.abilityGroupId, entry.childCapabilityId);
  return {
    childCapabilityId: entry.childCapabilityId,
    childCapabilityCode: entry.childCapabilityId,
    displayName: humanize(entry.childCapabilityId),
    description: entry.description,
    inputSchemaRef: entry.inputSchemaRef,
    outputSchemaRef: entry.outputSchemaRef,
    requiredInputRefs: buildRequiredInputRefs(entry.abilityGroupId, entry.childCapabilityId),
    producedOutputRefs: buildProducedOutputRefs(entry.abilityGroupId),
    requiresGeometryProof: entry.requiresGeometryProof,
    requiresTargetProof: entry.abilityGroupId === "mouse-click" || entry.abilityGroupId === "text-input",
    requiresFocusProof: entry.abilityGroupId === "text-input",
    requiresApprovedText: entry.abilityGroupId === "text-input" && entry.childCapabilityId !== "press-navigation-key",
    requiresPostActionVerification: entry.requiresPostActionVerification,
    requiresAutomationGate: entry.requiresAutomationGate || ["submit", "delete", "purchase"].includes(sideEffectLevel),
    sensitiveOperation: entry.sensitiveOperation,
    sideEffectLevel,
    allowedStepKinds: buildAllowedStepKinds(entry.abilityGroupId),
    supportedTargetKinds: entry.supportedTargets,
    forbiddenResponsibilities: entry.forbiddenResponsibilities.length > 0 ? entry.forbiddenResponsibilities : ["unspecified"],
    proofRequirements: buildProofRequirements(entry.abilityGroupId, entry.childCapabilityId),
    failureModes: buildFailureModes(entry.abilityGroupId),
  };
};

const buildRuntimeOnlyChild = (abilityGroupId: string): MapAuthoringCapabilityChild => ({
  childCapabilityId: `${abilityGroupId}:runtime-owner-boundary`,
  childCapabilityCode: "runtime-owner-boundary",
  displayName: `${humanize(abilityGroupId)} Runtime Owner Boundary`,
  description: `${humanize(abilityGroupId)} is an active GrassEye ability-group boundary truth, but it is not routable as a generated map action step.`,
  inputSchemaRef: `${abilityGroupId}.runtime-boundary.input`,
  outputSchemaRef: `${abilityGroupId}.runtime-boundary.output`,
  requiredInputRefs: [],
  producedOutputRefs: ["runtimeBoundaryRef"],
  requiresGeometryProof: false,
  requiresTargetProof: false,
  requiresFocusProof: false,
  requiresApprovedText: false,
  requiresPostActionVerification: false,
  requiresAutomationGate: false,
  sensitiveOperation: false,
  sideEffectLevel: "none",
  allowedStepKinds: ["runtime-owner-boundary"],
  supportedTargetKinds: [],
  forbiddenResponsibilities: ["generated_map_step_routing", "direct_runtime_execution", "provider_or_secret_access"],
  proofRequirements: ["runtimeBoundaryRef"],
  failureModes: ["not_map_routable"],
});

const buildRuntimeOnlyGroup = (abilityGroupId: string): MapAuthoringCapabilityGroup => ({
  abilityGroupId,
  abilityGroupCode: abilityGroupId,
  displayName: humanize(abilityGroupId),
  description: `${humanize(abilityGroupId)} active GrassEye ability-group boundary truth. This owner is runtime-only for map authoring and must not be emitted as an executable map step.`,
  ownerDomain: abilityGroupId,
  routableByMap: false,
  publicContractRef: `contract://${abilityGroupId}/public/v1`,
  inputSchemaRef: `${abilityGroupId}.group.input`,
  outputSchemaRef: `${abilityGroupId}.group.output`,
  forbiddenResponsibilities: ["generated_map_step_routing", "direct_runtime_execution", "provider_or_secret_access"],
  children: [buildRuntimeOnlyChild(abilityGroupId)],
});

export const buildCapabilityGroupsFromCatalog = (
  capabilityCatalog: CapabilityCatalogDocument,
  generatedAt: string,
): MapAuthoringInputPackage["capabilityCatalog"] => {
  const grouped = new Map<string, MapAuthoringCapabilityChild[]>();
  for (const entry of capabilityCatalog.entries.filter((item) => item.routableByMap)) {
    const children = grouped.get(entry.abilityGroupId) ?? [];
    children.push(buildCapabilityChild(entry));
    grouped.set(entry.abilityGroupId, children);
  }

  const routableGroups: MapAuthoringCapabilityGroup[] = [...grouped.entries()].map(([abilityGroupId, children]) => ({
    abilityGroupId,
    abilityGroupCode: abilityGroupId,
    displayName: humanize(abilityGroupId),
    description: `${humanize(abilityGroupId)} governed capability group for map authoring and validation.`,
    ownerDomain: abilityGroupId,
    routableByMap: true,
    publicContractRef: `contract://${abilityGroupId}/public/v1`,
    inputSchemaRef: `${abilityGroupId}.group.input`,
    outputSchemaRef: `${abilityGroupId}.group.output`,
    forbiddenResponsibilities: [...new Set(children.flatMap((child) => child.forbiddenResponsibilities))],
    children,
  }));
  const routableById = new Map(routableGroups.map((group) => [group.abilityGroupId, group]));
  const abilityGroups = ACTIVE_ABILITY_GROUP_IDS.map((abilityGroupId) =>
    routableById.get(abilityGroupId) ?? buildRuntimeOnlyGroup(abilityGroupId),
  );
  const mapRoutableChildren = abilityGroups
    .filter((group) => group.routableByMap)
    .flatMap((group) => group.children);

  return {
    version: CAPABILITY_CATALOG_VERSION,
    generatedAt,
    generatedFrom: "src/map-plugins/authoring/map-authoring-input-package-builder.ts",
    activeAbilityGroupCount: 14,
    abilityGroups,
    mapRoutableChildren,
    runtimeOnlyOwners: [...RUNTIME_ONLY_OWNER_IDS],
    authoringVisibilityPolicy: {
      abilityTruthSource: "capabilityCatalog.abilityGroups",
      routableStepSource: "capabilityCatalog.mapRoutableChildren",
      aiMustNotInvent: true,
    },
  };
};

export const buildCapabilityGroups = (generatedAt: string): MapAuthoringInputPackage["capabilityCatalog"] => {
  return buildCapabilityGroupsFromCatalog(buildCapabilityCatalog(), generatedAt);
};
