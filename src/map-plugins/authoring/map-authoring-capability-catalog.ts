import { buildCapabilityCatalog, CAPABILITY_CATALOG_VERSION } from "./capability-catalog/index.js";
import { humanize } from "./capability-catalog/policies.js";
import type {
  MapAuthoringCapabilityChild,
  MapAuthoringCapabilityGroup,
  MapAuthoringInputPackage,
} from "./map-authoring-input-package.schema.js";

const PRODUCED_OUTPUT_REFS_BY_ABILITY_GROUP: Record<string, string[]> = {
  ai: ["aiResultRef", "aiProofRef"],
  "visual-target": ["visualTargetRef", "targetProofRef"],
  screenshot: ["screenshotRef", "captureProofRef"],
  "geometry-guard": ["geometryProofRef"],
  "mouse-click": ["actionResultRef", "postActionVerificationRef"],
  "text-input": ["textInputResultRef", "postActionVerificationRef"],
  "mouse-scroll": ["scrollResultRef", "postScrollVerificationRef"],
  open: ["pageOpenRef", "navigationProofRef"],
  "page-state": ["pageStateRef"],
  "post-action-verification": ["postActionVerificationRef"],
  "forensics-persistence": ["forensicsRecordRef"],
};

const REQUIRED_INPUT_REFS_BY_ABILITY_GROUP: Record<string, string[]> = {
  ai: ["promptInputRef"],
  "visual-target": ["sourceImageRef"],
  screenshot: ["captureTargetRef"],
  "geometry-guard": ["candidateGeometryRef"],
  "mouse-click": ["geometryProofRef", "targetProofRef"],
  "text-input": ["approvedTextRef", "targetProofRef", "focusProofRef"],
  "mouse-scroll": ["scrollAnchorRef"],
  open: ["targetUrlRef"],
  "page-state": ["pageRef"],
  "post-action-verification": ["preActionEvidenceRef", "postActionEvidenceRef"],
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

const GEOMETRY_PROOF_GROUPS = new Set(["mouse-click", "mouse-scroll", "text-input", "geometry-guard"]);
const TARGET_PROOF_GROUPS = new Set(["mouse-click", "text-input"]);

const buildProducedOutputRefs = (abilityGroupId: string): string[] => {
  return PRODUCED_OUTPUT_REFS_BY_ABILITY_GROUP[abilityGroupId] ?? ["runtimeProofRef"];
};

const buildRequiredInputRefs = (abilityGroupId: string): string[] => {
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
  return FAILURE_MODES_BY_ABILITY_GROUP[abilityGroupId] ?? ["precondition_failed", "timeout", "review_required"];
};

const includeProofRequirements = (condition: boolean, refs: string[]): string[] => {
  return condition ? refs : [];
};

const buildProofRequirements = (abilityGroupId: string, childCapabilityId: string): string[] => {
  return [
    "runtimeProofRef",
    ...includeProofRequirements(GEOMETRY_PROOF_GROUPS.has(abilityGroupId), ["geometryProofRef"]),
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
    requiredInputRefs: buildRequiredInputRefs(entry.abilityGroupId),
    producedOutputRefs: buildProducedOutputRefs(entry.abilityGroupId),
    requiresGeometryProof: entry.requiresGeometryProof,
    requiresTargetProof: entry.abilityGroupId === "mouse-click" || entry.abilityGroupId === "text-input",
    requiresFocusProof: entry.abilityGroupId === "text-input",
    requiresApprovedText: entry.abilityGroupId === "text-input",
    requiresPostActionVerification: entry.requiresPostActionVerification,
    requiresHumanReview: entry.requiresReviewGate || ["submit", "delete", "purchase"].includes(sideEffectLevel),
    sensitiveOperation: entry.sensitiveOperation,
    sideEffectLevel,
    allowedStepKinds: buildAllowedStepKinds(entry.abilityGroupId),
    supportedTargetKinds: entry.supportedTargets,
    forbiddenResponsibilities: entry.forbiddenResponsibilities.length > 0 ? entry.forbiddenResponsibilities : ["unspecified"],
    proofRequirements: buildProofRequirements(entry.abilityGroupId, entry.childCapabilityId),
    failureModes: buildFailureModes(entry.abilityGroupId),
  };
};

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

  const abilityGroups: MapAuthoringCapabilityGroup[] = [...grouped.entries()].map(([abilityGroupId, children]) => ({
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

  return {
    version: CAPABILITY_CATALOG_VERSION,
    generatedAt,
    generatedFrom: "src/map-plugins/authoring/map-authoring-input-package-builder.ts",
    abilityGroups,
  };
};

export const buildCapabilityGroups = (generatedAt: string): MapAuthoringInputPackage["capabilityCatalog"] => {
  return buildCapabilityGroupsFromCatalog(buildCapabilityCatalog(), generatedAt);
};