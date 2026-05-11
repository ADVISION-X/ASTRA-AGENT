import { createEvidenceStoreService } from "./evidence-store-service.js";
import { assertForensicsDurabilityReady } from "./forensics-durability-mode.js";
import { createForensicsStoragePortAdapter } from "./forensics-storage-port-adapter.js";
import type { StructuredLogBus } from "../../local-runtime/structured-log-bus.js";

export function createForensicsPersistenceStorage(input: {
  dataDir: string;
  structuredLogBus: StructuredLogBus;
}) {
  assertForensicsDurabilityReady();
  const evidenceStore = createEvidenceStoreService(input.dataDir, input.structuredLogBus);
  const forensicsStorage = createForensicsStoragePortAdapter(input.dataDir);
  return {
    evidenceStore,
    forensicsStorage,
  };
}
