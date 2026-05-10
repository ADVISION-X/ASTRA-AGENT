import type { WorkbenchRuntime } from "./workbench-contract.js";

export type WorkbenchForensicsRuntimeEventInput = Parameters<WorkbenchRuntime["forensicsPersistenceAbilityGroup"]["writeStructuredRuntimeEvent"]>[0];
export type WorkbenchForensicsImageEvidenceInput = Parameters<WorkbenchRuntime["forensicsPersistenceAbilityGroup"]["writeImageEvidence"]>[0];
export type WorkbenchForensicsProductLeadRecordInput = Parameters<WorkbenchRuntime["forensicsPersistenceAbilityGroup"]["writeProductLeadRecord"]>[0];
export type WorkbenchForensicsEvidencePacketInput = Parameters<WorkbenchRuntime["forensicsPersistenceAbilityGroup"]["finalizeEvidencePacket"]>[0];
export type WorkbenchForensicsBrowseLedgerInput = Parameters<WorkbenchRuntime["forensicsPersistenceAbilityGroup"]["finalizeBrowseLedger"]>[0];

export type WorkbenchForensicsEnvelope = {
  commandId: string;
  commandName: string;
  mapId: string | null;
  missionId: string;
  payloadRef: string[];
  roundId: string | null;
  runId: string;
  selectedMapId: string | null;
  sessionId: string;
  stepId: string;
  videoVisitId: string | null;
};