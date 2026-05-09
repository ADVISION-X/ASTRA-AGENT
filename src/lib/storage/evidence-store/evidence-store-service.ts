import {
  deleteCandidateRecord,
  exportCandidateSummariesRecord,
  getOperatorSnapshotRecord,
  resetLocalStoreRecord,
  setCandidateDispositionRecord,
} from "./evidence-store-maintenance.js";
import {
  saveBrowseLedgerEntryRecord,
  saveCandidateRecord,
  saveEvidencePacketRecord,
  saveRoundLifecycleEventRecord,
  saveRoundStructuralLogRecord,
  rebuildAdvancedAiExportSetRecord,
} from "./evidence-store-discovery-records.js";
import {
  listStructuredActionLogRecords,
  listStructuredRuntimeEventRecords,
  saveActionLogRecord,
  saveAiResultRecord,
  saveImageEvidenceRecord,
  saveOcrResultRecord,
  saveStructuredActionLogRecord,
  saveStructuredRuntimeEventRecord,
} from "./evidence-store-evidence-records.js";
import { toActionEvidenceRef, toAiEvidenceRef, toCandidateEvidenceRef, toEvidencePacketRef, toEvidenceRef } from "./evidence-store-refs.js";
import {
  createEvidenceStoreInternals,
  createEvidenceStoreMaintenanceContext,
  createEvidenceStoreRecordsContext,
} from "./evidence-store-service-context.js";
import { createTaskRunRecord, hasSeenVideoVisitRecord, saveAgentRoundRecord, updateTaskRunRecord } from "./evidence-store-task-records.js";
import type { EvidenceStoreStructuredLogBus as StructuredLogBus } from "./evidence-store-runtime-types.js";

const resolveEvidenceStoreHealthDetail = async (internals: ReturnType<typeof createEvidenceStoreInternals>) => {
  await internals.init();
  const state = await internals.listState();
  await internals.stateStore.write(state);
  return { ok: true, detail: `local evidence store ready at ${internals.dataDir}; durable_write_probe=passed` };
};

const buildEvidenceStoreHealth = (internals: ReturnType<typeof createEvidenceStoreInternals>) => () =>
  resolveEvidenceStoreHealthDetail(internals).catch((error) => {
    const message = error instanceof Error ? error.message : "unknown evidence store health failure";
    return { ok: false, detail: `forensics_storage_write_failed: ${message}` };
  });

const buildEvidenceStoreRecordMethods = (recordsContext: ReturnType<typeof createEvidenceStoreRecordsContext>) => ({
  createTaskRun: createTaskRunRecord.bind(null, recordsContext),
  updateTaskRunStatus: updateTaskRunRecord.bind(null, recordsContext),
  saveAgentRound: saveAgentRoundRecord.bind(null, recordsContext),
  hasSeenVideoVisit: hasSeenVideoVisitRecord.bind(null, recordsContext),
  saveImageEvidence: saveImageEvidenceRecord.bind(null, recordsContext),
  saveOcrResult: saveOcrResultRecord.bind(null, recordsContext),
  saveAiResult: saveAiResultRecord.bind(null, recordsContext),
  saveActionLog: saveActionLogRecord.bind(null, recordsContext),
  saveStructuredRuntimeEvent: saveStructuredRuntimeEventRecord.bind(null, recordsContext),
  saveStructuredActionLog: saveStructuredActionLogRecord.bind(null, recordsContext),
  listStructuredRuntimeEvents: listStructuredRuntimeEventRecords.bind(null, recordsContext),
  listStructuredActionLogs: listStructuredActionLogRecords.bind(null, recordsContext),
  saveCandidate: saveCandidateRecord.bind(null, recordsContext),
  saveEvidencePacket: saveEvidencePacketRecord.bind(null, recordsContext),
  saveBrowseLedgerEntry: saveBrowseLedgerEntryRecord.bind(null, recordsContext),
  saveRoundLifecycleEvent: saveRoundLifecycleEventRecord.bind(null, recordsContext),
  saveRoundStructuralLog: saveRoundStructuralLogRecord.bind(null, recordsContext),
  rebuildAdvancedAiExportSet: rebuildAdvancedAiExportSetRecord.bind(null, recordsContext),
});

const buildEvidenceStoreMaintenanceMethods = (maintenanceContext: ReturnType<typeof createEvidenceStoreMaintenanceContext>) => ({
  setCandidateDisposition: setCandidateDispositionRecord.bind(null, maintenanceContext),
  deleteCandidate: deleteCandidateRecord.bind(null, maintenanceContext),
  getOperatorSnapshot: getOperatorSnapshotRecord.bind(null, maintenanceContext),
  exportCandidateSummaries: exportCandidateSummariesRecord.bind(null, maintenanceContext),
  resetLocalStore: resetLocalStoreRecord.bind(null, maintenanceContext),
});

const buildEvidenceStoreReferenceMethods = () => ({
  toEvidenceRef,
  toAiEvidenceRef,
  toActionEvidenceRef,
  toCandidateEvidenceRef,
  toEvidencePacketRef,
});

function createEvidenceStoreService(dataDir: string, structuredLogBus?: StructuredLogBus) {
  const internals = createEvidenceStoreInternals(dataDir, structuredLogBus);
  const recordsContext = createEvidenceStoreRecordsContext(internals);
  const maintenanceContext = createEvidenceStoreMaintenanceContext(internals);

  return {
    init: internals.init,
    getDataDir: () => internals.dataDir,
    getHealth: buildEvidenceStoreHealth(internals),
    listState: internals.listState,
    ...buildEvidenceStoreRecordMethods(recordsContext),
    ...buildEvidenceStoreMaintenanceMethods(maintenanceContext),
    ...buildEvidenceStoreReferenceMethods(),
  };
}

type EvidenceStoreService = ReturnType<typeof createEvidenceStoreService>;

export {
  createEvidenceStoreService,
};

export type {
  EvidenceStoreService,
};
