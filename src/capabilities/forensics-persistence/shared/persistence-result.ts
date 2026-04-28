import { createId } from "../../../lib/local-runtime/ids.js";

import { FORENSICS_PERSISTENCE_ABILITY_GROUP_ID, type ForensicsPersistenceChildCapabilityId } from "../contract.js";
import type { ForensicsFailureReason } from "./failure.js";
import type { ForensicsArtifactRef } from "./artifact-ref.js";
import type { StoredForensicsRecord } from "../storage-ports.js";
import type { ForensicsRecordType } from "./record-envelope.js";
import type { ForensicsRecordRef } from "./record-ref.js";
import type { ForensicsRuntimeProof } from "./runtime-proof.js";

export type ForensicsPersistenceStatus = "success" | "failed" | "review_required";

export type ForensicsPersistenceAbilityResult = {
  status: ForensicsPersistenceStatus;
  abilityGroupId: typeof FORENSICS_PERSISTENCE_ABILITY_GROUP_ID;
  childCapabilityId: ForensicsPersistenceChildCapabilityId;
  recordType: ForensicsRecordType;
  recordRef: ForensicsRecordRef;
  storageRef: string | null;
  parentRefs: ForensicsRecordRef[];
  artifactRefs: ForensicsArtifactRef[];
  failureReason: ForensicsFailureReason | null;
  debugLogRef: string | null;
  runtimeProof: ForensicsRuntimeProof;
  dataQualityFlags: string[];
};

export function buildForensicsRuntimeProof(input: {
  childCapabilityId: ForensicsPersistenceChildCapabilityId;
  sourceAbilityGroupId: string;
  sourceRecordRefs: ForensicsRecordRef[];
  outputRecordRefs: ForensicsRecordRef[];
  artifactRefs: ForensicsArtifactRef[];
  integrityStatus: "passed" | "partial" | "failed";
  debugLogRef: string | null;
}): ForensicsRuntimeProof {
  return {
    proofId: createId("forensics_proof"),
    emittedAt: new Date().toISOString(),
    sourceAbilityGroupId: input.sourceAbilityGroupId,
    sourceChildCapabilityId: input.childCapabilityId,
    inputRecordRefs: input.sourceRecordRefs,
    outputRecordRefs: input.outputRecordRefs,
    artifactRefs: input.artifactRefs,
    integrityStatus: input.integrityStatus,
    debugLogRef: input.debugLogRef,
  };
}

export function buildForensicsSuccessResult(input: {
  childCapabilityId: ForensicsPersistenceChildCapabilityId;
  recordType: ForensicsRecordType;
  storedRecord: StoredForensicsRecord;
  parentRefs: ForensicsRecordRef[];
  sourceRecordRefs: ForensicsRecordRef[];
  artifactRefs: ForensicsArtifactRef[];
  debugLogRef: string | null;
  integrityStatus: "passed" | "partial";
  failureReason: ForensicsFailureReason | null;
  dataQualityFlags: string[];
  sourceAbilityGroupId: string;
}): ForensicsPersistenceAbilityResult {
  const runtimeProof = buildForensicsRuntimeProof({
    childCapabilityId: input.childCapabilityId,
    sourceAbilityGroupId: input.sourceAbilityGroupId,
    sourceRecordRefs: input.sourceRecordRefs,
    outputRecordRefs: [input.storedRecord.recordRef],
    artifactRefs: input.artifactRefs,
    integrityStatus: input.integrityStatus,
    debugLogRef: input.debugLogRef,
  });

  return {
    status: input.integrityStatus === "partial" ? "review_required" : "success",
    abilityGroupId: FORENSICS_PERSISTENCE_ABILITY_GROUP_ID,
    childCapabilityId: input.childCapabilityId,
    recordType: input.recordType,
    recordRef: input.storedRecord.recordRef,
    storageRef: input.storedRecord.storageRef,
    parentRefs: input.parentRefs,
    artifactRefs: input.artifactRefs,
    failureReason: input.failureReason,
    debugLogRef: input.debugLogRef,
    runtimeProof,
    dataQualityFlags: input.dataQualityFlags,
  };
}

export function buildForensicsFailureResult(input: {
  childCapabilityId: ForensicsPersistenceChildCapabilityId;
  recordType: ForensicsRecordType;
  recordRef: ForensicsRecordRef;
  parentRefs: ForensicsRecordRef[];
  sourceRecordRefs: ForensicsRecordRef[];
  artifactRefs: ForensicsArtifactRef[];
  debugLogRef: string | null;
  failureReason: ForensicsFailureReason;
  dataQualityFlags: string[];
  sourceAbilityGroupId: string;
}): ForensicsPersistenceAbilityResult {
  const runtimeProof = buildForensicsRuntimeProof({
    childCapabilityId: input.childCapabilityId,
    sourceAbilityGroupId: input.sourceAbilityGroupId,
    sourceRecordRefs: input.sourceRecordRefs,
    outputRecordRefs: [input.recordRef],
    artifactRefs: input.artifactRefs,
    integrityStatus: "failed",
    debugLogRef: input.debugLogRef,
  });

  return {
    status: "failed",
    abilityGroupId: FORENSICS_PERSISTENCE_ABILITY_GROUP_ID,
    childCapabilityId: input.childCapabilityId,
    recordType: input.recordType,
    recordRef: input.recordRef,
    storageRef: input.recordRef.storageRef,
    parentRefs: input.parentRefs,
    artifactRefs: input.artifactRefs,
    failureReason: input.failureReason,
    debugLogRef: input.debugLogRef,
    runtimeProof,
    dataQualityFlags: input.dataQualityFlags,
  };
}