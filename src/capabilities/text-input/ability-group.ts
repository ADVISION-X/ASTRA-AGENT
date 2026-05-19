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

type TextInputAbilityGroupFailureReason =
  | "input_schema_invalid"
  | "unknown_child_capability"
  | "child_execution_failed";

type TextInputAbilityGroupFailure = {
  proofId: string;
  childCapabilityId: TextInputChildCapabilityId;
  failureReason: TextInputAbilityGroupFailureReason;
  writeMode: "type_text_once" | "press_key_once" | "clear_focused_input_once";
  missionId: string;
  runId: string;
  sessionId: string | null;
  roundId: string | null;
  stepId: string;
  capabilityCallId: string;
  nerveBusEnvelopeId: string;
  inputRef: string;
  targetRef: ParsedTextInputAbilityInput["targetRef"] | null;
  focusRef: ParsedTextInputAbilityInput["focusRef"] | null;
};

type ParsedFailureInput = {
  parsed: ParsedTextInputAbilityInput;
  childCapabilityId: TextInputChildCapabilityId;
  failureReason: Exclude<
    TextInputAbilityGroupFailureReason,
    "input_schema_invalid"
  >;
  writeMode: TextInputAbilityGroupFailure["writeMode"];
  proofId: string;
};

const resolveDefaultChildCapabilityId = (
  input: TextInputAbilityInput,
): TextInputChildCapabilityId =>
  typeof input.childCapabilityId === "string"
  && [
    "type-approved-text-once",
    "press-approved-key-once",
    "clear-focused-input-once",
  ].includes(input.childCapabilityId as string)
    ? (input.childCapabilityId as TextInputChildCapabilityId)
    : "type-approved-text-once";

const buildFailureRuntimeProof = (
  failure: TextInputAbilityGroupFailure,
  now: string,
) => ({
  proofId: failure.proofId,
  abilityGroupId: "text-input",
  childCapabilityId: failure.childCapabilityId,
  missionId: failure.missionId,
  runId: failure.runId,
  sessionId: failure.sessionId,
  roundId: failure.roundId,
  stepId: failure.stepId,
  capabilityCallId: failure.capabilityCallId,
  nerveBusEnvelopeId: failure.nerveBusEnvelopeId,
  inputRef: failure.inputRef,
  targetRef: failure.targetRef,
  focusRef: failure.focusRef,
  writeMode: failure.writeMode,
  approvedTextHash: null,
  approvedKey: null,
  status: "failed",
  failureReason: failure.failureReason,
  reviewRequiredReason: null,
  startedAt: now,
  endedAt: now,
  durationMs: 0,
  primitiveExecutionRef: null,
});

const buildFailureResult = (
  failure: TextInputAbilityGroupFailure,
) => {
  const now = new Date().toISOString();
  return TextInputAbilityResultSchema.parse({
    abilityGroupId: "text-input",
    childCapabilityId: failure.childCapabilityId,
    status: "failed",
    failureReason: failure.failureReason,
    reviewRequiredReason: null,
    writeMode: failure.writeMode,
    textInputProofRef: null,
    primitiveExecutionRef: null,
    targetRef: failure.targetRef,
    focusRef: failure.focusRef,
    runtimeProof: buildFailureRuntimeProof(failure, now),
  });
};

const buildParsedFailureResult = (
  input: ParsedFailureInput,
) => buildFailureResult({
  proofId: input.proofId,
  childCapabilityId: input.childCapabilityId,
  failureReason: input.failureReason,
  writeMode: input.writeMode,
  missionId: input.parsed.missionId,
  runId: input.parsed.runId,
  sessionId: input.parsed.sessionId,
  roundId: input.parsed.roundId,
  stepId: input.parsed.stepId,
  capabilityCallId: input.parsed.capabilityCallId,
  nerveBusEnvelopeId: input.parsed.nerveBusEnvelopeId,
  inputRef: input.parsed.inputRef,
  targetRef: input.parsed.targetRef,
  focusRef: input.parsed.focusRef,
});

function buildInputParseFailureResult(input: TextInputAbilityInput) {
  return buildFailureResult({
    proofId: `ti:proof:parse-fail:${Date.now()}`,
    childCapabilityId: resolveDefaultChildCapabilityId(input),
    failureReason: "input_schema_invalid",
    writeMode: "type_text_once",
    missionId: typeof input.missionId === "string" ? input.missionId : "unknown",
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
    inputRef: typeof input.inputRef === "string" ? input.inputRef : "unknown",
    targetRef: null,
    focusRef: null,
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
    return buildParsedFailureResult({
      parsed,
      childCapabilityId,
      failureReason: "unknown_child_capability",
      writeMode: "type_text_once",
      proofId: `ti:proof:unknown-child:${Date.now()}`,
    });
  }

  try {
    return TextInputAbilityResultSchema.parse(
      await capability.execute(parsed, context),
    );
  } catch {
    return buildParsedFailureResult({
      parsed,
      childCapabilityId,
      failureReason: "child_execution_failed",
      writeMode: capability.writeMode,
      proofId: `ti:proof:exec-fail:${Date.now()}`,
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
