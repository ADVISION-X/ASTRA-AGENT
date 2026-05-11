import { createHash } from "node:crypto";

import type { ForensicsClockPort } from "../ports/forensics-clock-port.js";
import type {
  ForensicsAbilityInput,
  ForensicsFailure,
  ForensicsIntegrityDecision,
  ForensicsPolicyDecision,
  ForensicsRuntimeProof,
  StoredForensicsRecord,
} from "../schema.js";
import { FORENSICS_PERSISTENCE_ABILITY_GROUP_ID, ForensicsRuntimeProofSchema } from "../schema.js";
import { resolveForensicsPersistenceStatus } from "./forensics-status.js";

function buildProofId(seed: string): string {
  return `forensics-proof:${createHash("sha256").update(seed).digest("hex").slice(0, 16)}`;
}

function resolveProofChainValue(fieldName: string, value: string | null | undefined, status: "success" | "failed" | "review_required"): string {
  if (value) {
    return value;
  }
  if (status === "success") {
    throw new Error(`Forensics chain field ${fieldName} is required for successful proofs.`);
  }
  return `missing-${fieldName}`;
}

const buildProofChainFields = (request: ForensicsAbilityInput, status: "success" | "failed" | "review_required") => ({
  runId: resolveProofChainValue("runId", request.runId, status),
  missionId: resolveProofChainValue("missionId", request.missionId, status),
  sessionId: request.sessionId,
  roundId: request.roundId,
  videoVisitId: request.videoVisitId ?? null,
  stepId: resolveProofChainValue("stepId", request.stepId, status),
  bindingPackageId: resolveProofChainValue("bindingPackageId", request.bindingPackageId, status),
  bindingPackageVersion: resolveProofChainValue("bindingPackageVersion", request.bindingPackageVersion, status),
  selectedBindingId: resolveProofChainValue("selectedBindingId", request.selectedBindingId, status),
  bindingVersion: resolveProofChainValue("bindingVersion", request.bindingVersion, status),
  bindingSnapshotRef: resolveProofChainValue("bindingSnapshotRef", request.bindingSnapshotRef, status),
  capabilityCallId: resolveProofChainValue("capabilityCallId", request.capabilityCallId, status),
});

const buildProofReferenceFields = (input: {
  request: ForensicsAbilityInput;
  storedRecord: StoredForensicsRecord | null;
}) => ({
  inputRefs: input.request.inputRefs,
  outputRefs: input.request.outputRefs,
  inputRecordRefs: input.request.sourceRecordRefs,
  outputRecordRefs: input.storedRecord ? [input.storedRecord.recordRef] : [],
  parentRefs: input.request.parentRefs,
  artifactRefs: input.storedRecord?.artifactRefs ?? input.request.artifactRefs,
  storageRef: input.storedRecord?.storageRef ?? null,
  integrityHash: input.storedRecord?.envelope.integrityHash ?? null,
});

const buildForensicsProofPayload = (input: {
  request: ForensicsAbilityInput;
  policyDecision: ForensicsPolicyDecision;
  integrityDecision: ForensicsIntegrityDecision;
  storedRecord: StoredForensicsRecord | null;
  startedAt: string;
  endedAt: string;
  failureReason: ForensicsFailure | null;
  reviewRequiredReason: string | null;
  status: "success" | "failed" | "review_required";
  recordId: string;
  durationMs: number;
}) => ({
  proofId: buildProofId(`${input.recordId}:${input.endedAt}`),
  ...buildProofChainFields(input.request, input.status),
  abilityGroupId: FORENSICS_PERSISTENCE_ABILITY_GROUP_ID,
  childCapabilityId: input.request.childCapabilityId,
  sourceAbilityGroupId: input.request.sourceAbilityGroupId,
  sourceChildCapabilityId: input.request.sourceChildCapabilityId,
  operationType: input.request.childCapabilityId,
  recordType: input.request.recordType,
  recordId: input.recordId,
  idempotencyKey: input.policyDecision.idempotencyKey,
  startedAt: input.startedAt,
  endedAt: input.endedAt,
  durationMs: input.durationMs,
  status: input.status,
  storageOperation: input.policyDecision.storageOperation,
  ...buildProofReferenceFields(input),
  promptContractId: input.request.promptContractId ?? null,
  promptContractVersion: input.request.promptContractVersion ?? null,
  promptCatalogVersion: input.request.promptCatalogVersion ?? null,
  actionRef: input.request.actionRef ?? null,
  postActionVerificationRef: input.request.postActionVerificationRef ?? null,
  decisionRef: input.request.decisionRef ?? null,
  policyDecision: input.policyDecision,
  integrityDecision: input.integrityDecision,
  failureReason: input.failureReason,
  reviewRequiredReason: input.reviewRequiredReason,
  dataQualityFlags: input.request.dataQualityFlags,
});

export function buildForensicsProof(input: {
  request: ForensicsAbilityInput;
  policyDecision: ForensicsPolicyDecision;
  integrityDecision: ForensicsIntegrityDecision;
  storedRecord: StoredForensicsRecord | null;
  startedAt: string;
  endedAt: string;
  failureReason: ForensicsFailure | null;
  reviewRequiredReason: string | null;
  clock: ForensicsClockPort;
}): ForensicsRuntimeProof {
  const durationMs = Math.max(0, new Date(input.endedAt).getTime() - new Date(input.startedAt).getTime());
  const recordId = input.storedRecord?.recordRef.recordId ?? `${input.request.recordType}:${input.policyDecision.idempotencyKey}`;
  const status = resolveForensicsPersistenceStatus(input);

  return ForensicsRuntimeProofSchema.parse(buildForensicsProofPayload({
    ...input,
    status,
    recordId,
    durationMs,
  }));
}
