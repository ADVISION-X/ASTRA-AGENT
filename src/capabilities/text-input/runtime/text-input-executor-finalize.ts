import { buildRejectedTextInputResult, buildTextInputExecutionResult, mergeFlags, type TextInputExecutionResultDraft, type TextInputRuntimeDecisionState } from "./text-input-execution-support.js";
import type { TextInputResultSeed } from "./text-input-input-gate.js";
import type { TextInputRuntimeContext } from "./text-input-runtime-context.js";

export function finalizeTextInputExecutionResult(input: {
  executionResult: TextInputExecutionResultDraft | null;
  seed: TextInputResultSeed;
  context: TextInputRuntimeContext;
  state: TextInputRuntimeDecisionState;
}) {
  if (input.executionResult === null) {
    return buildRejectedTextInputResult({
      seed: input.seed,
      context: input.context,
      state: input.state,
      status: "failed",
      failureReason: "output_boundary_failed",
      reviewRequiredReason: null,
      statusMessage: "Text Input executor exited without a governed result envelope.",
      policyDecision: "block",
      dataQualityFlags: ["executor_missing_result_envelope"],
    });
  }

  input.executionResult.state.clipboardDecision = input.state.clipboardDecision;
  input.executionResult.state.restoredClipboardHash = input.state.restoredClipboardHash;
  input.executionResult.state.dataQualityFlags = mergeFlags(input.executionResult.state.dataQualityFlags, input.state.dataQualityFlags);
  return buildTextInputExecutionResult(input.executionResult);
}
