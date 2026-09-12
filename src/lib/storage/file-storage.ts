import { createHash } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { appendFile, readFile, rm, writeFile } from "node:fs/promises";
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
  const existing = (await readIndex(storageDir)).find((item) => item.artifactRef === artifactRef);
  if (existing) {
    assertIntegrity(existing);
    const persisted = await readFile(artifactPath).catch(() => null);
    if (existing.idempotencyFingerprint !== idempotencyFingerprint || !persisted
      || hashBytes(persisted) !== existing.contentHash || persisted.byteLength !== existing.sizeBytes) {
      throw new Error("FORENSICS_IDEMPOTENCY_CONFLICT");
    }
    return { artifactRef, storageRef: `forensics://artifacts/${artifactRef}`, integrityHash: existing.integrityHash };
  }
  ensureDir(artifactDir);
  const orphanedBytes = await readFile(artifactPath).catch(() => null);
  if (orphanedBytes) {
    if (hashBytes(orphanedBytes) !== hashBytes(bytes) || orphanedBytes.byteLength !== bytes.byteLength) {
      throw new Error("FORENSICS_IDEMPOTENCY_CONFLICT");
    }
  } else {
    await writeFile(artifactPath, bytes, { flag: "wx", mode: 0o600 });
  }
  const stored = { ...stable, createdAt: artifact.createdAt, artifactRef, contentHash: hashBytes(bytes),
    sizeBytes: bytes.byteLength, idempotencyFingerprint };
  const integrityHash = stableJsonHash(stored);
  await appendFile(join(storageDir, "artifacts.ndjson"), `${JSON.stringify({ ...stored, integrityHash })}\n`, "utf8");
  return { artifactRef, storageRef: `forensics://artifacts/${artifactRef}`, integrityHash };
};

const deleteArtifactsForMission = async (storageDir: string, missionId: string): Promise<void> => {
  if (!missionId || /[\0]/u.test(missionId)) throw new Error("FORENSICS_MISSION_ID_INVALID");
  const stored = await readIndex(storageDir);
  const owned = stored.filter((artifact) => artifact.missionId === missionId);
  if (owned.length === 0) return;
  for (const artifact of owned) {
    assertIntegrity(artifact);
    await rm(join(storageDir, "artifacts", `${artifact.artifactRef}.bin`), { force: true });
  }
  const retained = stored.filter((artifact) => artifact.missionId !== missionId);
  const indexPath = join(storageDir, "artifacts.ndjson");
  if (retained.length === 0) {
    await rm(indexPath, { force: true });
  } else {
    await writeFile(indexPath, `${retained.map((artifact) => JSON.stringify(artifact)).join("\n")}\n`, "utf8");
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
