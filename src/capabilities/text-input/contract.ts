import type { z } from "zod";

import {
  CommitInputAbilityInputSchema,
  TextInputCommitKeySchema,
  PressKeyAbilityInputSchema,
  ClearInputAbilityInputSchema,
  PasteTextAbilityInputSchema,
  ReplaceInputAbilityInputSchema,
  TextInputAbilityInputSchema,
  TextInputAbilityResultSchema,
  TextInputFailureReasonSchema,
  TextInputKeySchema,
  TextInputPolicySchema,
  TextInputRuntimeProofSchema,
  TextInputSourceOwnerSchema,
  TextInputStatusSchema,
  TextInputSuccessOutputSchema,
  TextInputTargetKindSchema,
  TypeTextAbilityInputSchema,
} from "./schema.js";
import {
  TEXT_INPUT_ABILITY_GROUP_ID,
  TEXT_INPUT_CHILD_CAPABILITY_IDS,
  TEXT_INPUT_COMMIT_KEYS,
  TEXT_INPUT_KEYS,
  TEXT_INPUT_TARGET_KINDS,
} from "./shared/text-input-types.js";

export {
  TEXT_INPUT_ABILITY_GROUP_ID,
  TEXT_INPUT_CHILD_CAPABILITY_IDS,
  TEXT_INPUT_COMMIT_KEYS,
  TEXT_INPUT_KEYS,
  TEXT_INPUT_TARGET_KINDS,
};

export type TextInputChildCapabilityId = (typeof TEXT_INPUT_CHILD_CAPABILITY_IDS)[number];
export type TextInputTargetKind = z.output<typeof TextInputTargetKindSchema>;
export type TextInputKey = z.output<typeof TextInputKeySchema>;
export type TextInputCommitKey = z.output<typeof TextInputCommitKeySchema>;
export type TextInputSourceOwner = z.output<typeof TextInputSourceOwnerSchema>;
export type TextInputFailureReason = z.output<typeof TextInputFailureReasonSchema>;
export type TextInputStatus = z.output<typeof TextInputStatusSchema>;
export type TextInputPolicy = z.output<typeof TextInputPolicySchema>;
export type TextInputRuntimeProof = z.output<typeof TextInputRuntimeProofSchema>;
export type TextInputAbilityInput = z.input<typeof TextInputAbilityInputSchema>;
export type ParsedTextInputAbilityInput = z.output<typeof TextInputAbilityInputSchema>;
export type TextInputSuccessOutput = z.output<typeof TextInputSuccessOutputSchema>;
export type TypeTextAbilityInput = z.output<typeof TypeTextAbilityInputSchema>;
export type PasteTextAbilityInput = z.output<typeof PasteTextAbilityInputSchema>;
export type ClearInputAbilityInput = z.output<typeof ClearInputAbilityInputSchema>;
export type ReplaceInputAbilityInput = z.output<typeof ReplaceInputAbilityInputSchema>;
export type PressKeyAbilityInput = z.output<typeof PressKeyAbilityInputSchema>;
export type CommitInputAbilityInput = z.output<typeof CommitInputAbilityInputSchema>;
export type TextInputAbilityResult = z.output<typeof TextInputAbilityResultSchema>;

export interface TextInputAbilityGroup {
  listChildCapabilityIds(): TextInputChildCapabilityId[];
  execute(input: TextInputAbilityInput): Promise<TextInputAbilityResult>;
}