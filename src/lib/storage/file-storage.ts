import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { lstat, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { stableJsonHash } from "./hash.js";
import { createArtifactRef } from "./refs.js";
import type { ArtifactEnvelope } from "./schema.js";
import type { AppendArtifactResult, GrassEyeStoragePort } from "./storage-port.js";

type StoredArtifact = Omit<ArtifactEnvelope, "content"> & Readonly<{
  artifactRef: string;
  contentHash: string;
  sizeBytes: number;
  idempotencyFingerprint: string;
  integrityHash: string;
}>;
const ensureDir = (path: string): void => { if (!existsSync(path)) mkdirSync(path, { recursive: true }); };
const hashBytes = (bytes: Uint8Array): string =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const contentBytes = (content: ArtifactEnvelope["content"]): Uint8Array => {
  if (content === undefined) throw new Error("FORENSICS_ARTIFACT_BYTES_MISSING");
  return typeof content === "string" ? Buffer.from(content, "utf8") : content;
};
const readIndex = async (storageDir: string): Promise<StoredArtifact[]> => {
  const path = join(storageDir, "artifacts.ndjson");
  if (!existsSync(path)) return [];
  return (await readFile(path, "utf8")).split("\n").filter(Boolean)
    .map((line) => JSON.parse(line) as StoredArtifact);
};
const replaceIndex = async (storageDir: string, entries: readonly StoredArtifact[]): Promise<void> => {
  const indexPath = join(storageDir, "artifacts.ndjson");
  const temporaryPath = `${indexPath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, entries.map((entry) => JSON.stringify(entry)).join("\n")
      + (entries.length > 0 ? "\n" : ""), { flag: "wx", mode: 0o600 });
    await rename(temporaryPath, indexPath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
};
const assertIntegrity = (stored: StoredArtifact): void => {
  const { integrityHash, ...body } = stored;
  if (stableJsonHash(body) !== integrityHash) throw new Error("FORENSICS_INTEGRITY_HASH_MISMATCH");
};
const appendArtifact = async (storageDir: string, artifact: ArtifactEnvelope): Promise<AppendArtifactResult> => {
  if (!artifact.idempotencyKey) throw new Error("FORENSICS_IDEMPOTENCY_KEY_REQUIRED");
  ensureDir(storageDir);
  const bytes = contentBytes(artifact.content);
  const identity = `artifact\0${artifact.missionId ?? ""}\0${artifact.runId ?? ""}\0${artifact.idempotencyKey}`;
  const artifactRef = createArtifactRef(identity);
  const artifactDir = join(storageDir, "artifacts");
  const artifactPath = join(artifactDir, `${artifactRef}.bin`);
  const { createdAt: _createdAt, content: _content, ...stable } = artifact;
  const idempotencyFingerprint = stableJsonHash({ ...stable, contentHash: hashBytes(bytes) });
  const index = await readIndex(storageDir);
  const existing = index.find((item) => item.artifactRef === artifactRef);
  if (existing) {
    assertIntegrity(existing);
    const persisted = await readFile(artifactPath).catch(() => null);
    if (existing.idempotencyFingerprint !== idempotencyFingerprint
      || persisted && (hashBytes(persisted) !== existing.contentHash
        || persisted.byteLength !== existing.sizeBytes)) {
      throw new Error("FORENSICS_IDEMPOTENCY_CONFLICT");
    }
    if (!persisted) {
      ensureDir(artifactDir);
      await writeFile(artifactPath, bytes, { flag: "wx", mode: 0o600 });
    }
    return { artifactRef, storageRef: `forensics://artifacts/${artifactRef}`, integrityHash: existing.integrityHash };
  }
  ensureDir(artifactDir);
  const stored = { ...stable, createdAt: artifact.createdAt, artifactRef, contentHash: hashBytes(bytes),
    sizeBytes: bytes.byteLength, idempotencyFingerprint };
  const integrityHash = stableJsonHash(stored);
  await replaceIndex(storageDir, [...index, { ...stored, integrityHash }]);
  const orphanedBytes = await readFile(artifactPath).catch(() => null);
  if (orphanedBytes) {
    if (hashBytes(orphanedBytes) !== hashBytes(bytes) || orphanedBytes.byteLength !== bytes.byteLength) {
      throw new Error("FORENSICS_IDEMPOTENCY_CONFLICT");
    }
  } else {
    await writeFile(artifactPath, bytes, { flag: "wx", mode: 0o600 });
  }
  return { artifactRef, storageRef: `forensics://artifacts/${artifactRef}`, integrityHash };
};

const deleteArtifactsForMission = async (storageDir: string, missionId: string): Promise<void> => {
  if (!missionId || /[\0]/u.test(missionId)) throw new Error("FORENSICS_MISSION_ID_INVALID");
  const stored = await readIndex(storageDir);
  const artifactDir = join(storageDir, "artifacts");
  if (existsSync(artifactDir)) {
    const directory = await lstat(artifactDir);
    if (!directory.isDirectory() || directory.isSymbolicLink()) {
      throw new Error("FORENSICS_ARTIFACT_STRUCTURE_INVALID");
    }
    const indexed = new Set(stored.map((artifact) => `${artifact.artifactRef}.bin`));
    for (const entry of await readdir(artifactDir, { withFileTypes: true })) {
      if (!entry.isFile() || !/^art-[a-f0-9]{64}\.bin$/u.test(entry.name)) {
        throw new Error("FORENSICS_ARTIFACT_STRUCTURE_INVALID");
      }
      if (indexed.has(entry.name)) continue;
      const orphanPath = join(artifactDir, entry.name);
      await rm(orphanPath);
      if (existsSync(orphanPath)) throw new Error("FORENSICS_PURGE_READBACK_FAILED");
    }
  }
  const owned = stored.filter((artifact) => artifact.missionId === missionId);
  if (owned.length === 0) return;
  for (const artifact of owned) {
    assertIntegrity(artifact);
    const path = join(storageDir, "artifacts", `${artifact.artifactRef}.bin`);
    await rm(path, { force: true });
    if (existsSync(path)) throw new Error("FORENSICS_PURGE_READBACK_FAILED");
  }
  const retained = stored.filter((artifact) => artifact.missionId !== missionId);
  await replaceIndex(storageDir, retained);
  const remaining = await readIndex(storageDir);
  if (remaining.some((artifact) => artifact.missionId === missionId)) {
    throw new Error("FORENSICS_PURGE_READBACK_FAILED");
  }
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
    appendArtifact: (artifact) => serialize(() => appendArtifact(storageDir, artifact)),
    deleteArtifactsForMission: (missionId) => serialize(() => deleteArtifactsForMission(storageDir, missionId)),
    readArtifact: (artifactRef) => serialize(async () => {
      const stored = (await readIndex(storageDir)).find((item) => item.artifactRef === artifactRef);
      if (!stored) return null;
      assertIntegrity(stored);
      const bytes = await readFile(join(storageDir, "artifacts", `${artifactRef}.bin`));
      if (hashBytes(bytes) !== stored.contentHash || bytes.byteLength !== stored.sizeBytes) {
        throw new Error("FORENSICS_ARTIFACT_READBACK_MISMATCH");
      }
      return { content: bytes, ...(stored.mimeType ? { mimeType: stored.mimeType } : {}),
        integrityHash: stored.integrityHash };
    }),
  };
}
