import type { ForensicsAppendRecordInput, ForensicsAppendArtifactInput } from "./schema.js";

export interface AppendRecordStorageResult {
  readonly recordRef: string;
  readonly storageRef: string;
  readonly integrityHash: string;
}

export interface AppendArtifactStorageResult {
  readonly artifactRef: string;
  readonly storageRef: string;
  readonly integrityHash: string;
  readonly sizeBytes: number;
}

export interface ForensicsStoragePort {
  appendRecord(input: ForensicsAppendRecordInput): Promise<AppendRecordStorageResult>;
  appendArtifact(input: ForensicsAppendArtifactInput): Promise<AppendArtifactStorageResult>;
  readRecord(recordRef: string): Promise<Record<string, unknown> | null>;
}
