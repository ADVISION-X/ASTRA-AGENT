import { buildStableTextInputRef } from "../shared/text-input-types.js";
import type { ParsedTextInputAbilityInput } from "../contract.js";
import { runPrimitiveTextInput } from "./primitive-text-input-runner.js";
import { buildTextInputExecutionSeed } from "./text-input-input-gate.js";
import type { TextInputRuntimeContext } from "./text-input-runtime-context.js";
import {
  buildClipboardUnavailableFailureResult,
  buildRejectedTextInputResult,
  buildTextInputExecutionResult,
  createInitialDecisionState,
  createTextInputActionExecutionRef,
  mergeFlags,
  restoreClipboardAfterOperation,
  type TextInputExecutionResultDraft,
} from "./text-input-execution-support.js";
import { runTextInputExecutionGates } from "./text-input-execution-gates.js";

export async function executeTextInput(input: {
  request: ParsedTextInputAbilityInput;
  context: TextInputRuntimeContext;
}) {
  const seed = buildTextInputExecutionSeed(input.request);
  const state = createInitialDecisionState(input.request);
  const gateResult = runTextInputExecutionGates({ request: input.request, context: input.context, seed, state });
  if (gateResult !== null) {
    return gateResult;
  }

  const actionExecutionRef = createTextInputActionExecutionRef(seed);
  const usesClipboard = input.request.childCapabilityId === "paste-text"
    || (input.request.childCapabilityId === "replace-input" && input.request.policy.replacePolicy.writeMode === "paste-text");

  let clipboardBackupText: string | null = null;
  let clipboardBackupExists = false;
  let finalResultInput: TextInputExecutionResultDraft | null = null;

  try {
    executeFlow: do {
      if (usesClipboard) {
        const backup = await input.context.clipboardPort.readText();
        if (!backup.ok) {
          state.clipboardDecision = "failed";
          return buildClipboardUnavailableFailureResult({
            seed,
            context: input.context,
            state,
            statusMessage: backup.message,
            dataQualityFlags: ["clipboard_unavailable"],
          });
        }

        clipboardBackupExists = true;
        clipboardBackupText = backup.text;
        state.clipboardDecision = "snapshot_captured";
        state.clipboardSnapshotRef = backup.snapshotRef;
        state.originalClipboardHash = backup.textHash;

        const writeClipboard = await input.context.clipboardPort.writeText(seed.inputText ?? "");
        if (!writeClipboard.ok) {
          state.clipboardDecision = "failed";
          return buildClipboardUnavailableFailureResult({
            seed,
            context: input.context,
            state,
            statusMessage: writeClipboard.message,
            dataQualityFlags: ["clipboard_unavailable"],
          });
        }

        state.clipboardDecision = "prepared";
      }

      if (seed.childCapabilityId === "replace-input") {
        let clearPrimitiveExecutionRef: string | null = null;
        let writePrimitiveExecutionRef: string | null = null;
        let operationRef: string | null = null;

        const clearResult = await runPrimitiveTextInput({
          context: input.context,
          attemptRef: seed.attemptRef,
          actionExecutionRef,
          childCapabilityId: "clear-input",
          targetRef: seed.targetRef,
          targetKind: seed.targetKind,
          inputText: null,
          inputTextHash: null,
          key: null,
          timeoutMs: seed.policy.primitiveTimeoutMs,
        });
        clearPrimitiveExecutionRef = clearResult.primitiveExecutionRef;
        if (!clearResult.ok) {
          state.dataQualityFlags = mergeFlags(state.dataQualityFlags, clearResult.dataQualityFlags);
          finalResultInput = {
            seed,
            refs: {
              actionExecutionRef,
              primitiveExecutionRef: clearResult.primitiveExecutionRef,
              clearPrimitiveExecutionRef,
              writePrimitiveExecutionRef: null,
              operationRef: clearResult.operationRef,
            },
            status: {
              status: "failed",
              failureReason: clearResult.failureReason ?? "primitive_failed",
              reviewRequiredReason: null,
              statusMessage: clearResult.statusMessage,
              policyDecision: state.policyDecision,
            },
            state,
            primitive: {
              primitiveDecision: clearResult.primitiveDecision,
              primitivePortKind: clearResult.primitivePortKind,
              primitiveStartedAt: clearResult.primitiveStartedAt,
              primitiveEndedAt: clearResult.primitiveEndedAt,
            },
            timing: {
              startedAt: clearResult.startedAt,
              endedAt: clearResult.endedAt,
              durationMs: clearResult.durationMs,
              clock: clearResult.clock,
            },
          };
          break executeFlow;
        }

        const writeChildCapabilityId = input.request.policy.replacePolicy.writeMode === "paste-text" ? "paste-text" : "type-text";
        const writeResult = await runPrimitiveTextInput({
          context: input.context,
          attemptRef: seed.attemptRef,
          actionExecutionRef,
          childCapabilityId: writeChildCapabilityId,
          targetRef: seed.targetRef,
          targetKind: seed.targetKind,
          inputText: seed.inputText,
          inputTextHash: seed.inputTextHash,
          key: null,
          timeoutMs: seed.policy.primitiveTimeoutMs,
        });
        writePrimitiveExecutionRef = writeResult.primitiveExecutionRef;
        state.typedTextHash = writeResult.typedTextHash;
        state.keySequenceHash = writeResult.keySequenceHash;
        operationRef = buildStableTextInputRef("text-input-replace-operation", [
          clearPrimitiveExecutionRef,
          writePrimitiveExecutionRef,
          writeChildCapabilityId,
        ]);

        const replacePrimitiveExecutionRef = writeResult.primitiveExecutionRef === null
          ? null
          : buildStableTextInputRef("text-input-replace-primitive", [clearPrimitiveExecutionRef, writeResult.primitiveExecutionRef]);

        state.dataQualityFlags = mergeFlags(
          state.dataQualityFlags,
          clearResult.dataQualityFlags,
          writeResult.dataQualityFlags,
          ["replace_input_composed_clear_then_write"],
        );
        finalResultInput = {
          seed,
          refs: {
            actionExecutionRef,
            primitiveExecutionRef: replacePrimitiveExecutionRef,
            clearPrimitiveExecutionRef,
            writePrimitiveExecutionRef,
            operationRef,
          },
          status: {
            status: writeResult.ok ? "success" : "failed",
            failureReason: writeResult.ok ? null : writeResult.failureReason ?? "primitive_failed",
            reviewRequiredReason: null,
            statusMessage: writeResult.ok
              ? "Text Input replace-input completed as clear followed by governed write."
              : writeResult.statusMessage,
            policyDecision: state.policyDecision,
          },
          state,
          primitive: {
            primitiveDecision: writeResult.primitiveDecision,
            primitivePortKind: writeResult.primitivePortKind,
            primitiveStartedAt: clearResult.primitiveStartedAt,
            primitiveEndedAt: writeResult.primitiveEndedAt,
          },
          timing: {
            startedAt: clearResult.startedAt,
            endedAt: writeResult.endedAt,
            durationMs: clearResult.durationMs + writeResult.durationMs,
            clock: {
              startedMonotonicMs: clearResult.clock.startedMonotonicMs,
              endedMonotonicMs: writeResult.clock.endedMonotonicMs,
            },
          },
        };
        break executeFlow;
      }

      const primitiveResult = await runPrimitiveTextInput({
        context: input.context,
        attemptRef: seed.attemptRef,
        actionExecutionRef,
        childCapabilityId: seed.childCapabilityId,
        targetRef: seed.targetRef,
        targetKind: seed.targetKind,
        inputText: seed.inputText,
        inputTextHash: seed.inputTextHash,
        key: seed.key,
        timeoutMs: seed.policy.primitiveTimeoutMs,
      });
      state.typedTextHash = primitiveResult.typedTextHash;
      state.keySequenceHash = primitiveResult.keySequenceHash;
      state.dataQualityFlags = mergeFlags(state.dataQualityFlags, primitiveResult.dataQualityFlags);

      finalResultInput = {
        seed,
        refs: {
          actionExecutionRef,
          primitiveExecutionRef: primitiveResult.primitiveExecutionRef,
          clearPrimitiveExecutionRef: null,
          writePrimitiveExecutionRef: null,
          operationRef: primitiveResult.operationRef,
        },
        status: {
          status: primitiveResult.ok ? "success" : "failed",
          failureReason: primitiveResult.ok ? null : primitiveResult.failureReason ?? "primitive_failed",
          reviewRequiredReason: null,
          statusMessage: primitiveResult.statusMessage,
          policyDecision: state.policyDecision,
        },
        state,
        primitive: {
          primitiveDecision: primitiveResult.primitiveDecision,
          primitivePortKind: primitiveResult.primitivePortKind,
          primitiveStartedAt: primitiveResult.primitiveStartedAt,
          primitiveEndedAt: primitiveResult.primitiveEndedAt,
        },
        timing: {
          startedAt: primitiveResult.startedAt,
          endedAt: primitiveResult.endedAt,
          durationMs: primitiveResult.durationMs,
          clock: primitiveResult.clock,
        },
      };
      break executeFlow;
    } while (false);
  } finally {
    if (usesClipboard) {
      await restoreClipboardAfterOperation({
        context: input.context,
        request: input.request,
        state,
        backupText: clipboardBackupText,
        backupExists: clipboardBackupExists,
      });
    }
  }

  if (finalResultInput !== null) {
    finalResultInput.state.clipboardDecision = state.clipboardDecision;
    finalResultInput.state.restoredClipboardHash = state.restoredClipboardHash;
    finalResultInput.state.dataQualityFlags = mergeFlags(finalResultInput.state.dataQualityFlags, state.dataQualityFlags);
    return buildTextInputExecutionResult(finalResultInput);
  }

  return buildRejectedTextInputResult({
    seed,
    context: input.context,
    state,
    status: "failed",
    failureReason: "output_boundary_failed",
    reviewRequiredReason: null,
    statusMessage: "Text Input executor exited without a governed result envelope.",
    policyDecision: "block",
    dataQualityFlags: ["executor_missing_result_envelope"],
  });
}