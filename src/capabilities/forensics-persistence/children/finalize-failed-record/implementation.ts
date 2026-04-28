import { createForensicsRecordId } from "../../record-id.js";
import { FORENSICS_PERSISTENCE_ABILITY_GROUP_ID, type ForensicsPersistenceChildCapability, type ForensicsPersistenceRequest } from "../../contract.js";
import { createForensicsFailureReason } from "../../shared/failure.js";
import { resolveForensicsIntegrityPolicy, validateForensicsIntegrity } from "../../shared/integrity-policy.js";
import { buildForensicsSuccessResult, buildForensicsFailureResult } from "../../shared/persistence-result.js";
import { createForensicsIntegrityHash } from "../../shared/record-envelope.js";

export const finalizeFailedRecordCapability: ForensicsPersistenceChildCapability = {
  abilityGroupId: FORENSICS_PERSISTENCE_ABILITY_GROUP_ID,
  childCapabilityId: "finalize-failed-record",
  recordType: "failed_record",
  async execute(input: ForensicsPersistenceRequest, context) {
    if (input.childCapabilityId !== "finalize-failed-record") {
      throw new Error(`finalize-failed-record received unsupported child capability ${input.childCapabilityId}`);
    }

    const policy = resolveForensicsIntegrityPolicy({ recordType: input.recordType, persistencePolicy: input.persistencePolicy, integrityPolicy: input.integrityPolicy });
    const integrity = validateForensicsIntegrity({ sourceRecordRefsCount: input.sourceRecordRefs.length, parentRefsCount: input.parentRefs.length, artifactRefsCount: input.artifactRefs.length, hasArtifactStorageRefGap: input.artifactRefs.some((artifact) => !artifact.storageRef), policy, allowPartialRefs: input.persistencePolicy.allowPartialRefs });
    const recordRef = { recordType: input.recordType, recordId: createForensicsRecordId({ recordType: input.recordType, existingRecordId: input.existingRecordId }), storageRef: null };
    if (integrity.integrityStatus === "failed" && integrity.failureReason) {
      return buildForensicsFailureResult({ childCapabilityId: this.childCapabilityId, recordType: input.recordType, recordRef, parentRefs: input.parentRefs, sourceRecordRefs: input.sourceRecordRefs, artifactRefs: input.artifactRefs, debugLogRef: input.debugLogRef ?? null, failureReason: integrity.failureReason, dataQualityFlags: input.dataQualityFlags, sourceAbilityGroupId: input.sourceAbilityGroupId });
    }

    try {
      const envelope = {
        recordId: recordRef.recordId,
        recordType: input.recordType,
        sessionId: input.sessionId,
        roundId: input.roundId,
        videoVisitId: input.videoVisitId,
        sourceAbilityGroupId: input.sourceAbilityGroupId,
        createdAt: new Date().toISOString(),
        payload: input.payload,
        sourceRecordRefs: input.sourceRecordRefs,
        parentRefs: input.parentRefs,
        artifactRefs: input.artifactRefs,
        schemaVersion: input.schemaVersion ?? "forensics-record.v1",
        integrityHash: createForensicsIntegrityHash({ recordType: input.recordType, sessionId: input.sessionId, roundId: input.roundId, videoVisitId: input.videoVisitId, payload: input.payload, parentRefs: input.parentRefs, artifactRefs: input.artifactRefs }),
        dataQualityFlags: input.dataQualityFlags,
      };
      const storedRecord = await context.storage.writeRecord(envelope);
      const successIntegrityStatus = integrity.integrityStatus === "failed" ? "partial" : integrity.integrityStatus;
      return buildForensicsSuccessResult({ childCapabilityId: this.childCapabilityId, recordType: input.recordType, storedRecord, parentRefs: input.parentRefs, sourceRecordRefs: input.sourceRecordRefs, artifactRefs: storedRecord.artifactRefs, debugLogRef: input.debugLogRef ?? null, integrityStatus: successIntegrityStatus, failureReason: integrity.failureReason, dataQualityFlags: input.dataQualityFlags, sourceAbilityGroupId: input.sourceAbilityGroupId });
    } catch (error) {
      return buildForensicsFailureResult({ childCapabilityId: this.childCapabilityId, recordType: input.recordType, recordRef, parentRefs: input.parentRefs, sourceRecordRefs: input.sourceRecordRefs, artifactRefs: input.artifactRefs, debugLogRef: input.debugLogRef ?? null, failureReason: createForensicsFailureReason({ code: "storage_write_failed", message: error instanceof Error ? error.message : "unknown storage failure" }), dataQualityFlags: input.dataQualityFlags, sourceAbilityGroupId: input.sourceAbilityGroupId });
    }
  },
};