import {
  createForensicsPersistenceAbilityGroupFromStorage,
} from "../../capabilities/forensics-persistence/index.js";
import type { RuntimeLogger } from "../runtime-logs/index.js";
import { createGrassEyeFileStorage } from "../storage/index.js";

export function createWorkbenchEvidenceStore(
  dataDir: string,
  runtimeLogger: RuntimeLogger,
) {
  const genericStorage = createGrassEyeFileStorage(dataDir);
  return createForensicsPersistenceAbilityGroupFromStorage(genericStorage, runtimeLogger);
}