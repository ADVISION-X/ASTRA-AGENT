import type { ForensicsAbilityInput, ForensicsIntegrityDecision, ForensicsIntegrityPolicy, ForensicsPolicyDecision } from "../schema.js";

export type ForensicsChildIntegritySpec = {
  requireSourceRecordRefs: boolean;
  requireParentRefs: boolean;
  requireArtifactRefs: boolean;
  requireStorageRef: boolean;
};

export function evaluateForensicsIntegrity(input: {
  request: ForensicsAbilityInput;
  defaults: ForensicsChildIntegritySpec;
  policyDecision: ForensicsPolicyDecision;
}): ForensicsIntegrityDecision {
  const mergedPolicy: ForensicsChildIntegritySpec = {
    requireSourceRecordRefs: input.request.integrityPolicy?.requireSourceRecordRefs ?? input.defaults.requireSourceRecordRefs,
    requireParentRefs: input.request.integrityPolicy?.requireParentRefs ?? input.defaults.requireParentRefs,
    requireArtifactRefs: input.request.integrityPolicy?.requireArtifactRefs ?? input.defaults.requireArtifactRefs,
    requireStorageRef: input.request.integrityPolicy?.requireStorageRef ?? input.defaults.requireStorageRef,
  };

  if (mergedPolicy.requireSourceRecordRefs && input.request.sourceRecordRefs.length === 0) {
    return { status: "failed", reason: "sourceRecordRefs are required.", ...mergedPolicy };
  }
  if (mergedPolicy.requireParentRefs && input.request.parentRefs.length === 0) {
    return { status: "failed", reason: "parentRefs are required.", ...mergedPolicy };
  }
  if (mergedPolicy.requireArtifactRefs && input.request.artifactRefs.length === 0) {
    return { status: "failed", reason: "artifactRefs are required.", ...mergedPolicy };
  }
  if (
    !input.policyDecision.allowExternalArtifactRef
    && input.request.artifactRefs.some((artifactRef) => artifactRef.storageRef === null)
  ) {
    return { status: "failed", reason: "artifactRefs require storageRef unless external artifact refs are explicitly allowed.", ...mergedPolicy };
  }
  if (
    mergedPolicy.requireStorageRef
    && input.request.parentRefs.some((parentRef) => parentRef.storageRef === null)
  ) {
    return { status: "failed", reason: "parentRefs require storageRef under this integrity policy.", ...mergedPolicy };
  }

  if (input.request.persistencePolicy.allowPartialRefs) {
    return { status: "review_required", reason: "partial refs allowed by policy; record persisted under review.", ...mergedPolicy };
  }

  return { status: "passed", reason: null, ...mergedPolicy };
}
