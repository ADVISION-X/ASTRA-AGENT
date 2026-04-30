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

const buildInvalidInputRuntimeProof = (input: {
  child: ForensicsInvalidInputChild;
  startedAt: string;
  endedAt: string;
  detail: string;
  policyDecision: ForensicsPolicyDecision;
  integrityDecision: ForensicsIntegrityDecision;
}) => ({
  proofId: `forensics-proof:invalid-input:${input.child.childCapabilityId}`,
  runId: `invalid-input:${input.child.childCapabilityId}`,
  missionId: "invalid-input",
  sessionId: "invalid-session",
  roundId: "invalid-round",
  videoVisitId: null,
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
  durationMs: Math.max(0, new Date(input.endedAt).getTime() - new Date(input.startedAt).getTime()),
  status: "failed",
  storageOperation: input.policyDecision.storageOperation,
  inputRecordRefs: [],
  outputRecordRefs: [],
  artifactRefs: [],
  storageRef: null,
  integrityHash: null,
  policyDecision: input.policyDecision,
  integrityDecision: input.integrityDecision,
  failureReason: buildInvalidInputFailureReason(input.detail),
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