/**
 * storage-port.ts — GrassEyeStoragePort: the single generic storage interface.
 *
 * Only one port is permitted. No ProductRecordStoragePort, CandidateStoragePort,
 * DiscoveryStoragePort, LedgerStoragePort, RuntimeStoragePort, etc.
 */

import type { ArtifactEnvelope, RecordEnvelope } from "./schema.js";

export type AppendRecordResult = {
  readonly recordRef: string;
  readonly storageRef: string;
  readonly integrityHash: string;
};

export type AppendArtifactResult = {
  readonly artifactRef: string;
  readonly storageRef: string;
  readonly integrityHash: string;
  readonly sizeBytes: number;
};

/**
 * GrassEyeStoragePort — append-only minimal storage interface.
 *
 * Responsibilities:
 *   - appendRecord: persist a RecordEnvelope, return recordRef + integrityHash.
 *   - appendArtifact: persist an ArtifactEnvelope, return artifactRef + integrityHash.
 *   - readRecord: retrieve a previously persisted record by recordRef.
 *
 * FORBIDDEN: update, delete, overwrite, replace, mutate any record.
 * FORBIDDEN: business truth reconstruction, mission flow, AI reasoning.
 */
export interface GrassEyeStoragePort {
  appendRecord(record: RecordEnvelope): Promise<AppendRecordResult>;
  appendArtifact(artifact: ArtifactEnvelope): Promise<AppendArtifactResult>;
  readRecord(recordRef: string): Promise<RecordEnvelope | null>;
}
