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
import type { ForensicsExecutionContext } from "./shared/forensics-executor.js";

type ForensicsPersistenceAbilityGroupId = typeof FORENSICS_PERSISTENCE_ABILITY_GROUP_ID;
type ForensicsPersistenceAbilityInput = ForensicsAbilityInputRequest;
type ForensicsPersistenceRequest = ForensicsAbilityInputRequest;
type ForensicsPersistenceAbilityResult = ForensicsResult;
type ForensicsPersistenceChildCapabilityId = ForensicsChildCapabilityId;

type ForensicsStructuredRuntimeEventInput = WriteStructuredRuntimeEventInput;
type ForensicsStructuredActionLogInput = WriteStructuredActionLogInput;
type ForensicsImageEvidenceInput = WriteEvidenceRecordInput;
type ForensicsOcrEvidenceInput = WriteEvidenceRecordInput;
type ForensicsAiResultRecordInput = WriteAiResultRecordInput;
type ForensicsBrowseLedgerInput = FinalizeBrowseLedgerInput;
type ForensicsEvidencePacketInput = FinalizeEvidencePacketInput;
type ForensicsFailedRecordInput = FinalizeFailedRecordInput;
type ForensicsRuntimeSnapshotInput = UpdateRuntimeSnapshotInput;

interface ForensicsPersistenceChildCapability {
  readonly abilityGroupId: ForensicsPersistenceAbilityGroupId;
  readonly childCapabilityId: ForensicsPersistenceChildCapabilityId;
  readonly recordType: ForensicsRecordType;
  execute(input: unknown, context: ForensicsExecutionContext): Promise<ForensicsPersistenceAbilityResult>;
}

interface ForensicsPersistenceAbilityGroup {
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

export { FORENSICS_PERSISTENCE_ABILITY_GROUP_ID };

export type {
  ForensicsPersistenceAbilityGroupId,
  ForensicsPersistenceAbilityInput,
  ForensicsPersistenceRequest,
  ForensicsPersistenceAbilityResult,
  ForensicsPersistenceChildCapabilityId,
  ForensicsStructuredRuntimeEventInput,
  ForensicsStructuredActionLogInput,
  ForensicsImageEvidenceInput,
  ForensicsOcrEvidenceInput,
  ForensicsAiResultRecordInput,
  ForensicsBrowseLedgerInput,
  ForensicsEvidencePacketInput,
  ForensicsFailedRecordInput,
  ForensicsRuntimeSnapshotInput,
  ForensicsPersistenceChildCapability,
  ForensicsPersistenceAbilityGroup,
};
