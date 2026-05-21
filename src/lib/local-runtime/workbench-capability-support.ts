import { createForensicsPersistenceAbilityGroup } from "../../capabilities/forensics-persistence/index.js";
import { createForensicsStorageAdapter } from "../../capabilities/forensics-persistence/storage-adapter.js";
import { createGrassEyeFileStorage } from "../storage/index.js";
import type { RuntimeLogger } from "../runtime-logs/index.js";

export function createWorkbenchEvidenceStore(
  dataDir: string,
  runtimeLogger: RuntimeLogger,
) {
  const genericStorage = createGrassEyeFileStorage(dataDir);
  const evidenceStoragePort = createForensicsStorageAdapter(genericStorage);
  return createForensicsPersistenceAbilityGroup(evidenceStoragePort, runtimeLogger);
}
