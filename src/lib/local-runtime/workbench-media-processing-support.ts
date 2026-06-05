import {
  createMediaProcessingAbilityGroupFromFilesystem,
} from "../../capabilities/media-processing/index.js";
import type { RuntimeLogger } from "../runtime-logs/index.js";

export function createWorkbenchMediaProcessing(
  dataDir: string,
  runtimeLogger?: RuntimeLogger,
) {
  return createMediaProcessingAbilityGroupFromFilesystem({
    dataDir,
    ...(runtimeLogger ? { runtimeLogger } : {}),
  });
}
