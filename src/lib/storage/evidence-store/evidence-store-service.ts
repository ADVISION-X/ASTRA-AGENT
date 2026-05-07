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

function createEvidenceStoreService(dataDir: string, structuredLogBus?: StructuredLogBus) {
  const internals = createEvidenceStoreInternals(dataDir, structuredLogBus);
  const recordsContext = createEvidenceStoreRecordsContext(internals);
  const maintenanceContext = createEvidenceStoreMaintenanceContext(internals);
  const getHealth = async () => {
    try {
      await internals.init();
      const state = await internals.listState();
      await internals.stateStore.write(state);
      return { ok: true, detail: `local evidence store ready at ${internals.dataDir}; durable_write_probe=passed` };
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown evidence store health failure";
      return { ok: false, detail: `forensics_storage_write_failed: ${message}` };
    }
  };

  return {
    init: internals.init,
    getDataDir: () => internals.dataDir,
    getHealth,
    listState: internals.listState,
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
    setCandidateDisposition: setCandidateDispositionRecord.bind(null, maintenanceContext),
    deleteCandidate: deleteCandidateRecord.bind(null, maintenanceContext),
    getOperatorSnapshot: getOperatorSnapshotRecord.bind(null, maintenanceContext),
    exportCandidateSummaries: exportCandidateSummariesRecord.bind(null, maintenanceContext),
    resetLocalStore: resetLocalStoreRecord.bind(null, maintenanceContext),
    toEvidenceRef,
    toAiEvidenceRef,
    toActionEvidenceRef,
    toCandidateEvidenceRef,
    toEvidencePacketRef,
  };
}

type EvidenceStoreService = ReturnType<typeof createEvidenceStoreService>;

export {
  createEvidenceStoreService,
};

export type {
  EvidenceStoreService,
};
