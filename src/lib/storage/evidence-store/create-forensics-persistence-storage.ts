import { createEvidenceStoreForensicsArtifactStoragePort, createEvidenceStoreForensicsRecordStoragePort } from "./forensics-storage-adapter.js";
import { EvidenceStoreService } from "./evidence-store-service.js";
import type { StructuredLogBus } from "../../local-runtime/structured-log-bus.js";

export function createForensicsPersistenceStorage(input: {
  dataDir: string;
  structuredLogBus: StructuredLogBus;
}) {
  const evidenceStore = new EvidenceStoreService(input.dataDir, input.structuredLogBus);
  return {
    evidenceStore,
    recordStorage: createEvidenceStoreForensicsRecordStoragePort(evidenceStore),
    artifactStorage: createEvidenceStoreForensicsArtifactStoragePort(),
  };
}