import { createForensicsPersistenceAbilityGroup } from "../../capabilities/forensics-persistence/ability-group.js";
import { createForensicsPersistenceStorage } from "../storage/evidence-store/create-forensics-persistence-storage.js";
import type { StructuredLogBus } from "./structured-log-bus.js";

export const createPersistenceRuntime = (
  dataDir: string,
  structuredLogBus: StructuredLogBus,
) => {
  const storage = createForensicsPersistenceStorage({ dataDir, structuredLogBus });
  return {
    evidenceStore: storage.evidenceStore,
    forensicsPersistenceAbilityGroup: createForensicsPersistenceAbilityGroup({
      recordStorage: storage.recordStorage,
      artifactStorage: storage.artifactStorage,
      structuredLogBus,
    }),
  };
};