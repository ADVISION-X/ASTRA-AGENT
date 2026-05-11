import type { ForensicsAbilityInput, ForensicsIntegrityDecision, ForensicsPolicyDecision, ForensicsResult } from "../schema.js";
import { ForensicsResultSchema } from "../schema.js";
import type { ForensicsChildIntegritySpec } from "./forensics-integrity-gate.js";
import type { ForensicsChildPolicySpec } from "./forensics-policy-gate.js";

type ForensicsInvalidInputChild = {
  childCapabilityId: ForensicsAbilityInput["childCapabilityId"];
  recordType: ForensicsAbilityInput["recordType"];
  policy: Pick<ForensicsChildPolicySpec, "schemaVersion" | "onArtifactWriteFailure">;
  integrity: ForensicsChildIntegritySpec;
};

const createInvalidInputPolicyDecision = (child: ForensicsInvalidInputChild): ForensicsPolicyDecision => ({
  childCapabilityId: child.childCapabilityId,
  recordType: child.recordType,
  schemaVersion: child.policy.schemaVersion,
  persistenceMode: "append",
  storageOperation: child.childCapabilityId === "update-runtime-snapshot" ? "update-runtime-snapshot" : "append-record",
  idempotencyKey: "invalid-input",
  allowPartialRefs: false,
  allowExternalArtifactRef: false,
  onArtifactWriteFailure: child.policy.onArtifactWriteFailure,
});

const createInvalidInputIntegrityDecision = (child: ForensicsInvalidInputChild): ForensicsIntegrityDecision => ({
  status: "failed",
  reason: "Input schema validation failed.",
  requireSourceRecordRefs: child.integrity.requireSourceRecordRefs,
  requireParentRefs: child.integrity.requireParentRefs,
  requireArtifactRefs: child.integrity.requireArtifactRefs,
  requireStorageRef: child.integrity.requireStorageRef,
});

const buildInvalidInputFailureReason = (detail: string) => ({
  code: "input_schema_invalid",
  message: "Forensics input failed schema validation.",
  detail,
} as const);

const getInvalidInputDurationMs = (startedAt: string, endedAt: string): number => {
  return Math.max(0, new Date(endedAt).getTime() - new Date(startedAt).getTime());
};

const buildInvalidInputProofChain = (input: {
  child: ForensicsInvalidInputChild;
  startedAt: string;
  endedAt: string;
}) => ({
  proofId: `forensics-proof:invalid-input:${input.child.childCapabilityId}`,
  runId: `invalid-input:${input.child.childCapabilityId}`,
  missionId: "invalid-input",
  sessionId: "invalid-session",
  roundId: "invalid-round",
  videoVisitId: null,
  stepId: `invalid-step:${input.child.childCapabilityId}`,
  bindingPackageId: "invalid-map-package",
  bindingPackageVersion: "invalid-map-package-version",
  selectedBindingId: "invalid-selected-map",
  bindingVersion: "invalid-selected-map-version",
  bindingSnapshotRef: "invalid-activation-snapshot",
  capabilityCallId: `invalid-call:${input.child.childCapabilityId}`,
  abilityGroupId: "forensics-persistence",
  childCapabilityId: input.child.childCapabilityId,
  sourceAbilityGroupId: "invalid-input",
  sourceChildCapabilityId: "invalid-input",
  operationType: input.child.childCapabilityId,
  recordType: input.child.recordType,
  recordId: `${input.child.recordType}:invalid-input`,
  idempotencyKey: "invalid-input",
  startedAt: input.startedAt,
  endedAt: input.endedAt,
  durationMs: getInvalidInputDurationMs(input.startedAt, input.endedAt),
});

const buildInvalidInputRuntimeProof = (input: {
  child: ForensicsInvalidInputChild;
  startedAt: string;
  endedAt: string;
  detail: string;
  policyDecision: ForensicsPolicyDecision;
  integrityDecision: ForensicsIntegrityDecision;
}) => ({
  ...buildInvalidInputProofChain(input),
  status: "failed",
  storageOperation: input.policyDecision.storageOperation,
  inputRefs: [],
  outputRefs: [],
  inputRecordRefs: [],
  outputRecordRefs: [],
  parentRefs: [],
  artifactRefs: [],
  storageRef: null,
  integrityHash: null,
  promptContractId: null,
  promptContractVersion: null,
  promptCatalogVersion: null,
  actionRef: null,
  postActionVerificationRef: null,
  decisionRef: null,
  policyDecision: input.policyDecision,
  integrityDecision: input.integrityDecision,
  failureReason: buildInvalidInputFailureReason(input.detail),
  reviewRequiredReason: null,
  dataQualityFlags: [],
});

export const buildInvalidForensicsInputResult = (input: {
  child: ForensicsInvalidInputChild;
  startedAt: string;
  endedAt: string;
  detail: string;
}): ForensicsResult => {
  const policyDecision = createInvalidInputPolicyDecision(input.child);
  const integrityDecision = createInvalidInputIntegrityDecision(input.child);
  return ForensicsResultSchema.parse({
    abilityGroupId: "forensics-persistence",
    childCapabilityId: input.child.childCapabilityId,
    status: "failed",
    recordType: input.child.recordType,
    recordRef: {
      recordType: input.child.recordType,
      recordId: `${input.child.recordType}:invalid-input`,
      storageRef: null,
    },
    storageRef: null,
    artifactRefs: [],
    output: null,
    failureReason: buildInvalidInputFailureReason(input.detail),
    reviewRequiredReason: null,
    runtimeProof: buildInvalidInputRuntimeProof({ ...input, policyDecision, integrityDecision }),
    integrityDecision,
    policyDecision,
  });
};