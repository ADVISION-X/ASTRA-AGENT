import { z } from "zod";

const FORENSICS_PERSISTENCE_ABILITY_GROUP_ID = "forensics-persistence" as const;

const ForensicsChildCapabilityIdSchema = z.enum([
  "append-record",
  "append-artifact",
  "read-record-ref",
  "read-artifact-ref",
]);

const ForensicsRecordTypeSchema = z.enum([
  "ai_result",
  "ability_result",
  "observation",
  "evidence",
  "visual_evidence",
  "failure",
  "mission_event",
]);

const ForensicsArtifactTypeSchema = z.enum([
  "screenshot",
  "coordinate_grid",
  "ai_raw_output",
  "ai_json_output",
  "runtime_log",
  "other",
]);

const ForensicsAppendRecordInputSchema = z.object({
  childCapabilityId: z.literal("append-record"),
  missionId: z.string().min(1),
  runId: z.string().min(1),
  sessionId: z.string().optional(),
  roundId: z.string().optional(),
  stepId: z.string().optional(),
  capabilityCallId: z.string().optional(),
  sourceCapabilityId: z.string().optional(),
  sourceChildCapabilityId: z.string().optional(),
  recordType: ForensicsRecordTypeSchema,
  recordPayload: z.record(z.string(), z.unknown()),
  artifactRefs: z.array(z.string()).optional(),
  parentRefs: z.array(z.string()).optional(),
  createdAt: z.string().optional(),
  idempotencyKey: z.string().min(1),
});

const ForensicsAppendArtifactInputSchema = z.object({
  childCapabilityId: z.literal("append-artifact"),
  missionId: z.string().min(1),
  runId: z.string().min(1),
  sessionId: z.string().optional(),
  roundId: z.string().optional(),
  capabilityCallId: z.string().optional(),
  artifactType: ForensicsArtifactTypeSchema,
  mimeType: z.string().optional(),
  bytesRef: z.string().optional(),
  content: z.union([z.string(), z.instanceof(Uint8Array)]).optional(),
  sourceRef: z.string().optional(),
  parentRefs: z.array(z.string()).optional(),
  idempotencyKey: z.string().min(1),
});

const ForensicsReadRecordRefInputSchema = z.object({
  childCapabilityId: z.literal("read-record-ref"),
  recordRef: z.string().min(1),
});

const ForensicsReadArtifactRefInputSchema = z.object({
  childCapabilityId: z.literal("read-artifact-ref"),
  artifactRef: z.string().min(1),
});

const ForensicsAbilityInputSchema = z.discriminatedUnion("childCapabilityId", [
  ForensicsAppendRecordInputSchema,
  ForensicsAppendArtifactInputSchema,
  ForensicsReadRecordRefInputSchema,
  ForensicsReadArtifactRefInputSchema,
]);

const ForensicsProofSchema = z.object({
  proofId: z.string().min(1),
  abilityGroupId: z.literal("forensics-persistence"),
  childCapabilityId: ForensicsChildCapabilityIdSchema,
  missionId: z.string().optional(),
  runId: z.string().optional(),
  sessionId: z.string().optional(),
  roundId: z.string().optional(),
  capabilityCallId: z.string().optional(),
  recordRef: z.string().optional(),
  artifactRef: z.string().optional(),
  storageRef: z.string().optional(),
  integrityHash: z.string().optional(),
  status: z.enum(["success", "failed"]),
  failureReason: z.string().optional(),
  startedAt: z.string(),
  endedAt: z.string(),
  durationMs: z.number(),
});

const ForensicsResultSchema = z.object({
  status: z.enum(["success", "failed", "invalid_input"]),
  proof: ForensicsProofSchema.optional(),
  recordRef: z.string().optional(),
  artifactRef: z.string().optional(),
  record: z.record(z.string(), z.unknown()).optional(),
  artifact: z.object({
    content: z.instanceof(Uint8Array),
    mimeType: z.string().optional(),
    integrityHash: z.string(),
  }).optional(),
  failureReason: z.string().optional(),
});

type ForensicsChildCapabilityId = z.infer<typeof ForensicsChildCapabilityIdSchema>;
type ForensicsProof = z.infer<typeof ForensicsProofSchema>;
type ForensicsAppendRecordInput = z.infer<typeof ForensicsAppendRecordInputSchema>;
type ForensicsAppendArtifactInput = z.infer<typeof ForensicsAppendArtifactInputSchema>;
type ForensicsReadRecordRefInput = z.infer<typeof ForensicsReadRecordRefInputSchema>;
type ForensicsReadArtifactRefInput = z.infer<typeof ForensicsReadArtifactRefInputSchema>;
type ForensicsAbilityInput = z.infer<typeof ForensicsAbilityInputSchema>;
type ForensicsResult = z.infer<typeof ForensicsResultSchema>;

export {
  FORENSICS_PERSISTENCE_ABILITY_GROUP_ID,
};

export type {
  ForensicsChildCapabilityId,
  ForensicsProof,
  ForensicsAppendRecordInput,
  ForensicsAppendArtifactInput,
  ForensicsReadRecordRefInput,
  ForensicsReadArtifactRefInput,
  ForensicsAbilityInput,
  ForensicsResult,
};
