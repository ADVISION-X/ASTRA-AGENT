import { z } from "zod";

import {
  MOUSE_CLICK_ABILITY_GROUP_ID,
  MOUSE_CLICK_CHILD_CAPABILITY_IDS,
} from "./shared/constants.js";

const nullableString = z.string().min(1).nullable().default(null);
const positiveInt = z.number().int().positive();
const finiteCoord = z
  .object({ x: z.number().finite(), y: z.number().finite() })
  .strict();
const positiveDims = z
  .object({
    width: z.number().finite().positive(),
    height: z.number().finite().positive(),
  })
  .strict();

export const MouseClickChildCapabilityIdSchema = z.enum(MOUSE_CLICK_CHILD_CAPABILITY_IDS);

export const MouseClickStatusSchema = z.enum(["success", "failed", "review_required"]);

export const MouseClickFailureReasonSchema = z.enum([
  "input_schema_invalid",
  "unknown_child_capability",
  "geometry_guard_not_allow",
  "idempotency_replay",
  "policy_blocked",
  "timeout_invalid",
  "primitive_failed",
  "child_execution_failed",
]);

/**
 * The governed input that Mouse Click accepts.
 *
 * FORBIDDEN (must never appear here):
 *   button, clickCount, x, y, clientX, clientY
 *   bindingPackageId, bindingPackageVersion, targetBindingId, bindingVersion
 *   mapId, routeId, activationId, packageVersion
 */
export const MouseClickAbilityInputSchema = z
  .object({
    abilityGroupId: z
      .literal(MOUSE_CLICK_ABILITY_GROUP_ID)
      .default(MOUSE_CLICK_ABILITY_GROUP_ID),
    childCapabilityId: MouseClickChildCapabilityIdSchema,
    missionId: z.string().min(1),
    runId: z.string().min(1),
    sessionId: z.string().min(1),
    roundId: nullableString,
    videoVisitId: nullableString,
    stepId: z.string().min(1),
    capabilityCallId: z.string().min(1),
    nerveBusEnvelopeId: z.string().min(1),
    requestedBy: z.string().min(1),
    purpose: z.string().min(1),
    inputRef: z.string().min(1),
    sourceRef: z.string().min(1),
    sourceCoordinateProofRef: z.string().min(1),
    sourceEvidenceRef: nullableString,
    geometryGuardRef: z.string().min(1),
    geometryGuardProofRef: z.string().min(1),
    geometryGuardOutputRef: z.string().min(1),
    guardDecision: z.literal("allow"),
    geometryGuardNormalizedCoordinateSpace: z.literal("browserViewport"),
    geometryGuardNormalizedClickPoint: finiteCoord,
    bounds: positiveDims,
    idempotencyKey: z.string().min(1),
    timeoutMs: positiveInt.default(30_000),
  })
  .strict();

export const MouseClickRuntimeProofSchema = z
  .object({
    proofId: z.string().min(1),
    missionId: z.string().min(1),
    runId: z.string().min(1),
    sessionId: z.string().min(1),
    roundId: nullableString,
    videoVisitId: nullableString,
    stepId: z.string().min(1),
    capabilityCallId: z.string().min(1),
    nerveBusEnvelopeId: z.string().min(1),
    abilityGroupId: z.literal(MOUSE_CLICK_ABILITY_GROUP_ID),
    childCapabilityId: MouseClickChildCapabilityIdSchema,
    geometryGuardRef: z.string().min(1),
    geometryGuardProofRef: z.string().min(1),
    sourceCoordinateProofRef: z.string().min(1),
    coordinateSpace: z.literal("browserViewport"),
    normalizedClickPoint: finiteCoord,
    executableCoordinate: finiteCoord,
    button: z.enum(["left", "right"]),
    clickCount: z.union([z.literal(1), z.literal(2)]),
    status: MouseClickStatusSchema,
    failureReason: MouseClickFailureReasonSchema.nullable().default(null),
    reviewRequiredReason: nullableString,
    startedAt: z.string().min(1),
    endedAt: z.string().min(1),
    primitiveStartedAt: nullableString,
    primitiveEndedAt: nullableString,
    durationMs: z.number().nonnegative(),
    primitiveExecutionRef: nullableString,
  })
  .strict();

export const MouseClickAbilityResultSchema = z
  .object({
    abilityGroupId: z.literal(MOUSE_CLICK_ABILITY_GROUP_ID),
    childCapabilityId: MouseClickChildCapabilityIdSchema,
    status: MouseClickStatusSchema,
    failureReason: MouseClickFailureReasonSchema.nullable().default(null),
    reviewRequiredReason: nullableString,
    output: z.record(z.unknown()),
    runtimeProof: MouseClickRuntimeProofSchema,
  })
  .strict();
