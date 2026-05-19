/**
 * storage-adapter.ts — Forensics → generic storage adapter.
 *
 * Maps ForensicsAppendRecordInput / ForensicsAppendArtifactInput
 * into the generic RecordEnvelope / ArtifactEnvelope understood by
 * GrassEyeStoragePort, then delegates to the storage layer.
 *
 * This file is the ONLY place that connects the forensics capability
 * and the generic storage layer. It lives here (inside the capability)
 * so it may import from both forensics schema and storage types.
 */

import type { ArtifactEnvelope, GrassEyeStoragePort, RecordEnvelope } from "../../lib/storage/index.js";
import type { ForensicsAppendArtifactInput, ForensicsAppendRecordInput } from "./schema.js";
import type {
  AppendArtifactStorageResult,
  AppendRecordStorageResult,
  ForensicsStoragePort,
} from "./storage-port.js";

const assignOptional = <T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: T[K] | undefined,
): void => {
  if (value === undefined) return;
  target[key] = value;
};

const buildRecordEnvelope = (
  input: ForensicsAppendRecordInput,
): RecordEnvelope => {
  const envelope: RecordEnvelope = {
    recordType: input.recordType,
    missionId: input.missionId,
    runId: input.runId,
    payload: input.recordPayload,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };

  assignOptional(envelope, "sessionId", input.sessionId);
  assignOptional(envelope, "roundId", input.roundId);
  assignOptional(envelope, "stepId", input.stepId);
  assignOptional(envelope, "capabilityCallId", input.capabilityCallId);
  assignOptional(envelope, "sourceAbilityGroupId", input.sourceCapabilityId);
  assignOptional(envelope, "sourceChildCapabilityId", input.sourceChildCapabilityId);
  assignOptional(envelope, "parentRefs", input.parentRefs);
  assignOptional(envelope, "artifactRefs", input.artifactRefs);
  assignOptional(envelope, "idempotencyKey", input.idempotencyKey);

  return envelope;
};

const buildArtifactEnvelope = (
  input: ForensicsAppendArtifactInput,
): ArtifactEnvelope => {
  const artifact: ArtifactEnvelope = {
    artifactType: input.artifactType,
    missionId: input.missionId,
    runId: input.runId,
    createdAt: new Date().toISOString(),
  };

  assignOptional(artifact, "sessionId", input.sessionId);
  assignOptional(artifact, "roundId", input.roundId);
  assignOptional(artifact, "capabilityCallId", input.capabilityCallId);
  assignOptional(artifact, "mimeType", input.mimeType);
  assignOptional(artifact, "content", input.content);
  assignOptional(artifact, "bytesRef", input.bytesRef);
  assignOptional(artifact, "sourceRef", input.sourceRef);
  assignOptional(artifact, "parentRefs", input.parentRefs);
  assignOptional(artifact, "idempotencyKey", input.idempotencyKey);

  return artifact;
};

const appendRecord = (
  storage: GrassEyeStoragePort,
  input: ForensicsAppendRecordInput,
): Promise<AppendRecordStorageResult> =>
  storage.appendRecord(buildRecordEnvelope(input));

const appendArtifact = (
  storage: GrassEyeStoragePort,
  input: ForensicsAppendArtifactInput,
): Promise<AppendArtifactStorageResult> =>
  storage.appendArtifact(buildArtifactEnvelope(input));

const readRecord = async (
  storage: GrassEyeStoragePort,
  recordRef: string,
): Promise<Record<string, unknown> | null> => {
  const result = await storage.readRecord(recordRef);
  return result as Record<string, unknown> | null;
};

export function createForensicsStorageAdapter(
  storage: GrassEyeStoragePort,
): ForensicsStoragePort {
  return {
    appendRecord: (input) => appendRecord(storage, input),
    appendArtifact: (input) => appendArtifact(storage, input),
    readRecord: (recordRef) => readRecord(storage, recordRef),
  };
}
