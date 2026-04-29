import type {
  ForensicsAbilityInputRequest,
  FinalizeBrowseLedgerInput,
  FinalizeEvidencePacketInput,
  FinalizeFailedRecordInput,
  ForensicsChildCapabilityId,
  ForensicsRecordType,
  ForensicsResult,
  UpdateRuntimeSnapshotInput,
  WriteAiResultRecordInput,
  WriteEvidenceRecordInput,
  WriteStructuredActionLogInput,
  WriteStructuredRuntimeEventInput,
} from "./schema.js";
import { FORENSICS_PERSISTENCE_ABILITY_GROUP_ID } from "./schema.js";
import type { ForensicsExecutionContext } from "./runtime/forensics-executor.js";

export { FORENSICS_PERSISTENCE_ABILITY_GROUP_ID };

export type ForensicsPersistenceAbilityGroupId = typeof FORENSICS_PERSISTENCE_ABILITY_GROUP_ID;
export type ForensicsPersistenceAbilityInput = ForensicsAbilityInputRequest;
export type ForensicsPersistenceRequest = ForensicsAbilityInputRequest;
export type ForensicsPersistenceAbilityResult = ForensicsResult;
export type ForensicsPersistenceChildCapabilityId = ForensicsChildCapabilityId;

export type ForensicsStructuredRuntimeEventInput = WriteStructuredRuntimeEventInput;
export type ForensicsStructuredActionLogInput = WriteStructuredActionLogInput;
export type ForensicsImageEvidenceInput = WriteEvidenceRecordInput;
export type ForensicsOcrEvidenceInput = WriteEvidenceRecordInput;
export type ForensicsAiResultRecordInput = WriteAiResultRecordInput;
export type ForensicsBrowseLedgerInput = FinalizeBrowseLedgerInput;
export type ForensicsEvidencePacketInput = FinalizeEvidencePacketInput;
export type ForensicsFailedRecordInput = FinalizeFailedRecordInput;
export type ForensicsRuntimeSnapshotInput = UpdateRuntimeSnapshotInput;

export interface ForensicsPersistenceChildCapability {
  readonly abilityGroupId: ForensicsPersistenceAbilityGroupId;
  readonly childCapabilityId: ForensicsPersistenceChildCapabilityId;
  readonly recordType: ForensicsRecordType;
  execute(input: unknown, context: ForensicsExecutionContext): Promise<ForensicsPersistenceAbilityResult>;
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
