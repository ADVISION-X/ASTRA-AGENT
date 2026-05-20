/**
 * index.ts — Public API of the GrassEye storage layer.
 *
 * Only generic types and the file-storage factory are exported.
 * No business models (ProductRecord, Candidate, Discovery, Ledger, etc.).
 */

export type { RecordEnvelope, ArtifactEnvelope, RecordType, ArtifactType } from "./schema.js";
export type { GrassEyeStoragePort, AppendRecordResult, AppendArtifactResult } from "./storage-port.js";
export { createGrassEyeFileStorage } from "./file-storage.js";
export { stableJsonHash } from "./hash.js";
export { createRecordRef, createArtifactRef } from "./refs.js";
