import { z } from "zod";

// ── Constants ─────────────────────────────────────────────────────────────────

export const VISUAL_TARGET_ABILITY_GROUP_ID = "visual-target" as const;

export const VISUAL_TARGET_CHILD_CAPABILITY_IDS = [
  "package-grid-cell-target-once",
  "package-grid-region-target-once",
  "package-bbox-target-once",
] as const;

// ── Primitives ────────────────────────────────────────────────────────────────

const nullableString = z.string().nullable().optional().default(null);
const finiteNumber = z.number().finite();
const positiveFiniteNumber = z.number().finite().positive();

// ── Grid / Bbox primitives ────────────────────────────────────────────────────

export const VisualTargetGridCellSchema = z.object({
  row: z.number().int().nonnegative(),
  col: z.number().int().nonnegative(),
  label: z.string().optional(),
});

export const VisualTargetGridRegionSchema = z.object({
  rowStart: z.number().int().nonnegative(),
  colStart: z.number().int().nonnegative(),
  rowEnd: z.number().int().nonnegative(),
  colEnd: z.number().int().nonnegative(),
  label: z.string().optional(),
});

export const VisualTargetBboxSchema = z.object({
  x: finiteNumber,
  y: finiteNumber,
  width: positiveFiniteNumber,
  height: positiveFiniteNumber,
});

// ── Child capability id ───────────────────────────────────────────────────────

export const VisualTargetChildCapabilityIdSchema = z.enum(
  VISUAL_TARGET_CHILD_CAPABILITY_IDS,
);

// ── Target package (non-executable) ──────────────────────────────────────────

export const VisualTargetPackageSchema = z.object({
  targetRef: z.string().min(1),
  sourceScreenshotEvidenceRef: z.string().nullable().default(null),
  gridSpecRef: z.string().nullable().default(null),
  gridCell: VisualTargetGridCellSchema.nullable().default(null),
  gridRegion: VisualTargetGridRegionSchema.nullable().default(null),
  bbox: VisualTargetBboxSchema.nullable().default(null),
  sourceCoordinateSpace: z.string().min(1).default("grid"),
  selectedBy: z.enum(["ai", "system"]),
  selectionReason: z.string().nullable().default(null),
  nonExecutable: z.literal(true),
  createdAt: z.string().min(1),
});

// ── Runtime proof ─────────────────────────────────────────────────────────────

export const VisualTargetRuntimeProofSchema = z.object({
  proofId: z.string().min(1),
  abilityGroupId: z.literal(VISUAL_TARGET_ABILITY_GROUP_ID),
  childCapabilityId: VisualTargetChildCapabilityIdSchema,
  missionId: nullableString,
  runId: nullableString,
  sessionId: z.string().min(1).optional().default("unknown"),
  roundId: nullableString,
  stepId: nullableString,
  capabilityCallId: nullableString,
  nerveBusEnvelopeId: nullableString,
  inputRef: nullableString,
  sourceRef: nullableString,
  sourceScreenshotEvidenceRef: nullableString,
  targetResultRef: z.string().nullable().default(null),
  candidateRef: z.string().nullable().default(null),
  status: z.enum(["success", "failed", "review_required"]),
  failureReason: z.string().nullable().default(null),
  reviewRequiredReason: z.string().nullable().default(null),
  startedAt: z.string().min(1),
  endedAt: z.string().min(1),
  durationMs: z.number().nonnegative(),
});

// ── Output ────────────────────────────────────────────────────────────────────

export const VisualTargetOutputSchema = z.object({
  childCapabilityId: VisualTargetChildCapabilityIdSchema,
  targetResultRef: z.string().min(1),
  candidateRef: z.string().min(1),
  targetPackage: VisualTargetPackageSchema,
  sourceScreenshotEvidenceRef: z.string().nullable().default(null),
});

// ── Base input (shared fields for all children) ───────────────────────────────

const VisualTargetBaseInputSchema = z.object({
  abilityGroupId: z.literal(VISUAL_TARGET_ABILITY_GROUP_ID),
  childCapabilityId: VisualTargetChildCapabilityIdSchema,
  missionId: nullableString,
  runId: nullableString,
  sessionId: z.string().min(1).optional().default("unknown"),
  roundId: nullableString,
  stepId: nullableString,
  capabilityCallId: nullableString,
  nerveBusEnvelopeId: nullableString,
  inputRef: nullableString,
  sourceRef: nullableString,
  sourceScreenshotEvidenceRef: z.string().min(1),
  gridSpecRef: nullableString,
  selectedBy: z.enum(["ai", "system"]),
  selectionReason: nullableString,
  sourceCoordinateSpace: z.string().min(1).optional().default("grid"),
  idempotencyKey: z.string().min(1),
  timeoutMs: z.number().positive().optional(),
  // Grid cell target
  gridCell: VisualTargetGridCellSchema.nullable().optional().default(null),
  // Grid region target
  gridRegion: VisualTargetGridRegionSchema.nullable().optional().default(null),
  // Bbox target
  bbox: VisualTargetBboxSchema.nullable().optional().default(null),
});

export const VisualTargetAbilityInputSchema = VisualTargetBaseInputSchema;

// ── Result ────────────────────────────────────────────────────────────────────

export const VisualTargetAbilityResultSchema = z.object({
  abilityGroupId: z.literal(VISUAL_TARGET_ABILITY_GROUP_ID),
  childCapabilityId: VisualTargetChildCapabilityIdSchema,
  status: z.enum(["success", "failed", "review_required"]),
  targetResultRef: z.string().nullable().default(null),
  candidateRef: z.string().nullable().default(null),
  output: VisualTargetOutputSchema.nullable().default(null),
  failureReason: z.string().nullable().default(null),
  reviewRequiredReason: z.string().nullable().default(null),
  runtimeProof: VisualTargetRuntimeProofSchema,
  startedAt: z.string().min(1),
  endedAt: z.string().min(1),
  durationMs: z.number().nonnegative(),
});
