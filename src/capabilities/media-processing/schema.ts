import { z } from "zod";

export const MEDIA_PROCESSING_ABILITY_GROUP_ID = "media-processing" as const;

export const MediaProcessingChildCapabilityIdSchema = z.enum([
  "optimize-image-for-web-once",
  "resize-image-for-web-once",
  "generate-responsive-image-variants-once",
]);

const MediaProcessingStatusSchema = z.enum([
  "success",
  "failed",
  "review_required",
  "invalid_input",
]);

const MediaProcessingArtifactPolicySchema = z.enum(["deliverable", "staging"]);

const MediaProcessingPresetIdSchema = z.enum([
  "web-image",
  "web-image-responsive",
  "public-knowledge-hero",
]);

const MediaProcessingImageFormatSchema = z.enum(["webp", "jpeg", "png"]);

const PositiveBoundedDimensionSchema = z.number().int().min(1).max(8192);

export const MediaProcessingPublicRequestSchema = z.object({
  missionId: z.string().min(1),
  runId: z.string().min(1),
  inputFilePath: z.string().min(1),
  presetId: MediaProcessingPresetIdSchema,
  outputFormat: MediaProcessingImageFormatSchema.optional(),
  quality: z.number().int().min(1).max(100).optional(),
  maxWidth: PositiveBoundedDimensionSchema.optional(),
  maxHeight: PositiveBoundedDimensionSchema.optional(),
  targetWidth: PositiveBoundedDimensionSchema.optional(),
  targetHeight: PositiveBoundedDimensionSchema.optional(),
  variantWidths: z.array(PositiveBoundedDimensionSchema).min(1).max(8).optional(),
  timeoutMs: z.number().int().min(1000).max(3_600_000).default(120_000),
  artifactPolicy: MediaProcessingArtifactPolicySchema.default("deliverable"),
}).strict();

const MediaProcessingInputBaseSchema = z.object({
  abilityGroupId: z.literal(MEDIA_PROCESSING_ABILITY_GROUP_ID).default(MEDIA_PROCESSING_ABILITY_GROUP_ID),
  missionId: z.string().min(1),
  runId: z.string().min(1),
  capabilityCallId: z.string().min(1),
  inputFilePath: z.string().min(1),
  presetId: MediaProcessingPresetIdSchema.optional(),
  quality: z.number().int().min(1).max(100).default(82),
  maxWidth: PositiveBoundedDimensionSchema.optional(),
  maxHeight: PositiveBoundedDimensionSchema.optional(),
  targetWidth: PositiveBoundedDimensionSchema.optional(),
  targetHeight: PositiveBoundedDimensionSchema.optional(),
  variantWidths: z.array(PositiveBoundedDimensionSchema).min(1).max(8).optional(),
  timeoutMs: z.number().int().min(1000).max(3_600_000).default(120_000),
  artifactDisposition: MediaProcessingArtifactPolicySchema.default("deliverable"),
});

const OptimizeImageInputSchema = MediaProcessingInputBaseSchema.extend({
  childCapabilityId: z.literal("optimize-image-for-web-once"),
  outputFormat: MediaProcessingImageFormatSchema.default("webp"),
}).strict();

const ResizeImageInputSchema = MediaProcessingInputBaseSchema.extend({
  childCapabilityId: z.literal("resize-image-for-web-once"),
  outputFormat: MediaProcessingImageFormatSchema.default("webp"),
}).strict();

const ResponsiveImageSetInputSchema = MediaProcessingInputBaseSchema.extend({
  childCapabilityId: z.literal("generate-responsive-image-variants-once"),
  outputFormat: MediaProcessingImageFormatSchema.default("webp"),
}).strict();

export const MediaProcessingAbilityInputSchema = z.discriminatedUnion("childCapabilityId", [
  OptimizeImageInputSchema,
  ResizeImageInputSchema,
  ResponsiveImageSetInputSchema,
]);

const MediaProcessingArtifactSchema = z.object({
  artifactRef: z.string().min(1),
  storageRef: z.string().min(1),
  filePath: z.string().min(1),
  contentType: z.string().min(1),
  byteSize: z.number().int().nonnegative(),
  sha256: z.string().min(64).max(64),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  format: z.string().min(1),
  derivativeKind: z.enum(["optimized", "resized", "responsive_variant", "inspection"]),
}).strict();

const MediaProcessingProofSchema = z.object({
  proofId: z.string().min(1),
  missionId: z.string().min(1),
  runId: z.string().min(1),
  capabilityCallId: z.string().min(1),
  abilityGroupId: z.literal(MEDIA_PROCESSING_ABILITY_GROUP_ID),
  childCapabilityId: MediaProcessingChildCapabilityIdSchema,
  status: MediaProcessingStatusSchema,
  failureReason: z.string().min(1).nullable(),
  reviewRequiredReason: z.string().min(1).nullable(),
  inputFilePath: z.string().min(1),
  inputByteSize: z.number().int().nonnegative().nullable(),
  outputArtifacts: z.array(MediaProcessingArtifactSchema),
  startedAt: z.string().min(1),
  endedAt: z.string().min(1),
  durationMsTotal: z.number().nonnegative(),
}).strict();

const MediaProcessingSuccessOutputSchema = z.object({
  status: z.literal("success"),
  outputArtifacts: z.array(MediaProcessingArtifactSchema).min(1),
  proofRef: z.string().min(1),
}).strict();

const MediaProcessingFailureOutputSchema = z.object({
  status: z.enum(["failed", "review_required", "invalid_input"]),
  errorCode: z.string().min(1),
  reason: z.string().min(1),
  proofRef: z.string().min(1),
}).strict();

export const MediaProcessingResultSchema = z.object({
  abilityGroupId: z.literal(MEDIA_PROCESSING_ABILITY_GROUP_ID),
  childCapabilityId: MediaProcessingChildCapabilityIdSchema,
  status: MediaProcessingStatusSchema,
  failureReason: z.string().min(1).nullable(),
  reviewRequiredReason: z.string().min(1).nullable(),
  output: z.union([MediaProcessingSuccessOutputSchema, MediaProcessingFailureOutputSchema]),
  runtimeProof: MediaProcessingProofSchema,
}).strict();

export type MediaProcessingChildCapabilityId = z.infer<typeof MediaProcessingChildCapabilityIdSchema>;
export type MediaProcessingPublicRequest = z.input<typeof MediaProcessingPublicRequestSchema>;
export type MediaProcessingAbilityInput = z.input<typeof MediaProcessingAbilityInputSchema>;
export type ParsedMediaProcessingAbilityInput = z.infer<typeof MediaProcessingAbilityInputSchema>;
export type MediaProcessingResult = z.infer<typeof MediaProcessingResultSchema>;
export type MediaProcessingArtifact = z.infer<typeof MediaProcessingArtifactSchema>;
