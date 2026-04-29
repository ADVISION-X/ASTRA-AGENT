import { z } from "zod";

import { EvidenceRefSchema } from "./evidence.js";

export const StoredAiRuntimeProofSchema = z.object({
  abilityGroupId: z.literal("ai"),
  childCapabilityId: z.string().min(1),
  sessionId: z.string().min(1),
  roundId: z.string().min(1).nullable().default(null),
  videoVisitId: z.string().min(1).nullable().default(null),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: z.number().nonnegative(),
  status: z.enum(["success", "failed", "review_required"]),
  reason: z.string().min(1),
  failureReason: z.string().min(1).nullable().default(null),
  reviewRequiredReason: z.string().min(1).nullable().default(null),
  inputRefs: z.array(z.string().min(1)).default([]),
  outputRefs: z.array(z.string().min(1)).default([]),
  evidenceRefs: z.array(z.string().min(1)).default([]),
  actionLogRefs: z.array(z.string().min(1)).default([]),
  nextAbilityGroup: z.string().min(1).nullable().default(null),
  nextChildAbility: z.string().min(1).nullable().default(null),
  dataQualityFlags: z.array(z.string().min(1)).default([]),
});

export const StoredAiResultSchema = z.object({
  status: z.enum(["success", "failed", "review_required"]),
  abilityGroupId: z.literal("ai"),
  childCapabilityId: z.string().min(1),
  taskType: z.string().min(1),
  modelProvider: z.enum(["local", "paid", "future", "internal"]),
  modelName: z.string().min(1),
  modelRole: z.string().min(1),
  runtime: z.string().min(1),
  implementationStatus: z.string().min(1),
  output: z.unknown(),
  rawOutputRef: z.string().min(1).nullable().default(null),
  schemaValidationStatus: z.enum(["valid", "invalid", "not_applicable"]),
  confidence: z.number().min(0).max(1).nullable(),
  failureReason: z.string().min(1).nullable().default(null),
  durationMs: z.number().nonnegative(),
  costEstimate: z.number().nullable().default(null),
  evidenceRefs: z.array(EvidenceRefSchema),
  debugLogRef: z.string().min(1).nullable().default(null),
  runtimeProof: StoredAiRuntimeProofSchema,
  promptVersion: z.string().min(1),
  schemaVersion: z.string().min(1),
  createdAt: z.string().datetime(),
});

export type StoredAiRuntimeProof = z.infer<typeof StoredAiRuntimeProofSchema>;
export type StoredAiResult = z.infer<typeof StoredAiResultSchema>;