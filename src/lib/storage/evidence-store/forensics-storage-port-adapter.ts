import { existsSync, mkdirSync } from "node:fs";
import { appendFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import type {
  AppendArtifactStorageResult,
  AppendRecordStorageResult,
  ForensicsStoragePort,
} from "../../../capabilities/forensics-persistence/storage-port.js";
import type {
  ForensicsAppendArtifactInput,
  ForensicsAppendRecordInput,
} from "../../../capabilities/forensics-persistence/schema.js";

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function buildIntegrityHash(payload: unknown): string {
  const json = JSON.stringify(payload) ?? "";
  // Simple length-based hash placeholder — not cryptographic.
  // A real implementation would use node:crypto createHash("sha256").
  return `sha256-len:${json.length}`;
}

export function createForensicsStoragePortAdapter(dataDir: string): ForensicsStoragePort {
  const forensicsDir = join(dataDir, "forensics");

  return {
    async appendRecord(input: ForensicsAppendRecordInput): Promise<AppendRecordStorageResult> {
      ensureDir(forensicsDir);
      const recordRef = randomUUID();
      const now = input.createdAt ?? new Date().toISOString();
      const record: Record<string, unknown> = {
        recordRef,
        missionId: input.missionId,
        runId: input.runId,
        sessionId: input.sessionId ?? null,
        roundId: input.roundId ?? null,
        stepId: input.stepId ?? null,
        capabilityCallId: input.capabilityCallId ?? null,
        sourceCapabilityId: input.sourceCapabilityId ?? null,
        sourceChildCapabilityId: input.sourceChildCapabilityId ?? null,
        recordType: input.recordType,
        recordPayload: input.recordPayload,
        artifactRefs: input.artifactRefs ?? [],
        parentRefs: input.parentRefs ?? [],
        idempotencyKey: input.idempotencyKey,
        createdAt: now,
      };
      const integrityHash = buildIntegrityHash(record);
      record["integrityHash"] = integrityHash;
      const safeRunId = input.runId.replace(/[^a-z0-9]/gi, "_").slice(0, 64);
      const file = join(forensicsDir, `records-${safeRunId}.ndjson`);
      await appendFile(file, JSON.stringify(record) + "\n", "utf8");
      return {
        recordRef,
        storageRef: `forensics://records/${recordRef}`,
        integrityHash,
      };
    },

    async appendArtifact(input: ForensicsAppendArtifactInput): Promise<AppendArtifactStorageResult> {
      ensureDir(forensicsDir);
      const artifactRef = randomUUID();
      const entry: Record<string, unknown> = {
        artifactRef,
        missionId: input.missionId,
        runId: input.runId,
        sessionId: input.sessionId ?? null,
        roundId: input.roundId ?? null,
        capabilityCallId: input.capabilityCallId ?? null,
        artifactType: input.artifactType,
        mimeType: input.mimeType ?? null,
        sourceRef: input.sourceRef ?? null,
        idempotencyKey: input.idempotencyKey,
        createdAt: new Date().toISOString(),
      };
      const logFile = join(forensicsDir, "artifacts.ndjson");
      await appendFile(logFile, JSON.stringify(entry) + "\n", "utf8");
      return {
        artifactRef,
        storageRef: `forensics://artifacts/${artifactRef}`,
        integrityHash: `sha256-ref:${artifactRef}`,
        sizeBytes: 0,
      };
    },

    async readRecord(_recordRef: string): Promise<Record<string, unknown> | null> {
      // Read-only lookup not implemented in current phase.
      return null;
    },
  };
}
