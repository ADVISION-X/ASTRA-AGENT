import type {
  VisualTargetAbilityGroup,
  VisualTargetAbilityInput,
  VisualTargetAbilityResult,
} from "./contract.js";
import { VisualTargetAbilityResultSchema } from "./schema.js";
import { createVisualTargetCapabilityRegistry, listVisualTargetChildren } from "./registry.js";
import { dispatchParsedVisualTargetFailure, dispatchVisualTargetInvalidInputFailure } from "./runtime/visual-target-dispatch-failure.js";
import { formatVisualTargetParseIssues, parseVisualTargetAbilityInput } from "./runtime/visual-target-input-gate.js";
import type { VisualTargetRuntimeContext } from "./runtime/visual-target-runtime-context.js";

type CreateVisualTargetAbilityGroupInput = {
  runtimeContext: VisualTargetRuntimeContext;
};

function emitVisualTargetInputProbe(input: {
  stage: string;
  details: Record<string, unknown>;
}): void {
  if (process.env.GRASSEYE_VISUAL_TARGET_INPUT_PROBE !== "1") {
    return;
  }

  console.warn(
    `[grasseye:visual-target-input-probe] stage=${input.stage}; details=${JSON.stringify(input.details)}`,
  );
}

export function createVisualTargetAbilityGroup(input: CreateVisualTargetAbilityGroupInput): VisualTargetAbilityGroup {
  const registry = createVisualTargetCapabilityRegistry();
  const context = input.runtimeContext;

  return {
    listChildCapabilityIds: () => listVisualTargetChildren(),
    execute: (inputValue) => executeVisualTargetAbilityGroupInput(inputValue, context, registry),
  };
}

async function executeVisualTargetAbilityGroupInput(
  inputValue: unknown,
  context: VisualTargetRuntimeContext,
  registry: ReturnType<typeof createVisualTargetCapabilityRegistry>,
): Promise<VisualTargetAbilityResult> {
  const parsed = parseVisualTargetAbilityInput(inputValue);
  if (!parsed.success) {
    emitVisualTargetInputProbe({
      stage: "ability_input_parse_failed",
      details: {
        childCapabilityId: typeof inputValue === "object" && inputValue !== null && "childCapabilityId" in inputValue
          ? (inputValue as { childCapabilityId?: unknown }).childCapabilityId
          : null,
        issues: parsed.error.issues,
      },
    });
    return dispatchVisualTargetInvalidInputFailure({
      rawInput: inputValue,
      clock: context.clock,
      parseError: formatVisualTargetParseIssues(inputValue),
      statusMessage: "Visual Target rejected invalid input schema.",
    });
  }

  const capability = registry.get(parsed.data.childCapabilityId);
  if (!capability) {
    return dispatchParsedVisualTargetFailure({
      request: parsed.data,
      clock: context.clock,
      failureReason: "unknown_child_capability",
      statusMessage: `Visual Target child capability is not registered for ${parsed.data.childCapabilityId}.`,
    });
  }

  try {
    return VisualTargetAbilityResultSchema.parse(await capability.execute(parsed.data, context));
  } catch (error) {
    return dispatchParsedVisualTargetFailure({
      request: parsed.data,
      clock: context.clock,
      failureReason: "child_execution_failed",
      statusMessage: error instanceof Error ? error.message : "Visual Target child execution failed.",
    });
  }
}
