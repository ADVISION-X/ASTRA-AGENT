import { createSystemForensicsClockPort } from "./runtime/forensics-clock.js";
import { createForensicsPersistenceRegistry } from "./registry.js";
import type { ForensicsArtifactStoragePort } from "./ports/forensics-artifact-storage-port.js";
import type { ForensicsClockPort } from "./ports/forensics-clock-port.js";
import type { ForensicsStoragePort } from "./ports/forensics-storage-port.js";
import { ForensicsResultSchema } from "./schema.js";
import {
  type ForensicsAiResultRecordInput,
  type ForensicsBrowseLedgerInput,
  type ForensicsEvidencePacketInput,
  type ForensicsFailedRecordInput,
  type ForensicsImageEvidenceInput,
  type ForensicsOcrEvidenceInput,
  type ForensicsPersistenceAbilityGroup,
  type ForensicsPersistenceAbilityInput,
  type ForensicsRuntimeSnapshotInput,
  type ForensicsStructuredActionLogInput,
  type ForensicsStructuredRuntimeEventInput,
} from "./contract.js";

type CreateForensicsPersistenceAbilityGroupInput = {
  recordStorage: ForensicsStoragePort;
  artifactStorage: ForensicsArtifactStoragePort;
  clock?: ForensicsClockPort;
};

export function createForensicsPersistenceAbilityGroup(input: CreateForensicsPersistenceAbilityGroupInput): ForensicsPersistenceAbilityGroup {
  const registry = createForensicsPersistenceRegistry();
  const context = {
    recordStorage: input.recordStorage,
    artifactStorage: input.artifactStorage,
    clock: input.clock ?? createSystemForensicsClockPort(),
  };

  const execute = async (request: ForensicsPersistenceAbilityInput) => {
    const capability = registry.get(request.childCapabilityId);
    if (!capability) {
      const startedAt = context.clock.now();
      const endedAt = context.clock.now();
      return ForensicsResultSchema.parse({
        abilityGroupId: "forensics-persistence",
        childCapabilityId: "finalize-failed-record",
        status: "failed",
        recordType: "failed_record",
        recordRef: {
          recordType: "failed_record",
          recordId: `failed_record:unknown-child:${request.childCapabilityId}`,
          storageRef: null,
        },
        storageRef: null,
        artifactRefs: request.artifactRefs ?? [],
        output: null,
        failureReason: {
          code: "unknown_child",
          message: `Unknown Forensics child capability: ${request.childCapabilityId}`,
          detail: null,
        },
        reviewRequiredReason: null,
        runtimeProof: {
          proofId: `forensics-proof:unknown-child:${request.childCapabilityId}`,
          runId: `${request.sourceAbilityGroupId}:${request.sourceChildCapabilityId}:unknown-child`,
          missionId: request.sourceAbilityGroupId,
          sessionId: request.sessionId,
          roundId: request.roundId,
          videoVisitId: request.videoVisitId ?? null,
          abilityGroupId: "forensics-persistence",
          childCapabilityId: "finalize-failed-record",
          sourceAbilityGroupId: request.sourceAbilityGroupId,
          sourceChildCapabilityId: request.sourceChildCapabilityId,
          operationType: "unknown-child-dispatch",
          recordType: "failed_record",
          recordId: `failed_record:unknown-child:${request.childCapabilityId}`,
          idempotencyKey: `unknown-child:${request.childCapabilityId}`,
          startedAt,
          endedAt,
          durationMs: Math.max(0, new Date(endedAt).getTime() - new Date(startedAt).getTime()),
          status: "failed",
          storageOperation: "append-record",
          inputRecordRefs: [...(request.sourceRecordRefs ?? []), ...(request.parentRefs ?? [])],
          outputRecordRefs: [],
          artifactRefs: request.artifactRefs ?? [],
          storageRef: null,
          integrityHash: null,
          policyDecision: {
            childCapabilityId: "finalize-failed-record",
            recordType: "failed_record",
            schemaVersion: request.schemaVersion ?? "forensics.failed_record.v2",
            persistenceMode: "append",
            storageOperation: "append-record",
            idempotencyKey: `unknown-child:${request.childCapabilityId}`,
            allowPartialRefs: true,
            allowExternalArtifactRef: true,
            onArtifactWriteFailure: "review_required",
          },
          integrityDecision: {
            status: "failed",
            reason: "Unknown child capability cannot be dispatched.",
            requireSourceRecordRefs: false,
            requireParentRefs: false,
            requireArtifactRefs: false,
            requireStorageRef: false,
          },
          failureReason: {
            code: "unknown_child",
            message: `Unknown Forensics child capability: ${request.childCapabilityId}`,
            detail: null,
          },
          dataQualityFlags: request.dataQualityFlags ?? [],
        },
        integrityDecision: {
          status: "failed",
          reason: "Unknown child capability cannot be dispatched.",
          requireSourceRecordRefs: false,
          requireParentRefs: false,
          requireArtifactRefs: false,
          requireStorageRef: false,
        },
        policyDecision: {
          childCapabilityId: "finalize-failed-record",
          recordType: "failed_record",
          schemaVersion: request.schemaVersion ?? "forensics.failed_record.v2",
          persistenceMode: "append",
          storageOperation: "append-record",
          idempotencyKey: `unknown-child:${request.childCapabilityId}`,
          allowPartialRefs: true,
          allowExternalArtifactRef: true,
          onArtifactWriteFailure: "review_required",
        },
      });
    }

    return capability.execute(request, context);
  };

  return {
    listChildCapabilityIds() {
      return [...registry.keys()];
    },
    execute,
    writeStructuredRuntimeEvent(request: ForensicsStructuredRuntimeEventInput) {
      return execute(request);
    },
    writeStructuredActionLog(request: ForensicsStructuredActionLogInput) {
      return execute(request);
    },
    writeImageEvidence(request: ForensicsImageEvidenceInput) {
      return execute(request);
    },
    writeOcrEvidence(request: ForensicsOcrEvidenceInput) {
      return execute(request);
    },
    writeAiResultRecord(request: ForensicsAiResultRecordInput) {
      return execute(request);
    },
    finalizeBrowseLedger(request: ForensicsBrowseLedgerInput) {
      return execute(request);
    },
    finalizeEvidencePacket(request: ForensicsEvidencePacketInput) {
      return execute(request);
    },
    finalizeFailedRecord(request: ForensicsFailedRecordInput) {
      return execute(request);
    },
    updateRuntimeSnapshot(request: ForensicsRuntimeSnapshotInput) {
      return execute(request);
    },
  };
}
