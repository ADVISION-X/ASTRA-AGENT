import { z } from "zod";

import {
  TEXT_INPUT_ABILITY_GROUP_ID,
  TEXT_INPUT_CHILD_CAPABILITY_IDS,
  TEXT_INPUT_APPROVED_KEY_ALLOWLIST,
} from "./shared/constants.js";

const nullableString = z.string().min(1).nullable().default(null);
const positiveInt = z.number().int().positive();

export const TextInputChildCapabilityIdSchema = z.enum(
  TEXT_INPUT_CHILD_CAPABILITY_IDS,
);

export const TextInputStatusSchema = z.enum([
  "success",
  "failed",
  "review_required",
]);

export const TextInputFailureReasonSchema = z.enum([
  "input_schema_invalid",
  "unknown_child_capability",
  "idempotency_replay",
  "policy_blocked",
  "missing_approved_text",
  "missing_approved_key",
  "key_not_in_allowlist",
  "missing_target_or_focus_ref",
  "timeout_invalid",
  "primitive_failed",
  "child_execution_failed",
]);

export const TextInputWriteModeSchema = z.enum([
  "type_text_once",
  "press_key_once",
  "clear_focused_input_once",
]);

/**
 * The governed input that Text Input accepts.
 *
 * FORBIDDEN (must never appear here):
 *   generatedText, promptText, rawModelOutput, unapprovedText
 *   mapId, runtimePlanId, routePlanId, activationId, templateId
 *   selectedMapId, bindingPackageId, bindingVersion, bindingSnapshotRef
 *   branchToken, deterministicFlowPlan, selection, package
 *   domSelector, rawBrowserCommand, clipboardContent
 */
export const TextInputAbilityInputSchema = z
  .object({
    abilityGroupId: z
      .literal(TEXT_INPUT_ABILITY_GROUP_ID)
      .default(TEXT_INPUT_ABILITY_GROUP_ID),
    childCapabilityId: TextInputChildCapabilityIdSchema,
    missionId: z.string().min(1),
    runId: z.string().min(1),
    sessionId: nullableString,
    roundId: nullableString,
    stepId: z.string().min(1),
    capabilityCallId: z.string().min(1),
    nerveBusEnvelopeId: z.string().min(1),
    inputRef: z.string().min(1),
    targetRef: nullableString,
    focusRef: nullableString,
    idempotencyKey: z.string().min(1),
    timeoutMs: positiveInt.default(10_000),
    /** Required for type-approved-text-once. */
    approvedText: z.string().min(1).nullable().default(null),
    /** Required for press-approved-key-once. Must be from allowlist. */
    approvedKey: z
      .enum(TEXT_INPUT_APPROVED_KEY_ALLOWLIST)
      .nullable()
      .default(null),
  })
  .strict();

export const TextInputRuntimeProofSchema = z
  .object({
    proofId: z.string().min(1),
    abilityGroupId: z.literal(TEXT_INPUT_ABILITY_GROUP_ID),
    childCapabilityId: TextInputChildCapabilityIdSchema,
    missionId: z.string().min(1),
    runId: z.string().min(1),
    sessionId: z.string().min(1).nullable(),
    roundId: z.string().min(1).nullable(),
    stepId: z.string().min(1),
    capabilityCallId: z.string().min(1),
    nerveBusEnvelopeId: z.string().min(1),
    inputRef: z.string().min(1),
    targetRef: z.string().min(1).nullable(),
    focusRef: z.string().min(1).nullable(),
    writeMode: TextInputWriteModeSchema,
    approvedTextHash: z.string().min(1).nullable(),
    approvedKey: z.enum(TEXT_INPUT_APPROVED_KEY_ALLOWLIST).nullable(),
    status: TextInputStatusSchema,
    failureReason: TextInputFailureReasonSchema.nullable(),
    reviewRequiredReason: z.string().nullable(),
    startedAt: z.string().min(1),
    endedAt: z.string().min(1),
    durationMs: z.number().int().nonnegative(),
    primitiveExecutionRef: z.string().min(1).nullable(),
  })
  .strict();

export const TextInputAbilityResultSchema = z
  .object({
    abilityGroupId: z.literal(TEXT_INPUT_ABILITY_GROUP_ID),
    childCapabilityId: TextInputChildCapabilityIdSchema,
    status: TextInputStatusSchema,
    failureReason: TextInputFailureReasonSchema.nullable(),
    reviewRequiredReason: z.string().nullable(),
    writeMode: TextInputWriteModeSchema,
    textInputProofRef: z.string().min(1).nullable(),
    primitiveExecutionRef: z.string().min(1).nullable(),
    targetRef: z.string().min(1).nullable(),
    focusRef: z.string().min(1).nullable(),
    runtimeProof: TextInputRuntimeProofSchema,
  })
  .strict();
