import type { ForensicsArtifactStoragePort as ExternalForensicsArtifactStoragePort } from "../../../capabilities/forensics-persistence/ports/forensics-artifact-storage-port.js";
import type { ForensicsStoragePort as ExternalForensicsStoragePort } from "../../../capabilities/forensics-persistence/ports/forensics-storage-port.js";

type ForensicsArtifactStoragePort = ExternalForensicsArtifactStoragePort;
type ForensicsStoragePort = ExternalForensicsStoragePort;

export type {
  ForensicsArtifactStoragePort,
  ForensicsStoragePort,
};