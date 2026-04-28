import { createHash } from "node:crypto";

import type { ForensicsArtifactRef } from "./artifact-ref.js";
import type { ForensicsRecordRef } from "./record-ref.js";

export type ForensicsRecordType =
  | "structured_runtime_event"
  | "structured_action_log"
  | "evidence_record"
  | "ai_result_record"
  | "browse_ledger_entry"
  | "evidence_packet"
  | "failed_record"
  | "runtime_snapshot";

export type ForensicsRecordEnvelopePayload = Record<string, unknown>;

export type ForensicsRecordEnvelope = {
  recordId: string;
  recordType: ForensicsRecordType;
  sessionId: string;
  roundId: string;
  videoVisitId: string | null;
  sourceAbilityGroupId: string;
  createdAt: string;
  payload: ForensicsRecordEnvelopePayload;
  sourceRecordRefs: ForensicsRecordRef[];
  parentRefs: ForensicsRecordRef[];
  artifactRefs: ForensicsArtifactRef[];
  schemaVersion: string;
  integrityHash: string;
  dataQualityFlags: string[];
};

export function createForensicsIntegrityHash(input: {
  recordType: ForensicsRecordType;
  sessionId: string;
  roundId: string;
  videoVisitId: string | null;
  payload: ForensicsRecordEnvelopePayload;
  parentRefs: ForensicsRecordRef[];
  artifactRefs: ForensicsArtifactRef[];
}): string {
  const serialized = JSON.stringify(input);
  return createHash("sha256").update(serialized).digest("hex");
}