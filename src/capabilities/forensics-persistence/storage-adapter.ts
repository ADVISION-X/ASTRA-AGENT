/**
 * storage-adapter.ts — Forensics → generic storage adapter.
 *
 * Maps ForensicsAppendRecordInput / ForensicsAppendArtifactInput
 * into the generic RecordEnvelope / ArtifactEnvelope understood by
 * GrassEyeStoragePort, then delegates to the storage layer.
 *
 * This file is the ONLY place that bridges the forensics capability
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

export function createForensicsStorageAdapter(
  storage: GrassEyeStoragePort,
): ForensicsStoragePort {
  return {
    async appendRecord(
      input: ForensicsAppendRecordInput,
    ): Promise<AppendRecordStorageResult> {
      const envelope: RecordEnvelope = {
        recordType: input.recordType,
        missionId: input.missionId,
        runId: input.runId,
        ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
        ...(input.roundId !== undefined ? { roundId: input.roundId } : {}),
        ...(input.stepId !== undefined ? { stepId: input.stepId } : {}),
        ...(input.capabilityCallId !== undefined ? { capabilityCallId: input.capabilityCallId } : {}),
        ...(input.sourceCapabilityId !== undefined ? { sourceAbilityGroupId: input.sourceCapabilityId } : {}),
        ...(input.sourceChildCapabilityId !== undefined ? { sourceChildCapabilityId: input.sourceChildCapabilityId } : {}),
        ...(input.parentRefs !== undefined ? { parentRefs: input.parentRefs } : {}),
        ...(input.artifactRefs !== undefined ? { artifactRefs: input.artifactRefs } : {}),
        payload: input.recordPayload,
        ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
        createdAt: input.createdAt ?? new Date().toISOString(),
      };
      return storage.appendRecord(envelope);
    },

    async appendArtifact(
      input: ForensicsAppendArtifactInput,
    ): Promise<AppendArtifactStorageResult> {
      const artifact: ArtifactEnvelope = {
        artifactType: input.artifactType,
        missionId: input.missionId,
        runId: input.runId,
        ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
        ...(input.roundId !== undefined ? { roundId: input.roundId } : {}),
        ...(input.capabilityCallId !== undefined ? { capabilityCallId: input.capabilityCallId } : {}),
        ...(input.mimeType !== undefined ? { mimeType: input.mimeType } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.bytesRef !== undefined ? { bytesRef: input.bytesRef } : {}),
        ...(input.sourceRef !== undefined ? { sourceRef: input.sourceRef } : {}),
        ...(input.parentRefs !== undefined ? { parentRefs: input.parentRefs } : {}),
        ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
        createdAt: new Date().toISOString(),
      };
      return storage.appendArtifact(artifact);
    },

    async readRecord(recordRef: string): Promise<Record<string, unknown> | null> {
      const result = await storage.readRecord(recordRef);
      return result as Record<string, unknown> | null;
    },
  };
}
