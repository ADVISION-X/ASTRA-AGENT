import type { ForensicsAbilityInput, ForensicsIntegrityDecision, ForensicsPolicyDecision } from "../schema.js";

export type ForensicsChildIntegritySpec = {
  requireSourceRecordRefs: boolean;
  requireParentRefs: boolean;
  requireArtifactRefs: boolean;
  requireStorageRef: boolean;
};

const mergeIntegrityPolicy = (request: ForensicsAbilityInput, defaults: ForensicsChildIntegritySpec): ForensicsChildIntegritySpec => ({
  requireSourceRecordRefs: request.integrityPolicy?.requireSourceRecordRefs ?? defaults.requireSourceRecordRefs,
  requireParentRefs: request.integrityPolicy?.requireParentRefs ?? defaults.requireParentRefs,
  requireArtifactRefs: request.integrityPolicy?.requireArtifactRefs ?? defaults.requireArtifactRefs,
  requireStorageRef: request.integrityPolicy?.requireStorageRef ?? defaults.requireStorageRef,
});

const createFailedDecision = (reason: string, mergedPolicy: ForensicsChildIntegritySpec): ForensicsIntegrityDecision => ({
  status: "failed",
  reason,
  ...mergedPolicy,
});

type IntegrityFailureInput = {
  request: ForensicsAbilityInput;
  mergedPolicy: ForensicsChildIntegritySpec;
  policyDecision: ForensicsPolicyDecision;
};

const CORE_CHAIN_FIELDS = [
  "missionId",
  "runId",
  "stepId",
  "bindingPackageId",
  "bindingPackageVersion",
  "selectedBindingId",
  "bindingVersion",
  "bindingSnapshotRef",
  "capabilityCallId",
] as const;

const resolveCoreChainFailure = (input: IntegrityFailureInput) => {
  for (const fieldName of CORE_CHAIN_FIELDS) {
    const value = input.request[fieldName];
    if (!value) {
      return `${fieldName} is required.`;
    }
  }

  return null;
};

const resolveSourceRecordRefsFailure = (input: IntegrityFailureInput) => (
  input.mergedPolicy.requireSourceRecordRefs && input.request.sourceRecordRefs.length === 0
    ? "sourceRecordRefs are required."
    : null
);

const resolveParentRefsFailure = (input: IntegrityFailureInput) => (
  input.mergedPolicy.requireParentRefs && input.request.parentRefs.length === 0
    ? "parentRefs are required."
    : null
);

const resolveArtifactRefsFailure = (input: IntegrityFailureInput) => (
  input.mergedPolicy.requireArtifactRefs && input.request.artifactRefs.length === 0
    ? "artifactRefs are required."
    : null
);

const resolveExternalArtifactFailure = (input: IntegrityFailureInput) => (
  !input.policyDecision.allowExternalArtifactRef && input.request.artifactRefs.some((artifactRef) => artifactRef.storageRef === null)
    ? "artifactRefs require storageRef unless external artifact refs are explicitly allowed."
    : null
);

const resolveParentStorageFailure = (input: IntegrityFailureInput) => (
  input.mergedPolicy.requireStorageRef && input.request.parentRefs.some((parentRef) => parentRef.storageRef === null)
    ? "parentRefs require storageRef under this integrity policy."
    : null
);

const resolvePromptRefFailure = (input: IntegrityFailureInput) => (
  input.request.recordType === "ai_result_record"
  && (!input.request.promptContractId || !input.request.promptContractVersion || !input.request.promptCatalogVersion)
    ? "AI records require promptContractId, promptContractVersion, and promptCatalogVersion."
    : null
);

const resolveActionVerificationFailure = (input: IntegrityFailureInput) => (
  input.request.recordType === "structured_action_log"
  && (!input.request.actionRef || !input.request.postActionVerificationRef)
    ? "Action records require actionRef and postActionVerificationRef."
    : null
);

const resolveDecisionRefFailure = (input: IntegrityFailureInput) => (
  (input.request.recordType === "browse_ledger_entry"
    || input.request.recordType === "evidence_packet"
    || input.request.recordType === "failed_record")
  && !input.request.decisionRef
    ? "Finalization records require decisionRef."
    : null
);

const INTEGRITY_FAILURE_RESOLVERS = [
  resolveCoreChainFailure,
  resolveSourceRecordRefsFailure,
  resolveParentRefsFailure,
  resolveArtifactRefsFailure,
  resolveExternalArtifactFailure,
  resolveParentStorageFailure,
  resolvePromptRefFailure,
  resolveActionVerificationFailure,
  resolveDecisionRefFailure,
] as const;

const resolveIntegrityFailureReason = (input: {
  request: ForensicsAbilityInput;
  mergedPolicy: ForensicsChildIntegritySpec;
  policyDecision: ForensicsPolicyDecision;
}): string | null => {
  for (const resolveFailure of INTEGRITY_FAILURE_RESOLVERS) {
    const reason = resolveFailure(input);
    if (reason) {
      return reason;
    }
  }

  return null;
};

export function evaluateForensicsIntegrity(input: {
  request: ForensicsAbilityInput;
  defaults: ForensicsChildIntegritySpec;
  policyDecision: ForensicsPolicyDecision;
}): ForensicsIntegrityDecision {
  const mergedPolicy = mergeIntegrityPolicy(input.request, input.defaults);
  const failureReason = resolveIntegrityFailureReason({ request: input.request, mergedPolicy, policyDecision: input.policyDecision });
  if (failureReason) {
    return createFailedDecision(failureReason, mergedPolicy);
  }
  if (input.request.persistencePolicy.allowPartialRefs) {
    return { status: "review_required", reason: "partial refs allowed by policy; record persisted under review.", ...mergedPolicy };
  }

  return { status: "passed", reason: null, ...mergedPolicy };
}