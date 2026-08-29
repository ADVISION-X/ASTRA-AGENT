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

import { createHash } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { appendFile, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { stableJsonHash } from "./hash.js";
import { createArtifactRef, createIdempotentRecordRef } from "./refs.js";
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

type StoredRecord = RecordEnvelope & Readonly<{
  recordRef: string;
  idempotencyFingerprint: string;
  integrityHash: string;
}>;

type StoredArtifact = Omit<ArtifactEnvelope, "content"> & Readonly<{
  artifactRef: string;
  contentHash: string | null;
  sizeBytes: number;
  idempotencyFingerprint: string;
  integrityHash: string;
}>;

const contentBytes = (content: ArtifactEnvelope["content"]): Uint8Array | null => {
  if (content === undefined) return null;
  return typeof content === "string" ? Buffer.from(content, "utf8") : content;
};

const hashBytes = (bytes: Uint8Array): string =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

const idempotencyIdentity = (kind: "record" | "artifact", value: {
  missionId?: string;
  runId?: string;
  idempotencyKey?: string;
}): string => {
  if (!value.idempotencyKey) throw new Error("FORENSICS_IDEMPOTENCY_KEY_REQUIRED");
  return `${kind}\0${value.missionId ?? ""}\0${value.runId ?? ""}\0${value.idempotencyKey}`;
};

const recordFingerprint = (record: RecordEnvelope): string => {
  const { createdAt: _createdAt, ...stable } = record;
  return stableJsonHash(stable);
};

const artifactFingerprint = (artifact: ArtifactEnvelope, bytes: Uint8Array | null): string => {
  const { createdAt: _createdAt, content: _content, ...stable } = artifact;
  return stableJsonHash({ ...stable, contentHash: bytes ? hashBytes(bytes) : null });
};

const parseLines = <T>(raw: string): T[] => raw.split("\n")
  .filter((line) => line.length > 0)
  .map((line) => JSON.parse(line) as T);

const readRecordLines = async (storageDir: string): Promise<StoredRecord[]> => {
  if (!existsSync(storageDir)) return [];
  const files = (await readdir(storageDir)).filter((name) => /^records-.+\.ndjson$/u.test(name)).sort();
  const records: StoredRecord[] = [];
  for (const file of files) records.push(...parseLines<StoredRecord>(await readFile(join(storageDir, file), "utf8")));
  return records;
};

const readArtifactLines = async (storageDir: string): Promise<StoredArtifact[]> => {
  const file = join(storageDir, "artifacts.ndjson");
  if (!existsSync(file)) return [];
  return parseLines<StoredArtifact>(await readFile(file, "utf8"));
};

const assertStoredIntegrity = (stored: StoredRecord | StoredArtifact): void => {
  const { integrityHash, ...content } = stored;
  if (stableJsonHash(content) !== integrityHash) throw new Error("FORENSICS_INTEGRITY_HASH_MISMATCH");
};

const createAppendRecord = (storageDir: string) =>
  async (record: RecordEnvelope): Promise<AppendRecordResult> => {
    ensureDir(storageDir);
    idempotencyIdentity("record", record);
    const recordRef = createIdempotentRecordRef({
      ...(record.missionId ? { missionId: record.missionId } : {}),
      ...(record.runId ? { runId: record.runId } : {}),
      idempotencyKey: record.idempotencyKey!,
    });
    const idempotencyFingerprint = recordFingerprint(record);
    const existing = (await readRecordLines(storageDir)).find((item) => item.recordRef === recordRef);
    if (existing) {
      assertStoredIntegrity(existing);
      if (existing.idempotencyFingerprint !== idempotencyFingerprint) {
        throw new Error("FORENSICS_IDEMPOTENCY_CONFLICT");
      }
      return { recordRef, storageRef: `forensics://records/${recordRef}`, integrityHash: existing.integrityHash };
    }
    const stored = { ...record, recordRef, idempotencyFingerprint };
    const integrityHash = stableJsonHash(stored);
    const line = JSON.stringify({ ...stored, integrityHash }) + "\n";
    const file = join(storageDir, `records-${safeRunSegment(record.runId)}.ndjson`);
    await appendFile(file, line, "utf8");
    return {
      recordRef,
      storageRef: `forensics://records/${recordRef}`,
      integrityHash,
    };
  };

const createAppendArtifact = (storageDir: string) =>
  async (artifact: ArtifactEnvelope): Promise<AppendArtifactResult> => {
    ensureDir(storageDir);
    const bytes = contentBytes(artifact.content);
    const identity = idempotencyIdentity("artifact", artifact);
    const artifactRef = createArtifactRef(identity);
    const artifactDir = join(storageDir, "artifacts");
    const artifactPath = join(artifactDir, `${artifactRef}.bin`);
    const idempotencyFingerprint = artifactFingerprint(artifact, bytes);
    const existing = (await readArtifactLines(storageDir)).find((item) => item.artifactRef === artifactRef);
    if (existing) {
      assertStoredIntegrity(existing);
      if (existing.idempotencyFingerprint !== idempotencyFingerprint) {
        throw new Error("FORENSICS_IDEMPOTENCY_CONFLICT");
      }
      if (existing.contentHash) {
        const persisted = await readFile(artifactPath).catch(() => null);
        if (!persisted || hashBytes(persisted) !== existing.contentHash
          || persisted.byteLength !== existing.sizeBytes) {
          throw new Error("FORENSICS_ARTIFACT_READBACK_MISMATCH");
        }
      }
      return {
        artifactRef,
        storageRef: `forensics://artifacts/${artifactRef}`,
        integrityHash: existing.integrityHash,
        sizeBytes: existing.sizeBytes,
      };
    }
    const { content: _content, ...meta } = artifact;
    const contentHash = bytes ? hashBytes(bytes) : null;
    const stored = { ...meta, artifactRef, contentHash, sizeBytes: bytes?.byteLength ?? 0, idempotencyFingerprint };
    const integrityHash = stableJsonHash(stored);
    const line = JSON.stringify({ ...stored, integrityHash }) + "\n";
    if (bytes) {
      ensureDir(artifactDir);
      const existingBytes = await readFile(artifactPath).catch(() => null);
      if (existingBytes) {
        if (hashBytes(existingBytes) !== contentHash || existingBytes.byteLength !== bytes.byteLength) {
          throw new Error("FORENSICS_IDEMPOTENCY_CONFLICT");
        }
      } else {
        await writeFile(artifactPath, bytes, { flag: "wx", mode: 0o600 });
      }
    }
    const logFile = join(storageDir, "artifacts.ndjson");
    await appendFile(logFile, line, "utf8");
    return {
      artifactRef,
      storageRef: `forensics://artifacts/${artifactRef}`,
      integrityHash,
      sizeBytes: bytes?.byteLength ?? 0,
    };
  };

export function createGrassEyeFileStorage(dataDir: string): GrassEyeStoragePort {
  const storageDir = join(dataDir, "forensics");
  let serialized = Promise.resolve();
  const serialize = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = serialized.then(operation, operation);
    serialized = result.then(() => undefined, () => undefined);
    return result;
  };

  return {
    appendRecord: (record) => serialize(() => createAppendRecord(storageDir)(record)),
    appendArtifact: (artifact) => serialize(() => createAppendArtifact(storageDir)(artifact)),
    readRecord: (recordRef) => serialize(async (): Promise<RecordEnvelope | null> => {
      const stored = (await readRecordLines(storageDir)).find((item) => item.recordRef === recordRef);
      if (!stored) return null;
      assertStoredIntegrity(stored);
      const { recordRef: _recordRef, idempotencyFingerprint: _fingerprint,
        integrityHash: _integrityHash, ...record } = stored;
      return record;
    }),
    readArtifact: (artifactRef) => serialize(async () => {
      const stored = (await readArtifactLines(storageDir)).find((item) => item.artifactRef === artifactRef);
      if (!stored) return null;
      assertStoredIntegrity(stored);
      if (!stored.contentHash) throw new Error("FORENSICS_ARTIFACT_BYTES_MISSING");
      const bytes = await readFile(join(storageDir, "artifacts", `${artifactRef}.bin`));
      if (hashBytes(bytes) !== stored.contentHash || bytes.byteLength !== stored.sizeBytes) {
        throw new Error("FORENSICS_ARTIFACT_READBACK_MISMATCH");
      }
      return {
        content: bytes,
        ...(stored.mimeType ? { mimeType: stored.mimeType } : {}),
        integrityHash: stored.integrityHash,
      };
    }),
  };
}
