import type { ForensicsArtifactStoragePort } from "../ports/forensics-artifact-storage-port.js";
import type { ForensicsClockPort } from "../ports/forensics-clock-port.js";
import type { ForensicsStoragePort } from "../ports/forensics-storage-port.js";
import { createSystemForensicsClockPort } from "../shared/forensics-clock.js";
import type { ForensicsExecutionContext } from "../shared/forensics-executor.js";

export type CreateForensicsExecutionContextInput = {
  recordStorage: ForensicsStoragePort;
  artifactStorage: ForensicsArtifactStoragePort;
  clock?: ForensicsClockPort;
};

export function createForensicsExecutionContext(input: CreateForensicsExecutionContextInput): ForensicsExecutionContext {
  return {
    recordStorage: input.recordStorage,
    artifactStorage: input.artifactStorage,
    clock: input.clock ?? createSystemForensicsClockPort(),
  };
}