import type { ForensicsClockPort } from "../ports/forensics-clock-port.js";
import { ForensicsResultSchema } from "../schema.js";
import type { ForensicsPersistenceAbilityInput, ForensicsPersistenceAbilityResult } from "../contract.js";

const createUnknownChildPolicyDecision = (request: ForensicsPersistenceAbilityInput) => ({
  childCapabilityId: "finalize-failed-record",
  recordType: "failed_record",
  schemaVersion: request.schemaVersion ?? "forensics.failed_record.v2",
  persistenceMode: "append",
  storageOperation: "append-record",
  idempotencyKey: `unknown-child:${request.childCapabilityId}`,
  allowPartialRefs: true,
  allowExternalArtifactRef: true,
  onArtifactWriteFailure: "review_required",
} as const);

const createUnknownChildIntegrityDecision = () => ({
  status: "failed",
  reason: "Unknown child capability cannot be dispatched.",
  requireSourceRecordRefs: false,
  requireParentRefs: false,
  requireArtifactRefs: false,
  requireStorageRef: false,
} as const);

const getUnknownChildDurationMs = (startedAt: string, endedAt: string): number => {
  return Math.max(0, new Date(endedAt).getTime() - new Date(startedAt).getTime());
};

const buildUnknownChildProofChain = (input: {
  request: ForensicsPersistenceAbilityInput;
  startedAt: string;
  endedAt: string;
}) => ({
  proofId: `forensics-proof:unknown-child:${input.request.childCapabilityId}`,
  runId: input.request.runId ?? "missing-runId",
  missionId: input.request.missionId ?? "missing-missionId",
  sessionId: input.request.sessionId,
  roundId: input.request.roundId,
  videoVisitId: input.request.videoVisitId ?? null,
  stepId: input.request.stepId ?? "missing-stepId",
  bindingPackageId: input.request.bindingPackageId ?? "missing-bindingPackageId",
  bindingPackageVersion: input.request.bindingPackageVersion ?? "missing-bindingPackageVersion",
  selectedBindingId: input.request.selectedBindingId ?? "missing-selectedBindingId",
  bindingVersion: input.request.bindingVersion ?? "missing-bindingVersion",
  bindingSnapshotRef: input.request.bindingSnapshotRef ?? "missing-bindingSnapshotRef",
  capabilityCallId: input.request.capabilityCallId ?? "missing-capabilityCallId",
  abilityGroupId: "forensics-persistence",
  childCapabilityId: "finalize-failed-record",
  sourceAbilityGroupId: input.request.sourceAbilityGroupId,
  sourceChildCapabilityId: input.request.sourceChildCapabilityId,
  operationType: "unknown-child-dispatch",
  recordType: "failed_record",
  recordId: `failed_record:unknown-child:${input.request.childCapabilityId}`,
  idempotencyKey: `unknown-child:${input.request.childCapabilityId}`,
  startedAt: input.startedAt,
  endedAt: input.endedAt,
  durationMs: getUnknownChildDurationMs(input.startedAt, input.endedAt),
});

const buildUnknownChildRuntimeProof = (input: {
  request: ForensicsPersistenceAbilityInput;
  startedAt: string;
  endedAt: string;
  policyDecision: ReturnType<typeof createUnknownChildPolicyDecision>;
  integrityDecision: ReturnType<typeof createUnknownChildIntegrityDecision>;
}) => ({
  ...buildUnknownChildProofChain(input),
  status: "failed",
  storageOperation: "append-record",
  inputRefs: input.request.inputRefs ?? [],
  outputRefs: input.request.outputRefs ?? [],
  inputRecordRefs: input.request.sourceRecordRefs ?? [],
  outputRecordRefs: [],
  parentRefs: input.request.parentRefs ?? [],
  artifactRefs: input.request.artifactRefs ?? [],
  storageRef: null,
  integrityHash: null,
  promptContractId: input.request.promptContractId ?? null,
  promptContractVersion: input.request.promptContractVersion ?? null,
  promptCatalogVersion: input.request.promptCatalogVersion ?? null,
  actionRef: input.request.actionRef ?? null,
  postActionVerificationRef: input.request.postActionVerificationRef ?? null,
  decisionRef: input.request.decisionRef ?? null,
  policyDecision: input.policyDecision,
  integrityDecision: input.integrityDecision,
  failureReason: { code: "unknown_child", message: `Unknown Forensics child capability: ${input.request.childCapabilityId}`, detail: null },
  reviewRequiredReason: null,
  dataQualityFlags: input.request.dataQualityFlags ?? [],
});

export function buildUnknownForensicsChildResult(input: {
  request: ForensicsPersistenceAbilityInput;
  clock: ForensicsClockPort;
}): ForensicsPersistenceAbilityResult {
  const startedAt = input.clock.now();
  const endedAt = input.clock.now();
  const policyDecision = createUnknownChildPolicyDecision(input.request);
  const integrityDecision = createUnknownChildIntegrityDecision();
  return ForensicsResultSchema.parse({
    abilityGroupId: "forensics-persistence",
    childCapabilityId: "finalize-failed-record",
    status: "failed",
    recordType: "failed_record",
    recordRef: {
      recordType: "failed_record",
      recordId: `failed_record:unknown-child:${input.request.childCapabilityId}`,
      storageRef: null,
    },
    storageRef: null,
    artifactRefs: input.request.artifactRefs ?? [],
    output: null,
    failureReason: { code: "unknown_child", message: `Unknown Forensics child capability: ${input.request.childCapabilityId}`, detail: null },
    reviewRequiredReason: null,
    runtimeProof: buildUnknownChildRuntimeProof({ request: input.request, startedAt, endedAt, policyDecision, integrityDecision }),
    integrityDecision,
    policyDecision,
  });
}