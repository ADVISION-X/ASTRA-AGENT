import type { CapabilityCatalogEntry } from "./schema.js";

type AbilityGroupPolicy = {
  supportedTargets: string[];
  routableByMap: boolean;
  requiresGeometryProof: boolean;
  requiresPostActionVerification: boolean;
  requiresReviewGate: boolean;
  sensitiveOperation: boolean;
  forbiddenResponsibilities: string[];
};

const ABILITY_GROUP_POLICIES: Record<string, AbilityGroupPolicy> = {
  ai: {
    supportedTargets: [],
    routableByMap: true,
    requiresGeometryProof: false,
    requiresPostActionVerification: false,
    requiresReviewGate: false,
    sensitiveOperation: false,
    forbiddenResponsibilities: ["execute browser actions", "invent prompt text", "read credentials or cookies"],
  },
  open: {
    supportedTargets: [],
    routableByMap: true,
    requiresGeometryProof: false,
    requiresPostActionVerification: true,
    requiresReviewGate: false,
    sensitiveOperation: false,
    forbiddenResponsibilities: ["click page elements", "skip page-state handoff", "reuse ungoverned URLs"],
  },
  screenshot: {
    supportedTargets: ["browser-viewport", "browser-region", "desktop-screen"],
    routableByMap: true,
    requiresGeometryProof: false,
    requiresPostActionVerification: false,
    requiresReviewGate: false,
    sensitiveOperation: false,
    forbiddenResponsibilities: ["execute actions", "author prompt contracts", "persist evidence records directly"],
  },
  "visual-target": {
    supportedTargets: ["browser-viewport", "desktop-screen", "source-image"],
    routableByMap: true,
    requiresGeometryProof: false,
    requiresPostActionVerification: false,
    requiresReviewGate: false,
    sensitiveOperation: false,
    forbiddenResponsibilities: ["click targets", "mutate platform state", "decide mission branching"],
  },
  "geometry-guard": {
    supportedTargets: ["browser-viewport", "desktop-screen", "source-image"],
    routableByMap: true,
    requiresGeometryProof: false,
    requiresPostActionVerification: false,
    requiresReviewGate: false,
    sensitiveOperation: false,
    forbiddenResponsibilities: ["execute actions", "capture screenshots", "persist evidence"],
  },
  "mouse-click": {
    supportedTargets: ["browser-viewport", "desktop-screen"],
    routableByMap: true,
    requiresGeometryProof: true,
    requiresPostActionVerification: true,
    requiresReviewGate: false,
    sensitiveOperation: true,
    forbiddenResponsibilities: ["invent geometry", "skip post-action verification", "read page state"],
  },
  "text-input": {
    supportedTargets: ["browser-input", "desktop-input"],
    routableByMap: true,
    requiresGeometryProof: true,
    requiresPostActionVerification: true,
    requiresReviewGate: true,
    sensitiveOperation: true,
    forbiddenResponsibilities: ["invent credentials", "click targets", "decide map branching"],
  },
  "mouse-scroll": {
    supportedTargets: ["browser-viewport", "desktop-screen"],
    routableByMap: true,
    requiresGeometryProof: true,
    requiresPostActionVerification: true,
    requiresReviewGate: false,
    sensitiveOperation: false,
    forbiddenResponsibilities: ["invent geometry", "capture screenshots", "persist evidence"],
  },
  "forensics-persistence": {
    supportedTargets: ["structured-log", "evidence-ledger", "artifact-store"],
    routableByMap: true,
    requiresGeometryProof: false,
    requiresPostActionVerification: false,
    requiresReviewGate: false,
    sensitiveOperation: true,
    forbiddenResponsibilities: ["execute browser actions", "classify page state", "author prompts"],
  },
  "page-state": {
    supportedTargets: ["browser-page"],
    routableByMap: true,
    requiresGeometryProof: false,
    requiresPostActionVerification: false,
    requiresReviewGate: false,
    sensitiveOperation: false,
    forbiddenResponsibilities: ["execute actions", "persist evidence", "author prompts"],
  },
  "post-action-verification": {
    supportedTargets: ["browser-page", "browser-viewport", "runtime-proof"],
    routableByMap: true,
    requiresGeometryProof: false,
    requiresPostActionVerification: false,
    requiresReviewGate: false,
    sensitiveOperation: false,
    forbiddenResponsibilities: ["execute recovery actions", "invent prompts", "persist unrelated evidence"],
  },
};

export const humanize = (value: string | undefined): string => (value ?? "unknown-child").split("-").filter(Boolean).join(" ");

export const buildEntry = (
  abilityGroupId: string,
  childCapabilityId: string,
  description: string,
  supportedTargets?: string[],
): CapabilityCatalogEntry => {
  const policy = ABILITY_GROUP_POLICIES[abilityGroupId];
  if (!policy) {
    throw new Error(`Unsupported ability group in capability catalog builder: ${abilityGroupId}`);
  }

  return {
    abilityGroupId,
    childCapabilityId,
    description,
    inputSchemaRef: `${abilityGroupId}.${childCapabilityId}.input`,
    outputSchemaRef: `${abilityGroupId}.${childCapabilityId}.output`,
    supportedTargets: supportedTargets ?? policy.supportedTargets,
    routableByMap: policy.routableByMap,
    requiresGeometryProof: policy.requiresGeometryProof,
    requiresPostActionVerification: policy.requiresPostActionVerification,
    requiresReviewGate: policy.requiresReviewGate,
    sensitiveOperation: policy.sensitiveOperation,
    forbiddenResponsibilities: policy.forbiddenResponsibilities,
  };
};
