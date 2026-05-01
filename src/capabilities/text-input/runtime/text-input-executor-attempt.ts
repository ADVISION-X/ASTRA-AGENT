import type { ParsedTextInputAbilityInput } from "../contract.js";
import type { TextInputRuntimeContext } from "./text-input-runtime-context.js";
import type { TextInputExecutionResultDraft, TextInputRuntimeDecisionState } from "./text-input-execution-support.js";
import { restoreClipboardAfterOperation } from "./text-input-execution-support.js";
import { prepareTextInputClipboardExecution } from "./text-input-executor-clipboard.js";
import { executeReplaceInputOperation } from "./text-input-executor-replace.js";
import { executeSinglePrimitiveOperation } from "./text-input-executor-single.js";
import type { TextInputResultSeed } from "./text-input-input-gate.js";

export async function executeTextInputAttempt(input: {
  request: ParsedTextInputAbilityInput;
  context: TextInputRuntimeContext;
  seed: TextInputResultSeed;
  state: TextInputRuntimeDecisionState;
  actionExecutionRef: string;
}) {
  const usesClipboard = input.request.childCapabilityId === "paste-text"
    || (input.request.childCapabilityId === "replace-input" && input.request.policy.replacePolicy.writeMode === "paste-text");

  let clipboardBackupText: string | null = null;
  let clipboardBackupExists = false;

  try {
    const clipboardPreparation = await prepareTextInputClipboardExecution({
      request: input.request,
      seed: input.seed,
      context: input.context,
      state: input.state,
      usesClipboard,
    });

    clipboardBackupText = clipboardPreparation.backupText;
    clipboardBackupExists = clipboardPreparation.backupExists;

    if (!clipboardPreparation.ok) {
      return clipboardPreparation.failureResult;
    }

    return input.seed.childCapabilityId === "replace-input"
      ? await executeReplaceInputOperation({
        context: input.context,
        seed: input.seed,
        actionExecutionRef: input.actionExecutionRef,
        state: input.state,
      })
      : await executeSinglePrimitiveOperation({
        context: input.context,
        seed: input.seed,
        actionExecutionRef: input.actionExecutionRef,
        state: input.state,
      });
  } finally {
    if (usesClipboard) {
      await restoreClipboardAfterOperation({
        context: input.context,
        request: input.request,
        state: input.state,
        backupText: clipboardBackupText,
        backupExists: clipboardBackupExists,
      });
    }
  }
}
