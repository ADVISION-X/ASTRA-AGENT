import type {
  TextInputAbilityGroup,
  TextInputAbilityInput,
  TextInputChildCapabilityId,
  ParsedTextInputAbilityInput,
  TextInputExecutionContext,
} from "./contract.js";
import {
  TextInputAbilityInputSchema,
  TextInputAbilityResultSchema,
} from "./schema.js";
import { createTextInputCapabilityRegistry, listTextInputChildren } from "./registry.js";

function buildInputParseFailureResult(input: TextInputAbilityInput) {
  const abilityGroupId = "text-input" as const;
  const childCapabilityId: TextInputChildCapabilityId =
    typeof input.childCapabilityId === "string" &&
    [
      "type-approved-text-once",
      "press-approved-key-once",
      "clear-focused-input-once",
    ].includes(input.childCapabilityId as string)
      ? (input.childCapabilityId as TextInputChildCapabilityId)
      : "type-approved-text-once";

  const now = new Date().toISOString();
  return TextInputAbilityResultSchema.parse({
    abilityGroupId,
    childCapabilityId,
    status: "failed",
    failureReason: "input_schema_invalid",
    reviewRequiredReason: null,
    writeMode: "type_text_once",
    textInputProofRef: null,
    primitiveExecutionRef: null,
    targetRef: null,
    focusRef: null,
    runtimeProof: {
      proofId: `ti:proof:parse-fail:${Date.now()}`,
      abilityGroupId,
      childCapabilityId,
      missionId:
        typeof input.missionId === "string" ? input.missionId : "unknown",
      runId: typeof input.runId === "string" ? input.runId : "unknown",
      sessionId: null,
      roundId: null,
      stepId: typeof input.stepId === "string" ? input.stepId : "unknown",
      capabilityCallId:
        typeof input.capabilityCallId === "string"
          ? input.capabilityCallId
          : "unknown",
      nerveBusEnvelopeId:
        typeof input.nerveBusEnvelopeId === "string"
          ? input.nerveBusEnvelopeId
          : "unknown",
      inputRef:
        typeof input.inputRef === "string" ? input.inputRef : "unknown",
      targetRef: null,
      focusRef: null,
      writeMode: "type_text_once",
      approvedTextHash: null,
      approvedKey: null,
      status: "failed",
      failureReason: "input_schema_invalid",
      reviewRequiredReason: null,
      startedAt: now,
      endedAt: now,
      durationMs: 0,
      primitiveExecutionRef: null,
    },
  });
}

async function dispatchToChild(
  registry: ReturnType<typeof createTextInputCapabilityRegistry>,
  childCapabilityId: TextInputChildCapabilityId,
  parsed: ParsedTextInputAbilityInput,
  context: TextInputExecutionContext,
) {
  const capability = registry.get(childCapabilityId);
  if (!capability) {
    const now = new Date().toISOString();
    return TextInputAbilityResultSchema.parse({
      abilityGroupId: "text-input",
      childCapabilityId,
      status: "failed",
      failureReason: "unknown_child_capability",
      reviewRequiredReason: null,
      writeMode: "type_text_once",
      textInputProofRef: null,
      primitiveExecutionRef: null,
      targetRef: parsed.targetRef,
      focusRef: parsed.focusRef,
      runtimeProof: {
        proofId: `ti:proof:unknown-child:${Date.now()}`,
        abilityGroupId: "text-input",
        childCapabilityId,
        missionId: parsed.missionId,
        runId: parsed.runId,
        sessionId: parsed.sessionId,
        roundId: parsed.roundId,
        stepId: parsed.stepId,
        capabilityCallId: parsed.capabilityCallId,
        nerveBusEnvelopeId: parsed.nerveBusEnvelopeId,
        inputRef: parsed.inputRef,
        targetRef: parsed.targetRef,
        focusRef: parsed.focusRef,
        writeMode: "type_text_once",
        approvedTextHash: null,
        approvedKey: null,
        status: "failed",
        failureReason: "unknown_child_capability",
        reviewRequiredReason: null,
        startedAt: now,
        endedAt: now,
        durationMs: 0,
        primitiveExecutionRef: null,
      },
    });
  }

  try {
    return TextInputAbilityResultSchema.parse(
      await capability.execute(parsed, context),
    );
  } catch {
    const now = new Date().toISOString();
    return TextInputAbilityResultSchema.parse({
      abilityGroupId: "text-input",
      childCapabilityId,
      status: "failed",
      failureReason: "child_execution_failed",
      reviewRequiredReason: null,
      writeMode: capability.writeMode,
      textInputProofRef: null,
      primitiveExecutionRef: null,
      targetRef: parsed.targetRef,
      focusRef: parsed.focusRef,
      runtimeProof: {
        proofId: `ti:proof:exec-fail:${Date.now()}`,
        abilityGroupId: "text-input",
        childCapabilityId,
        missionId: parsed.missionId,
        runId: parsed.runId,
        sessionId: parsed.sessionId,
        roundId: parsed.roundId,
        stepId: parsed.stepId,
        capabilityCallId: parsed.capabilityCallId,
        nerveBusEnvelopeId: parsed.nerveBusEnvelopeId,
        inputRef: parsed.inputRef,
        targetRef: parsed.targetRef,
        focusRef: parsed.focusRef,
        writeMode: capability.writeMode,
        approvedTextHash: null,
        approvedKey: null,
        status: "failed",
        failureReason: "child_execution_failed",
        reviewRequiredReason: null,
        startedAt: now,
        endedAt: now,
        durationMs: 0,
        primitiveExecutionRef: null,
      },
    });
  }
}

type CreateTextInputAbilityGroupInput = {
  context: TextInputExecutionContext;
};

export function createTextInputAbilityGroup(
  input: CreateTextInputAbilityGroupInput,
): TextInputAbilityGroup {
  const registry = createTextInputCapabilityRegistry();

  return {
    listChildCapabilityIds(): TextInputChildCapabilityId[] {
      return listTextInputChildren();
    },
    async execute(inputValue: TextInputAbilityInput) {
      const parsed = TextInputAbilityInputSchema.safeParse(inputValue);
      if (!parsed.success) {
        return buildInputParseFailureResult(inputValue);
      }
      return dispatchToChild(
        registry,
        parsed.data.childCapabilityId,
        parsed.data,
        input.context,
      );
    },
  };
}
