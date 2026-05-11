/**
 * Storage-layer forensics schema types.
 * Defined locally — does NOT import from the forensics-persistence capability.
 * The storage layer owns its own internal schema definitions.
 */
import { z } from "zod";

const _plain = z.record(z.string(), z.unknown());

// Legacy payload schemas used by the existing evidence-store record persisters.
// These remain here as internal storage-layer schema — forensics capability
// no longer exports them.
const ForensicsStructuredRuntimeEventPayloadSchema = z.object({
  structuredRuntimeEvent: _plain,
  roundLifecycleEvent: _plain.optional(),
});

const ForensicsStructuredActionLogPayloadSchema = z.object({
  actionLog: _plain.optional(),
  structuredActionLog: _plain,
});

const ForensicsEvidenceRecordPayloadSchema = z.object({
  imageEvidenceInput: _plain.optional(),
  ocrTextResult: _plain.optional(),
}).catchall(z.unknown());

const ForensicsProductLeadRecordPayloadSchema = z.object({
  productLeadRecord: _plain.optional(),
}).catchall(z.unknown());

const ForensicsAiResultRecordPayloadSchema = z.object({
  aiResult: _plain.optional(),
}).catchall(z.unknown());

const ForensicsBrowseLedgerPayloadSchema = z.object({
  browseLedgerEntry: _plain.optional(),
  roundStructuralLog: _plain.optional(),
}).catchall(z.unknown());

const ForensicsEvidencePacketPayloadSchema = z.object({
  evidencePacket: _plain.optional(),
  roundStructuralLog: _plain.optional(),
}).catchall(z.unknown());

const ForensicsFailedRecordPayloadSchema = z.object({
  evidencePacket: _plain.nullable().optional(),
  browseLedgerEntry: _plain.nullable().optional(),
  roundStructuralLog: _plain.optional(),
}).catchall(z.unknown());

const ForensicsRuntimeSnapshotPayloadSchema = z.object({
  snapshotEvent: _plain,
  snapshotSummary: _plain.optional(),
}).catchall(z.unknown());

const ForensicsArtifactRefSchema = z.object({
  artifactType: z.string(),
  artifactId: z.string().min(1),
  storageRef: z.string().min(1).nullable().default(null),
  sourceRecordRef: z.unknown().nullable().default(null),
  artifactLifecycleManifestRef: z.string().min(1).nullable().default(null),
  retentionClass: z.string().nullable().default(null),
  promotionStatus: z.string().default("not_promoted"),
  artifactHash: z.string().min(1).nullable().default(null),
  byteSize: z.number().int().nonnegative().nullable().default(null),
  promotedByRecordRef: z.unknown().nullable().default(null),
  pinnedByRecordRefs: z.array(z.unknown()).default([]),
  legalHoldReason: z.string().min(1).nullable().default(null),
  cleanupLedgerRef: z.string().min(1).nullable().default(null),
  refCount: z.number().int().nonnegative().default(0),
  cleanupEligible: z.boolean().default(false),
});

type ForensicsArtifactRef = z.infer<typeof ForensicsArtifactRefSchema>;

// Internal record envelope used by legacy storage files.
type ForensicsRecordEnvelope = {
  missionId?: string | null;
  runId: string;
  sessionId?: string | null;
  roundId?: string | null;
  stepId?: string | null;
  capabilityCallId?: string | null;
  recordType: string;
  payload: Record<string, unknown>;
  artifactRefs?: string[];
  parentRefs?: string[];
  idempotencyKey: string;
};

type ForensicsRecordQuery = {
  missionId?: string | null;
  runId?: string | null;
  recordType?: string | null;
};

type ForensicsRecordRef = {
  recordType: string;
  recordId: string;
  storageRef: string | null;
};

type StoredForensicsRecord = {
  recordId: string;
  recordType: string;
  storageRef: string;
  storedAt?: string;
};

export {
  ForensicsAiResultRecordPayloadSchema,
  ForensicsArtifactRefSchema,
  ForensicsBrowseLedgerPayloadSchema,
  ForensicsEvidencePacketPayloadSchema,
  ForensicsEvidenceRecordPayloadSchema,
  ForensicsFailedRecordPayloadSchema,
  ForensicsProductLeadRecordPayloadSchema,
  ForensicsRuntimeSnapshotPayloadSchema,
  ForensicsStructuredActionLogPayloadSchema,
  ForensicsStructuredRuntimeEventPayloadSchema,
};

export type {
  ForensicsArtifactRef,
  ForensicsRecordEnvelope,
  ForensicsRecordQuery,
  ForensicsRecordRef,
  StoredForensicsRecord,
};