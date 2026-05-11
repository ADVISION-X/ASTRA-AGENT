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

function buildRuntimeProof(
  input: ParsedTextInputAbilityInput,
  writeMode: TextInputWriteMode,
  status: "success" | "failed",
  failureReason: TextInputFailureReason | null,
  startedAt: string,
  endedAt: string,
  primitiveExecutionRef: string | null,
) {
  const durationMs = Math.max(
    0,
    new Date(endedAt).getTime() - new Date(startedAt).getTime(),
  );
  const proofId = buildProofId(
    input,
    primitiveExecutionRef ?? `fail:${Date.now()}`,
  );

  return TextInputRuntimeProofSchema.parse({
    proofId,
    abilityGroupId: TEXT_INPUT_ABILITY_GROUP_ID,
    childCapabilityId: input.childCapabilityId,
    missionId: input.missionId,
    runId: input.runId,
    sessionId: input.sessionId,
    roundId: input.roundId,
    stepId: input.stepId,
    capabilityCallId: input.capabilityCallId,
    nerveBusEnvelopeId: input.nerveBusEnvelopeId,
    inputRef: input.inputRef,
    targetRef: input.targetRef,
    focusRef: input.focusRef,
    writeMode,
    approvedTextHash:
      input.approvedText != null ? hashApprovedText(input.approvedText) : null,
    approvedKey: input.approvedKey,
    status,
    failureReason,
    reviewRequiredReason: null,
    startedAt,
    endedAt,
    durationMs,
    primitiveExecutionRef,
  });
}

function buildResult(
  input: ParsedTextInputAbilityInput,
  writeMode: TextInputWriteMode,
  status: "success" | "failed",
  failureReason: TextInputFailureReason | null,
  startedAt: string,
  endedAt: string,
  primitiveExecutionRef: string | null,
): TextInputAbilityResult {
  const runtimeProof = buildRuntimeProof(
    input,
    writeMode,
    status,
    failureReason,
    startedAt,
    endedAt,
    primitiveExecutionRef,
  );
  const textInputProofRef =
    status === "success" ? runtimeProof.proofId : null;

  return TextInputAbilityResultSchema.parse({
    abilityGroupId: TEXT_INPUT_ABILITY_GROUP_ID,
    childCapabilityId: input.childCapabilityId,
    status,
    failureReason,
    reviewRequiredReason: null,
    writeMode,
    textInputProofRef,
    primitiveExecutionRef,
    targetRef: input.targetRef,
    focusRef: input.focusRef,
    runtimeProof,
  });
}

function policyCheck(
  input: ParsedTextInputAbilityInput,
  writeMode: TextInputWriteMode,
): TextInputFailureReason | null {
  if (writeMode === "type_text_once") {
    if (!input.approvedText) return "missing_approved_text";
    if (!input.targetRef && !input.focusRef) return "missing_target_or_focus_ref";
  } else if (writeMode === "press_key_once") {
    if (!input.approvedKey) return "missing_approved_key";
    // allowlist is enforced by Zod schema
  } else if (writeMode === "clear_focused_input_once") {
    if (!input.targetRef && !input.focusRef) return "missing_target_or_focus_ref";
  }
  return null;
}

export async function executeTextInput(
  input: ParsedTextInputAbilityInput,
  writeMode: TextInputWriteMode,
  context: TextInputExecutionContext,
): Promise<TextInputAbilityResult> {
  const startedAt = new Date().toISOString();

  const policyFailure = policyCheck(input, writeMode);
  if (policyFailure) {
    const endedAt = new Date().toISOString();
    return buildResult(
      input,
      writeMode,
      "failed",
      policyFailure,
      startedAt,
      endedAt,
      null,
    );
  }

  const primitiveRef = buildTextInputRef("ti:primitive", [
    input.missionId,
    input.runId,
    input.stepId,
    input.capabilityCallId,
    randomUUID(),
  ]);

  try {
    let primitiveResult;

    if (writeMode === "type_text_once") {
      primitiveResult = await context.primitivePort.typeText({
        primitiveRef,
        idempotencyKey: input.idempotencyKey,
        timeoutMs: input.timeoutMs,
        text: input.approvedText!,
      });
    } else if (writeMode === "press_key_once") {
      primitiveResult = await context.primitivePort.pressKey({
        primitiveRef,
        idempotencyKey: input.idempotencyKey,
        timeoutMs: input.timeoutMs,
        key: input.approvedKey!,
      });
    } else {
      primitiveResult = await context.primitivePort.clearFocusedInput({
        primitiveRef,
        idempotencyKey: input.idempotencyKey,
        timeoutMs: input.timeoutMs,
      });
    }

    const endedAt = new Date().toISOString();
    const status = primitiveResult.ok ? "success" : "failed";
    const failureReason: TextInputFailureReason | null = primitiveResult.ok
      ? null
      : "primitive_failed";

    return buildResult(
      input,
      writeMode,
      status,
      failureReason,
      startedAt,
      endedAt,
      primitiveResult.primitiveExecutionRef,
    );
  } catch {
    const endedAt = new Date().toISOString();
    return buildResult(
      input,
      writeMode,
      "failed",
      "primitive_failed",
      startedAt,
      endedAt,
      null,
    );
  }
}
