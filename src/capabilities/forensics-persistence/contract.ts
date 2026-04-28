import type { ForensicsArtifactRef } from "./shared/artifact-ref.js";
import type { ForensicsIntegrityPolicy } from "./shared/integrity-policy.js";
import type { ForensicsPersistencePolicy } from "./shared/persistence-policy.js";
import type { ForensicsPersistenceAbilityResult } from "./shared/persistence-result.js";
import type { ForensicsRecordEnvelopePayload, ForensicsRecordType } from "./shared/record-envelope.js";
import type { ForensicsRecordRef } from "./shared/record-ref.js";

export const FORENSICS_PERSISTENCE_ABILITY_GROUP_ID = "forensics-persistence";

export type ForensicsPersistenceAbilityGroupId = typeof FORENSICS_PERSISTENCE_ABILITY_GROUP_ID;
export type ForensicsPersistenceChildCapabilityId =
  | "write-structured-runtime-event"
  | "write-structured-action-log"
  | "write-evidence-record"
  | "write-ai-result-record"
  | "finalize-browse-ledger"
  | "finalize-evidence-packet"
  | "finalize-failed-record"
  | "update-runtime-snapshot";

export type ForensicsAbilityInputBase = {
  abilityGroupId: ForensicsPersistenceAbilityGroupId;
  requestedBy: string;
  sourceAbilityGroupId: string;
  sessionId: string;
  roundId: string;
  videoVisitId: string | null;
  sourceRecordRefs: ForensicsRecordRef[];
  parentRefs: ForensicsRecordRef[];
  artifactRefs: ForensicsArtifactRef[];
  persistencePolicy: ForensicsPersistencePolicy;
  integrityPolicy?: Partial<ForensicsIntegrityPolicy>;
  dataQualityFlags: string[];
  payload: ForensicsRecordEnvelopePayload;
  existingRecordId?: string;
  schemaVersion?: string;
  debugLogRef?: string | null;
};

export type ForensicsStructuredRuntimeEventInput = ForensicsAbilityInputBase & {
  childCapabilityId: "write-structured-runtime-event";
  recordType: "structured_runtime_event";
};

export type ForensicsStructuredActionLogInput = ForensicsAbilityInputBase & {
  childCapabilityId: "write-structured-action-log";
  recordType: "structured_action_log";
};

export type ForensicsImageEvidenceInput = ForensicsAbilityInputBase & {
  childCapabilityId: "write-evidence-record";
  recordType: "evidence_record";
};

export type ForensicsOcrEvidenceInput = ForensicsAbilityInputBase & {
  childCapabilityId: "write-evidence-record";
  recordType: "evidence_record";
};

export type ForensicsAiResultRecordInput = ForensicsAbilityInputBase & {
  childCapabilityId: "write-ai-result-record";
  recordType: "ai_result_record";
};

export type ForensicsBrowseLedgerInput = ForensicsAbilityInputBase & {
  childCapabilityId: "finalize-browse-ledger";
  recordType: "browse_ledger_entry";
};

export type ForensicsEvidencePacketInput = ForensicsAbilityInputBase & {
  childCapabilityId: "finalize-evidence-packet";
  recordType: "evidence_packet";
};

export type ForensicsFailedRecordInput = ForensicsAbilityInputBase & {
  childCapabilityId: "finalize-failed-record";
  recordType: "failed_record";
};

export type ForensicsRuntimeSnapshotInput = ForensicsAbilityInputBase & {
  childCapabilityId: "update-runtime-snapshot";
  recordType: "runtime_snapshot";
};

export type ForensicsPersistenceAbilityInput =
  | ForensicsStructuredRuntimeEventInput
  | ForensicsStructuredActionLogInput
  | ForensicsImageEvidenceInput
  | ForensicsOcrEvidenceInput
  | ForensicsAiResultRecordInput
  | ForensicsBrowseLedgerInput
  | ForensicsEvidencePacketInput
  | ForensicsFailedRecordInput
  | ForensicsRuntimeSnapshotInput;

export type ForensicsPersistenceRequest = ForensicsPersistenceAbilityInput;

export type ForensicsPersistenceContext = {
  storage: import("./storage-ports.js").ForensicsStoragePort;
};

export interface ForensicsPersistenceChildCapability {
  readonly abilityGroupId: ForensicsPersistenceAbilityGroupId;
  readonly childCapabilityId: ForensicsPersistenceChildCapabilityId;
  readonly recordType: ForensicsRecordType;
  execute(input: ForensicsPersistenceAbilityInput, context: ForensicsPersistenceContext): Promise<ForensicsPersistenceAbilityResult>;
}

export interface ForensicsPersistenceAbilityGroup {
  listChildCapabilityIds(): ForensicsPersistenceChildCapabilityId[];
  execute(input: ForensicsPersistenceAbilityInput): Promise<ForensicsPersistenceAbilityResult>;
  writeStructuredRuntimeEvent(input: ForensicsStructuredRuntimeEventInput): Promise<ForensicsPersistenceAbilityResult>;
  writeStructuredActionLog(input: ForensicsStructuredActionLogInput): Promise<ForensicsPersistenceAbilityResult>;
  writeImageEvidence(input: ForensicsImageEvidenceInput): Promise<ForensicsPersistenceAbilityResult>;
  writeOcrEvidence(input: ForensicsOcrEvidenceInput): Promise<ForensicsPersistenceAbilityResult>;
  writeAiResultRecord(input: ForensicsAiResultRecordInput): Promise<ForensicsPersistenceAbilityResult>;
  finalizeBrowseLedger(input: ForensicsBrowseLedgerInput): Promise<ForensicsPersistenceAbilityResult>;
  finalizeEvidencePacket(input: ForensicsEvidencePacketInput): Promise<ForensicsPersistenceAbilityResult>;
  finalizeFailedRecord(input: ForensicsFailedRecordInput): Promise<ForensicsPersistenceAbilityResult>;
  updateRuntimeSnapshot(input: ForensicsRuntimeSnapshotInput): Promise<ForensicsPersistenceAbilityResult>;
}