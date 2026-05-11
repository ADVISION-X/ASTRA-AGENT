/**
 * file-storage.ts — Local NDJSON file-based implementation of GrassEyeStoragePort.
 *
 * Storage layout:
 *   <dataDir>/forensics/records-<runId>.ndjson  — append-only record log per run
 *   <dataDir>/forensics/artifacts.ndjson         — append-only artifact index
 *
 * This implementation is append-only. There are NO update, delete, overwrite,
 * or replace operations. It does NOT import from any capability group.
 */

import { existsSync, mkdirSync } from "node:fs";
import { appendFile } from "node:fs/promises";
import { join } from "node:path";

import { stableJsonHash } from "./hash.js";
import { createArtifactRef, createRecordRef } from "./refs.js";
import type { ArtifactEnvelope, RecordEnvelope } from "./schema.js";
import type { AppendArtifactResult, AppendRecordResult, GrassEyeStoragePort } from "./storage-port.js";

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function safeRunSegment(runId: string | undefined): string {
  return (runId ?? "default").replace(/[^a-z0-9]/gi, "_").slice(0, 64);
}

export function createGrassEyeFileStorage(dataDir: string): GrassEyeStoragePort {
  const storageDir = join(dataDir, "forensics");

  return {
    async appendRecord(record: RecordEnvelope): Promise<AppendRecordResult> {
      ensureDir(storageDir);
      const recordRef = createRecordRef();
      const stored = { ...record, recordRef };
      const integrityHash = stableJsonHash(stored);
      const line = JSON.stringify({ ...stored, integrityHash }) + "\n";
      const file = join(storageDir, `records-${safeRunSegment(record.runId)}.ndjson`);
      await appendFile(file, line, "utf8");
      return {
        recordRef,
        storageRef: `forensics://records/${recordRef}`,
        integrityHash,
      };
    },

    async appendArtifact(artifact: ArtifactEnvelope): Promise<AppendArtifactResult> {
      ensureDir(storageDir);
      const artifactRef = createArtifactRef();
      // Exclude binary content from the NDJSON index line to keep it scannable.
      const { content: _content, ...meta } = artifact;
      const stored = { ...meta, artifactRef };
      const integrityHash = stableJsonHash(stored);
      const line = JSON.stringify({ ...stored, integrityHash }) + "\n";
      const logFile = join(storageDir, "artifacts.ndjson");
      await appendFile(logFile, line, "utf8");
      return {
        artifactRef,
        storageRef: `forensics://artifacts/${artifactRef}`,
        integrityHash,
        sizeBytes: 0,
      };
    },

    async readRecord(_recordRef: string): Promise<RecordEnvelope | null> {
      // Phase-1: linear scan not on critical execution path; returns null.
      // Callers that need record lookup should use the artifact/mission ref chain.
      return null;
    },
  };
}
