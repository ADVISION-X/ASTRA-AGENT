import { buildRedactedPreview } from "../shared/text-input-redaction.js";
import { buildStableTextInputRef } from "../shared/text-input-types.js";
import type { TextInputResultSeed } from "./text-input-input-gate.js";

export const TEXT_INPUT_REQUEST_DEBUG = "TEXT_INPUT_REQUEST_DEBUG";
export const TEXT_INPUT_EXECUTION_DEBUG = "TEXT_INPUT_EXECUTION_DEBUG";
export const TEXT_INPUT_ERROR_DEBUG = "TEXT_INPUT_ERROR_DEBUG";
export const TEXT_INPUT_CLIPBOARD_DEBUG = "TEXT_INPUT_CLIPBOARD_DEBUG";
export const TEXT_INPUT_COMMIT_DEBUG = "TEXT_INPUT_COMMIT_DEBUG";

export function buildTextInputDebugBundle(input: {
  seed: TextInputResultSeed;
  status: "success" | "failed" | "review_required";
  clipboardDecision: "not_used" | "snapshot_captured" | "prepared" | "restored" | "cleared" | "failed";
  dataQualityFlags: string[];
}) {
  const payloadText = input.seed.inputText ?? input.seed.approvedText ?? "";
  const redactedPreview = payloadText.length > 0
    ? buildRedactedPreview(payloadText, input.seed.policy.redactionPolicy.maxPreviewChars)
    : null;

  const emittedEventTypes = [TEXT_INPUT_REQUEST_DEBUG, TEXT_INPUT_EXECUTION_DEBUG];
  if (input.status !== "success") {
    emittedEventTypes.push(TEXT_INPUT_ERROR_DEBUG);
  }
  if (input.clipboardDecision !== "not_used") {
    emittedEventTypes.push(TEXT_INPUT_CLIPBOARD_DEBUG);
  }
  if (input.seed.childCapabilityId === "commit-input") {
    emittedEventTypes.push(TEXT_INPUT_COMMIT_DEBUG);
  }

  return {
    diagnosticPayloadRef: buildStableTextInputRef("text-input-diagnostic", [
      input.seed.attemptRef,
      input.status,
      input.seed.parseErrorRef,
      input.seed.receivedShapeHash,
      input.dataQualityFlags,
      redactedPreview,
    ]),
    debugLogRef: buildStableTextInputRef("text-input-debug-log", [input.seed.attemptRef, input.status, input.dataQualityFlags]),
    structuredRuntimeEventRef: buildStableTextInputRef("text-input-runtime-event", [input.seed.attemptRef, emittedEventTypes]),
    requestDebugRef: buildStableTextInputRef("text-input-request-debug", [input.seed.attemptRef, input.seed.inputRef]),
    executionDebugRef: buildStableTextInputRef("text-input-execution-debug", [input.seed.attemptRef, input.status]),
    errorDebugRef: input.status === "success"
      ? null
      : buildStableTextInputRef("text-input-error-debug", [input.seed.attemptRef, input.dataQualityFlags]),
    clipboardDebugRef: input.clipboardDecision === "not_used"
      ? null
      : buildStableTextInputRef("text-input-clipboard-debug", [input.seed.attemptRef, input.clipboardDecision]),
    commitDebugRef: input.seed.childCapabilityId === "commit-input"
      ? buildStableTextInputRef("text-input-commit-debug", [input.seed.attemptRef, input.seed.approvedCommitRef])
      : null,
    emittedEventTypes,
    redactedPreview,
  };
}