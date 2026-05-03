import { z } from "zod";

const limitedString = (max: number) => z.string().min(1).max(max);
const nullableString = z.string().min(1).nullable().optional().default(null);

export const VISUAL_TARGET_CHAIN_FIELD_NAMES = [
  "missionId",
  "runId",
  "stepId",
  "mapPackageId",
  "mapPackageVersion",
  "selectedMapId",
  "selectedMapVersion",
  "activationSnapshotRef",
  "capabilityCallId",
  "nerveBusEnvelopeId",
] as const;

export const VisualTargetChainInputShape = {
  missionId: limitedString(160),
  runId: limitedString(200),
  stepId: limitedString(160),
  mapPackageId: limitedString(160),
  mapPackageVersion: limitedString(80),
  selectedMapId: limitedString(160),
  selectedMapVersion: limitedString(80),
  activationSnapshotRef: limitedString(200),
  capabilityCallId: limitedString(200),
  nerveBusEnvelopeId: limitedString(200),
  idempotencyKey: limitedString(200),
} satisfies z.ZodRawShape;

export const VisualTargetChainResultShape = {
  missionId: nullableString,
  runId: nullableString,
  stepId: nullableString,
  mapPackageId: nullableString,
  mapPackageVersion: nullableString,
  selectedMapId: nullableString,
  selectedMapVersion: nullableString,
  activationSnapshotRef: nullableString,
  capabilityCallId: nullableString,
  nerveBusEnvelopeId: nullableString,
} satisfies z.ZodRawShape;

export const VisualTargetConfidencePolicySchema = z.object({
  minimumConfidence: z.number().min(0).max(1),
  reviewBelowThreshold: z.boolean(),
}).strict();

export const VisualTargetSelectionPolicySchema = z.object({
  strategy: z.enum(["highest_score"]),
  requireScoreTrace: z.literal(true),
}).strict();

export const VisualTargetAmbiguityPolicySchema = z.object({
  minimumGap: z.number().min(0),
  reviewOnAmbiguous: z.boolean(),
}).strict();

export const VisualTargetCoordinatePolicySchema = z.object({
  allowAiInputMapping: z.boolean(),
  allowContactSheetAsExecutable: z.literal(false),
}).strict();

export const VisualTargetDataQualityPolicySchema = z.object({
  blockOnCritical: z.boolean(),
  reviewOnLowConfidence: z.boolean(),
}).strict();