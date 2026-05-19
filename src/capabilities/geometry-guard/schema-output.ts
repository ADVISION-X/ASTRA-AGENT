import { z } from "zod";

import { GEOMETRY_GUARD_ABILITY_GROUP_ID } from "./schema-constants.js";
import {
  GeometryGuardBoundingBoxSchema,
  GeometryGuardChildCapabilityIdSchema,
  GeometryGuardPointSchema,
} from "./schema-primitives.js";

const nullableString = z.string().nullable().optional().default(null);
const guardDecisionSchema = z.enum(["allow", "deny", "review_required"]);
const normalizedSpaceSchema = z.literal("browserViewport").nullable().default(null);

export const GeometryGuardRuntimeProofSchema = z.object({
  proofId: z.string().min(1),
  abilityGroupId: z.literal(GEOMETRY_GUARD_ABILITY_GROUP_ID),
  childCapabilityId: GeometryGuardChildCapabilityIdSchema,
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
  sourceAbilityGroupId: nullableString,
  sourceChildCapabilityId: nullableString,
  gridSpecRef: nullableString,
  sourceCoordinateSpace: z.string().min(1),
  requestedExecutionSpace: z.string().min(1),
  normalizedCoordinateSpace: normalizedSpaceSchema,
  normalizedClickPoint: GeometryGuardPointSchema.nullable().default(null),
  normalizedBbox: GeometryGuardBoundingBoxSchema.nullable().default(null),
  guardDecision: guardDecisionSchema,
  failureReason: z.string().nullable().default(null),
  reviewRequiredReason: z.string().nullable().default(null),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative(),
});

export const GeometryGuardOutputSchema = z.object({
  childCapabilityId: GeometryGuardChildCapabilityIdSchema,
  geometryGuardRef: z.string().min(1),
  outputRef: z.string().min(1),
  guardDecision: guardDecisionSchema,
  normalizedCoordinateSpace: normalizedSpaceSchema,
  normalizedClickPoint: GeometryGuardPointSchema.nullable().default(null),
  normalizedBbox: GeometryGuardBoundingBoxSchema.nullable().default(null),
  sourceScreenshotEvidenceRef: nullableString,
  sourceTargetRef: nullableString,
  sourceVisualTargetResultRef: nullableString,
  sourceAiResultRef: nullableString,
  sourcePageStateProofRef: nullableString,
});

export const GeometryGuardAbilityResultSchema = z.object({
  abilityGroupId: z.literal(GEOMETRY_GUARD_ABILITY_GROUP_ID),
  childCapabilityId: GeometryGuardChildCapabilityIdSchema,
  status: z.enum(["success", "failed", "review_required"]),
  geometryGuardRef: z.string().min(1),
  guardDecision: guardDecisionSchema,
  normalizedCoordinateSpace: normalizedSpaceSchema,
  normalizedClickPoint: GeometryGuardPointSchema.nullable().default(null),
  normalizedBbox: GeometryGuardBoundingBoxSchema.nullable().default(null),
  sourceScreenshotEvidenceRef: nullableString,
  failureReason: z.string().nullable().default(null),
  reviewRequiredReason: z.string().nullable().default(null),
  statusMessage: z.string().min(1),
  output: GeometryGuardOutputSchema.nullable().default(null),
  runtimeProof: GeometryGuardRuntimeProofSchema,
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative(),
});

