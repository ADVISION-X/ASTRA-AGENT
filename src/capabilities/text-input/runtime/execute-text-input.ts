import { randomUUID } from "node:crypto";

import {
  TEXT_INPUT_ABILITY_GROUP_ID,
  buildTextInputRef,
  hashApprovedText,
} from "../shared/constants.js";
import type {
  ParsedTextInputAbilityInput,
  TextInputAbilityResult,
  TextInputExecutionContext,
  TextInputFailureReason,
  TextInputWriteMode,
} from "../contract.js";
import {
  TextInputAbilityResultSchema,
  TextInputRuntimeProofSchema,
} from "../schema.js";
import type { TextInputPrimitiveResult } from "../ports/text-input-primitive-port.js";

type TextInputRun = {
  input: ParsedTextInputAbilityInput;
  writeMode: TextInputWriteMode;
  startedAt: string;
  endedAt: string;
  status: "success" | "failed";
  failureReason: TextInputFailureReason | null;
  primitiveExecutionRef: string | null;
};

type TextInputPolicyChecker = (
  input: ParsedTextInputAbilityInput,
) => TextInputFailureReason | null;

function buildProofId(
  input: ParsedTextInputAbilityInput,
  suffix: string,
): string {
  return buildTextInputRef("ti:proof", [
    input.missionId,
    input.runId,
    input.stepId,
    input.capabilityCallId,
    suffix,
  ]);
}

function buildRuntimeProof(run: TextInputRun) {
  const durationMs = Math.max(
    0,
    new Date(run.endedAt).getTime() - new Date(run.startedAt).getTime(),
  );
  const proofId = buildProofId(
    run.input,
    run.primitiveExecutionRef ?? `fail:${Date.now()}`,
  );

  return TextInputRuntimeProofSchema.parse({
    proofId,
    abilityGroupId: TEXT_INPUT_ABILITY_GROUP_ID,
    childCapabilityId: run.input.childCapabilityId,
    missionId: run.input.missionId,
    runId: run.input.runId,
    sessionId: run.input.sessionId,
    roundId: run.input.roundId,
    stepId: run.input.stepId,
    capabilityCallId: run.input.capabilityCallId,
    nerveBusEnvelopeId: run.input.nerveBusEnvelopeId,
    inputRef: run.input.inputRef,
    targetRef: run.input.targetRef,
    focusRef: run.input.focusRef,
    writeMode: run.writeMode,
    approvedTextHash:
      run.input.approvedText != null
        ? hashApprovedText(run.input.approvedText)
        : null,
    approvedKey: run.input.approvedKey,
    status: run.status,
    failureReason: run.failureReason,
    reviewRequiredReason: null,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    durationMs,
    primitiveExecutionRef: run.primitiveExecutionRef,
  });
}

function buildResult(run: TextInputRun): TextInputAbilityResult {
  const runtimeProof = buildRuntimeProof(run);
  const textInputProofRef =
    run.status === "success" ? runtimeProof.proofId : null;

  return TextInputAbilityResultSchema.parse({
    abilityGroupId: TEXT_INPUT_ABILITY_GROUP_ID,
    childCapabilityId: run.input.childCapabilityId,
    status: run.status,
    failureReason: run.failureReason,
    reviewRequiredReason: null,
    writeMode: run.writeMode,
    textInputProofRef,
    primitiveExecutionRef: run.primitiveExecutionRef,
    targetRef: run.input.targetRef,
    focusRef: run.input.focusRef,
    runtimeProof,
  });
}

const missingTargetOrFocusRef = (
  input: ParsedTextInputAbilityInput,
): TextInputFailureReason | null =>
  !input.targetRef && !input.focusRef
    ? "missing_target_or_focus_ref"
    : null;

const validateTypeTextInput: TextInputPolicyChecker = (input) => {
  if (!input.approvedText) return "missing_approved_text";
  return missingTargetOrFocusRef(input);
};

const validatePressKeyInput: TextInputPolicyChecker = (input) =>
  input.approvedKey ? null : "missing_approved_key";

const POLICY_CHECKERS = {
  type_text_once: validateTypeTextInput,
  press_key_once: validatePressKeyInput,
  clear_focused_input_once: missingTargetOrFocusRef,
} satisfies Record<TextInputWriteMode, TextInputPolicyChecker>;

const policyCheck = (
  input: ParsedTextInputAbilityInput,
  writeMode: TextInputWriteMode,
): TextInputFailureReason | null => POLICY_CHECKERS[writeMode](input);

const buildFailedRun = (
  input: ParsedTextInputAbilityInput,
  writeMode: TextInputWriteMode,
  startedAt: string,
  failureReason: TextInputFailureReason,
): TextInputRun => ({
  input,
  writeMode,
  startedAt,
  endedAt: new Date().toISOString(),
  status: "failed",
  failureReason,
  primitiveExecutionRef: null,
});

const buildPrimitiveRef = (input: ParsedTextInputAbilityInput): string =>
  buildTextInputRef("ti:primitive", [
    input.missionId,
    input.runId,
    input.stepId,
    input.capabilityCallId,
    randomUUID(),
  ]);

const buildPrimitiveInputBase = (
  input: ParsedTextInputAbilityInput,
  primitiveRef: string,
) => ({
  primitiveRef,
  idempotencyKey: input.idempotencyKey,
  timeoutMs: input.timeoutMs,
});

const executePrimitiveOperation = (
  input: ParsedTextInputAbilityInput,
  writeMode: TextInputWriteMode,
  context: TextInputExecutionContext,
  primitiveRef: string,
): Promise<TextInputPrimitiveResult> => {
  const primitiveInputBase = buildPrimitiveInputBase(input, primitiveRef);
  if (writeMode === "type_text_once") {
    return context.primitivePort.typeText({
      ...primitiveInputBase,
      text: input.approvedText!,
    });
  }
  if (writeMode === "press_key_once") {
    return context.primitivePort.pressKey({
      ...primitiveInputBase,
      key: input.approvedKey!,
    });
  }
  return context.primitivePort.clearFocusedInput(primitiveInputBase);
};

const buildRunFromPrimitiveResult = (
  input: ParsedTextInputAbilityInput,
  writeMode: TextInputWriteMode,
  startedAt: string,
  primitiveResult: TextInputPrimitiveResult,
): TextInputRun => ({
  input,
  writeMode,
  startedAt,
  endedAt: new Date().toISOString(),
  status: primitiveResult.ok ? "success" : "failed",
  failureReason: primitiveResult.ok ? null : "primitive_failed",
  primitiveExecutionRef: primitiveResult.primitiveExecutionRef,
});

const executePrimitiveRun = async (
  input: ParsedTextInputAbilityInput,
  writeMode: TextInputWriteMode,
  context: TextInputExecutionContext,
  startedAt: string,
): Promise<TextInputRun> => {
  const primitiveRef = buildPrimitiveRef(input);
  try {
    const primitiveResult = await executePrimitiveOperation(
      input,
      writeMode,
      context,
      primitiveRef,
    );
    return buildRunFromPrimitiveResult(
      input,
      writeMode,
      startedAt,
      primitiveResult,
    );
  } catch {
    return buildFailedRun(input, writeMode, startedAt, "primitive_failed");
  }
};

export async function executeTextInput(
  input: ParsedTextInputAbilityInput,
  writeMode: TextInputWriteMode,
  context: TextInputExecutionContext,
): Promise<TextInputAbilityResult> {
  const startedAt = new Date().toISOString();

  const policyFailure = policyCheck(input, writeMode);
  if (policyFailure) {
    return buildResult(
      buildFailedRun(input, writeMode, startedAt, policyFailure),
    );
  }

  const run = await executePrimitiveRun(input, writeMode, context, startedAt);
  return buildResult(run);
}
