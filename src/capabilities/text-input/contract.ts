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

type TextInputChildCapabilityId = (typeof TEXT_INPUT_CHILD_CAPABILITY_IDS)[number];
type TextInputTargetKind = z.output<typeof TextInputTargetKindSchema>;
type TextInputKey = z.output<typeof TextInputKeySchema>;
type TextInputCommitKey = z.output<typeof TextInputCommitKeySchema>;
type TextInputSourceOwner = z.output<typeof TextInputSourceOwnerSchema>;
type TextInputFailureReason = z.output<typeof TextInputFailureReasonSchema>;
type TextInputStatus = z.output<typeof TextInputStatusSchema>;
type TextInputPolicy = z.output<typeof TextInputPolicySchema>;
type TextInputRuntimeProof = z.output<typeof TextInputRuntimeProofSchema>;
type TextInputAbilityInput = z.input<typeof TextInputAbilityInputSchema>;
type ParsedTextInputAbilityInput = z.output<typeof TextInputAbilityInputSchema>;
type TextInputSuccessOutput = z.output<typeof TextInputSuccessOutputSchema>;
type TypeTextAbilityInput = z.output<typeof TypeTextAbilityInputSchema>;
type PasteTextAbilityInput = z.output<typeof PasteTextAbilityInputSchema>;
type ClearInputAbilityInput = z.output<typeof ClearInputAbilityInputSchema>;
type ReplaceInputAbilityInput = z.output<typeof ReplaceInputAbilityInputSchema>;
type PressKeyAbilityInput = z.output<typeof PressKeyAbilityInputSchema>;
type CommitInputAbilityInput = z.output<typeof CommitInputAbilityInputSchema>;
type TextInputAbilityResult = z.output<typeof TextInputAbilityResultSchema>;

interface TextInputAbilityGroup {
  listChildCapabilityIds(): TextInputChildCapabilityId[];
  execute(input: TextInputAbilityInput): Promise<TextInputAbilityResult>;
}

export type { TextInputChildCapabilityId, TextInputTargetKind, TextInputKey, TextInputCommitKey, TextInputSourceOwner, TextInputFailureReason, TextInputStatus, TextInputPolicy, TextInputRuntimeProof, TextInputAbilityInput, ParsedTextInputAbilityInput, TextInputSuccessOutput, TypeTextAbilityInput, PasteTextAbilityInput, ClearInputAbilityInput, ReplaceInputAbilityInput, PressKeyAbilityInput, CommitInputAbilityInput, TextInputAbilityResult, TextInputAbilityGroup };
export type { ClipboardPort, ClipboardReadResult, ClipboardWriteResult } from "./ports/clipboard-port.js";
export type { TextInputExecutionPort, TextInputExecutionRequest, TextInputExecutionResult } from "./ports/text-input-execution-port.js";
