import { createForensicsPersistenceAbilityGroup } from "../../capabilities/forensics-persistence/ability-group.js";
import { createForensicsPersistenceStorage } from "../storage/evidence-store/create-forensics-persistence-storage.js";
import type { StructuredLogBus } from "./structured-log-bus.js";

export const createPersistenceRuntime = (
  dataDir: string,
  structuredLogBus: StructuredLogBus,
) => {
  const storage = createForensicsPersistenceStorage({ dataDir, structuredLogBus });
  const boundaryEventEmitter = {
    emitRuntimeEvent: async (entry: Parameters<typeof storage.evidenceStore.saveStructuredRuntimeEvent>[0]) => {
      await storage.evidenceStore.saveStructuredRuntimeEvent(entry);
    },
  };

  return {
    evidenceStore: storage.evidenceStore,
    forensicsPersistenceAbilityGroup: createForensicsPersistenceAbilityGroup({
      recordStorage: storage.recordStorage,
      artifactStorage: storage.artifactStorage,
      structuredLogBus: boundaryEventEmitter,
    }),
  };
};