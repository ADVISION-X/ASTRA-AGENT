/**
 * index.ts — Public API of the GrassEye storage layer.
 *
 * Only generic types and the file-storage factory are exported.
 * No business models (ProductRecord, Candidate, Discovery, Ledger, etc.).
 */

export type { RecordEnvelope, ArtifactEnvelope } from "./schema.js";
export type { GrassEyeStoragePort } from "./storage-port.js";
export { createGrassEyeFileStorage } from "./file-storage.js";
