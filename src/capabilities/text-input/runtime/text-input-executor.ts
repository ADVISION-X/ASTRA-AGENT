import { buildStableTextInputRef } from "../shared/text-input-types.js";
import type { ParsedTextInputAbilityInput } from "../contract.js";
import { validateApprovedText } from "./approved-text-gate.js";
import { validateClipboardPolicy } from "./clipboard-policy-gate.js";
import { validateCommitPolicy } from "./commit-policy-gate.js";
import { validateFocusProof } from "./focus-proof-gate.js";
import { validateInputTargetProof } from "./input-target-proof-gate.js";
import { validateKeyPolicy } from "./key-policy-gate.js";
import { runPrimitiveTextInput } from "./primitive-text-input-runner.js";
import { validateSensitiveText } from "./sensitive-text-gate.js";
import { buildTextInputExecutionSeed } from "./text-input-input-gate.js";
import { buildTextInputResult } from "./text-input-result-builder.js";
import type { TextInputRuntimeContext } from "./text-input-runtime-context.js";
import { validateTextPolicy } from "./text-policy-gate.js";
import { validateTextSourceProof } from "./text-source-proof-gate.js";

type RuntimeDecisionState = {
  policyDecision: "allow" | "block" | "review_required";
  sensitiveTextDecision: "allowed" | "blocked" | "review_required";
  redactionDecision: "masked" | "hash_only" | "none";
  keyPolicyDecision: "allowed" | "blocked_enter" | "blocked_modifier" | "blocked_unknown";
  clipboardDecision: "not_used" | "snapshot_captured" | "prepared" | "restored" | "cleared" | "failed";
  clipboardSnapshotRef: string | null;
  clipboardProofRef: string | null;
  originalClipboardHash: string | null;
  restoredClipboardHash: string | null;
  commitPolicyRef: string | null;
  typedTextHash: string | null;
  keySequenceHash: string | null;
  replaceWriteMode: "type-text" | "paste-text" | null;
  dataQualityFlags: string[];
};

function createInitialDecisionState(request: ParsedTextInputAbilityInput): RuntimeDecisionState {
  return {
    policyDecision: "allow",
    sensitiveTextDecision: "allowed",
    redactionDecision: request.policy.redactionPolicy.mode === "hash_only"
      ? "hash_only"
      : request.policy.redactionPolicy.mode === "none"
        ? "none"
        : "masked",
    keyPolicyDecision: "allowed",
    clipboardDecision: "not_used",
    clipboardSnapshotRef: null,
    clipboardProofRef: null,
    originalClipboardHash: null,
    restoredClipboardHash: null,
    commitPolicyRef: null,
    typedTextHash: null,
    keySequenceHash: null,
    replaceWriteMode: request.childCapabilityId === "replace-input" ? request.policy.replacePolicy.writeMode : null,
    dataQualityFlags: [],
  };
}

function mergeFlags(...groups: string[][]): string[] {
  return [...new Set(groups.flat().filter((value) => value.length > 0))];
}

function buildRejectedTextInputResult(input: {
  seed: ReturnType<typeof buildTextInputExecutionSeed>;
  context: TextInputRuntimeContext;
  state: RuntimeDecisionState;
  status: "failed" | "review_required";
  failureReason: string | null;
  reviewRequiredReason: string | null;
  statusMessage: string;
  policyDecision: "allow" | "block" | "review_required";
  dataQualityFlags: string[];
}) {
  const startedSnapshot = input.context.clock.now();
  const endedSnapshot = input.context.clock.now();

  return buildTextInputResult({
    seed: input.seed,
    actionExecutionRef: null,
    primitiveExecutionRef: null,
    clearPrimitiveExecutionRef: null,
    writePrimitiveExecutionRef: null,
    operationRef: null,
    status: input.status,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    statusMessage: input.statusMessage,
    policyDecision: input.policyDecision,
    sensitiveTextDecision: input.state.sensitiveTextDecision,
    redactionDecision: input.state.redactionDecision,
    keyPolicyDecision: input.state.keyPolicyDecision,
    clipboardDecision: input.state.clipboardDecision,
    clipboardSnapshotRef: input.state.clipboardSnapshotRef,
    clipboardProofRef: input.state.clipboardProofRef,
    originalClipboardHash: input.state.originalClipboardHash,
    restoredClipboardHash: input.state.restoredClipboardHash,
    commitPolicyRef: input.state.commitPolicyRef,
    typedTextHash: input.state.typedTextHash,
    keySequenceHash: input.state.keySequenceHash,
    primitiveDecision: "not_run",
    primitivePortKind: "not-run",
    replaceWriteMode: input.state.replaceWriteMode,
    primitiveStartedAt: null,
    primitiveEndedAt: null,
    startedAt: startedSnapshot.isoTimestamp,
    endedAt: endedSnapshot.isoTimestamp,
    durationMs: Math.max(0, Math.round(endedSnapshot.monotonicMs - startedSnapshot.monotonicMs)),
    clock: { startedMonotonicMs: startedSnapshot.monotonicMs, endedMonotonicMs: endedSnapshot.monotonicMs },
    dataQualityFlags: input.dataQualityFlags,
  });
}

async function restoreClipboardAfterOperation(input: {
  context: TextInputRuntimeContext;
  request: ParsedTextInputAbilityInput;
  state: RuntimeDecisionState;
  backupText: string | null;
  backupExists: boolean;
}) {
  if (!input.backupExists) {
    return;
  }

  if (input.request.policy.clipboardPolicy.restoreStrategy === "clear_after_operation"
    || input.request.policy.clipboardPolicy.clearClipboardAfterOperation === true) {
    const clearResult = await input.context.clipboardPort.writeText("");
    input.state.clipboardDecision = clearResult.ok ? "cleared" : "failed";
    input.state.restoredClipboardHash = clearResult.textHash;
    if (!clearResult.ok) {
      input.state.dataQualityFlags = mergeFlags(input.state.dataQualityFlags, ["clipboard_restore_failed"]);
    }
    return;
  }

  const restoreResult = await input.context.clipboardPort.writeText(input.backupText ?? "");
  input.state.clipboardDecision = restoreResult.ok ? "restored" : "failed";
  input.state.restoredClipboardHash = restoreResult.textHash;
  if (!restoreResult.ok) {
    input.state.dataQualityFlags = mergeFlags(input.state.dataQualityFlags, ["clipboard_restore_failed"]);
  }
}

export async function executeTextInput(input: {
  request: ParsedTextInputAbilityInput;
  context: TextInputRuntimeContext;
}) {
  const seed = buildTextInputExecutionSeed(input.request);
  const state = createInitialDecisionState(input.request);

  const targetGate = validateInputTargetProof({ request: input.request });
  if (!targetGate.ok) {
    return buildRejectedTextInputResult({
      seed,
      context: input.context,
      state,
      status: targetGate.status,
      failureReason: targetGate.failureReason,
      reviewRequiredReason: targetGate.reviewRequiredReason,
      statusMessage: targetGate.statusMessage,
      policyDecision: targetGate.policyDecision,
      dataQualityFlags: targetGate.dataQualityFlags,
    });
  }

  const focusGate = validateFocusProof({
    request: input.request,
    currentIsoTimestamp: input.context.clock.now().isoTimestamp,
  });
  if (!focusGate.ok) {
    return buildRejectedTextInputResult({
      seed,
      context: input.context,
      state,
      status: focusGate.status,
      failureReason: focusGate.failureReason,
      reviewRequiredReason: focusGate.reviewRequiredReason,
      statusMessage: focusGate.statusMessage,
      policyDecision: focusGate.policyDecision,
      dataQualityFlags: focusGate.dataQualityFlags,
    });
  }

  const sourceGate = validateTextSourceProof({ request: input.request });
  if (!sourceGate.ok) {
    return buildRejectedTextInputResult({
      seed,
      context: input.context,
      state,
      status: sourceGate.status,
      failureReason: sourceGate.failureReason,
      reviewRequiredReason: sourceGate.reviewRequiredReason,
      statusMessage: sourceGate.statusMessage,
      policyDecision: sourceGate.policyDecision,
      dataQualityFlags: sourceGate.dataQualityFlags,
    });
  }

  const approvedTextGate = validateApprovedText({ request: input.request });
  if (!approvedTextGate.ok) {
    return buildRejectedTextInputResult({
      seed,
      context: input.context,
      state,
      status: approvedTextGate.status,
      failureReason: approvedTextGate.failureReason,
      reviewRequiredReason: approvedTextGate.reviewRequiredReason,
      statusMessage: approvedTextGate.statusMessage,
      policyDecision: approvedTextGate.policyDecision,
      dataQualityFlags: approvedTextGate.dataQualityFlags,
    });
  }

  const textPolicyGate = validateTextPolicy({ request: input.request });
  if (!textPolicyGate.ok) {
    return buildRejectedTextInputResult({
      seed,
      context: input.context,
      state,
      status: textPolicyGate.status,
      failureReason: textPolicyGate.failureReason,
      reviewRequiredReason: textPolicyGate.reviewRequiredReason,
      statusMessage: textPolicyGate.statusMessage,
      policyDecision: textPolicyGate.policyDecision,
      dataQualityFlags: textPolicyGate.dataQualityFlags,
    });
  }

  const sensitiveGate = validateSensitiveText({ request: input.request });
  if (!sensitiveGate.ok) {
    state.sensitiveTextDecision = sensitiveGate.sensitiveTextDecision;
    state.redactionDecision = sensitiveGate.redactionDecision;
    return buildRejectedTextInputResult({
      seed,
      context: input.context,
      state,
      status: sensitiveGate.status,
      failureReason: sensitiveGate.failureReason,
      reviewRequiredReason: sensitiveGate.reviewRequiredReason,
      statusMessage: sensitiveGate.statusMessage,
      policyDecision: sensitiveGate.policyDecision,
      dataQualityFlags: sensitiveGate.dataQualityFlags,
    });
  }
  state.sensitiveTextDecision = sensitiveGate.sensitiveTextDecision;
  state.redactionDecision = sensitiveGate.redactionDecision;

  const keyGate = validateKeyPolicy({ request: input.request });
  if (!keyGate.ok) {
    state.keyPolicyDecision = keyGate.keyPolicyDecision;
    return buildRejectedTextInputResult({
      seed,
      context: input.context,
      state,
      status: keyGate.status,
      failureReason: keyGate.failureReason,
      reviewRequiredReason: keyGate.reviewRequiredReason,
      statusMessage: keyGate.statusMessage,
      policyDecision: keyGate.policyDecision,
      dataQualityFlags: keyGate.dataQualityFlags,
    });
  }
  state.keyPolicyDecision = keyGate.keyPolicyDecision;

  const commitGate = validateCommitPolicy({ request: input.request });
  if (!commitGate.ok) {
    state.keyPolicyDecision = commitGate.keyPolicyDecision;
    return buildRejectedTextInputResult({
      seed,
      context: input.context,
      state,
      status: commitGate.status,
      failureReason: commitGate.failureReason,
      reviewRequiredReason: commitGate.reviewRequiredReason,
      statusMessage: commitGate.statusMessage,
      policyDecision: commitGate.policyDecision,
      dataQualityFlags: commitGate.dataQualityFlags,
    });
  }
  state.commitPolicyRef = commitGate.commitPolicyRef;

  const clipboardGate = validateClipboardPolicy({ request: input.request });
  if (!clipboardGate.ok) {
    state.clipboardDecision = clipboardGate.clipboardDecision;
    return buildRejectedTextInputResult({
      seed,
      context: input.context,
      state,
      status: clipboardGate.status,
      failureReason: clipboardGate.failureReason,
      reviewRequiredReason: clipboardGate.reviewRequiredReason,
      statusMessage: clipboardGate.statusMessage,
      policyDecision: clipboardGate.policyDecision,
      dataQualityFlags: clipboardGate.dataQualityFlags,
    });
  }
  state.clipboardProofRef = clipboardGate.clipboardProofRef;

  const actionExecutionRef = buildStableTextInputRef("text-input-action", [seed.attemptRef, seed.childCapabilityId]);
  const usesClipboard = input.request.childCapabilityId === "paste-text"
    || (input.request.childCapabilityId === "replace-input" && input.request.policy.replacePolicy.writeMode === "paste-text");

  let clipboardBackupText: string | null = null;
  let clipboardBackupExists = false;
  let finalResultInput: Parameters<typeof buildTextInputResult>[0] | null = null;

  try {
    executeFlow: do {
      if (usesClipboard) {
        const backup = await input.context.clipboardPort.readText();
        if (!backup.ok) {
          state.clipboardDecision = "failed";
          finalResultInput = {
            seed,
            actionExecutionRef: null,
            primitiveExecutionRef: null,
            clearPrimitiveExecutionRef: null,
            writePrimitiveExecutionRef: null,
            operationRef: null,
            status: "failed",
            failureReason: "clipboard_unavailable",
            reviewRequiredReason: null,
            statusMessage: backup.message,
            policyDecision: "block",
            sensitiveTextDecision: state.sensitiveTextDecision,
            redactionDecision: state.redactionDecision,
            keyPolicyDecision: state.keyPolicyDecision,
            clipboardDecision: state.clipboardDecision,
            clipboardSnapshotRef: state.clipboardSnapshotRef,
            clipboardProofRef: state.clipboardProofRef,
            originalClipboardHash: state.originalClipboardHash,
            restoredClipboardHash: state.restoredClipboardHash,
            commitPolicyRef: state.commitPolicyRef,
            typedTextHash: state.typedTextHash,
            keySequenceHash: state.keySequenceHash,
            primitiveDecision: "not_run",
            primitivePortKind: "not-run",
            replaceWriteMode: state.replaceWriteMode,
            primitiveStartedAt: null,
            primitiveEndedAt: null,
            startedAt: input.context.clock.now().isoTimestamp,
            endedAt: input.context.clock.now().isoTimestamp,
            durationMs: 0,
            clock: {
              startedMonotonicMs: input.context.clock.now().monotonicMs,
              endedMonotonicMs: input.context.clock.now().monotonicMs,
            },
            dataQualityFlags: ["clipboard_unavailable"],
          };
          break executeFlow;
        }

        clipboardBackupExists = true;
        clipboardBackupText = backup.text;
        state.clipboardDecision = "snapshot_captured";
        state.clipboardSnapshotRef = backup.snapshotRef;
        state.originalClipboardHash = backup.textHash;

        const writeClipboard = await input.context.clipboardPort.writeText(seed.inputText ?? "");
        if (!writeClipboard.ok) {
          state.clipboardDecision = "failed";
          finalResultInput = {
            seed,
            actionExecutionRef: null,
            primitiveExecutionRef: null,
            clearPrimitiveExecutionRef: null,
            writePrimitiveExecutionRef: null,
            operationRef: null,
            status: "failed",
            failureReason: "clipboard_unavailable",
            reviewRequiredReason: null,
            statusMessage: writeClipboard.message,
            policyDecision: "block",
            sensitiveTextDecision: state.sensitiveTextDecision,
            redactionDecision: state.redactionDecision,
            keyPolicyDecision: state.keyPolicyDecision,
            clipboardDecision: state.clipboardDecision,
            clipboardSnapshotRef: state.clipboardSnapshotRef,
            clipboardProofRef: state.clipboardProofRef,
            originalClipboardHash: state.originalClipboardHash,
            restoredClipboardHash: state.restoredClipboardHash,
            commitPolicyRef: state.commitPolicyRef,
            typedTextHash: state.typedTextHash,
            keySequenceHash: state.keySequenceHash,
            primitiveDecision: "not_run",
            primitivePortKind: "not-run",
            replaceWriteMode: state.replaceWriteMode,
            primitiveStartedAt: null,
            primitiveEndedAt: null,
            startedAt: input.context.clock.now().isoTimestamp,
            endedAt: input.context.clock.now().isoTimestamp,
            durationMs: 0,
            clock: {
              startedMonotonicMs: input.context.clock.now().monotonicMs,
              endedMonotonicMs: input.context.clock.now().monotonicMs,
            },
            dataQualityFlags: ["clipboard_unavailable"],
          };
          break executeFlow;
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
          finalResultInput = {
            seed,
            actionExecutionRef,
            primitiveExecutionRef: clearResult.primitiveExecutionRef,
            clearPrimitiveExecutionRef,
            writePrimitiveExecutionRef: null,
            operationRef: clearResult.operationRef,
            status: "failed",
            failureReason: clearResult.failureReason ?? "primitive_failed",
            reviewRequiredReason: null,
            statusMessage: clearResult.statusMessage,
            policyDecision: state.policyDecision,
            sensitiveTextDecision: state.sensitiveTextDecision,
            redactionDecision: state.redactionDecision,
            keyPolicyDecision: state.keyPolicyDecision,
            clipboardDecision: state.clipboardDecision,
            clipboardSnapshotRef: state.clipboardSnapshotRef,
            clipboardProofRef: state.clipboardProofRef,
            originalClipboardHash: state.originalClipboardHash,
            restoredClipboardHash: state.restoredClipboardHash,
            commitPolicyRef: state.commitPolicyRef,
            typedTextHash: null,
            keySequenceHash: null,
            primitiveDecision: clearResult.primitiveDecision,
            primitivePortKind: clearResult.primitivePortKind,
            replaceWriteMode: state.replaceWriteMode,
            primitiveStartedAt: clearResult.primitiveStartedAt,
            primitiveEndedAt: clearResult.primitiveEndedAt,
            startedAt: clearResult.startedAt,
            endedAt: clearResult.endedAt,
            durationMs: clearResult.durationMs,
            clock: clearResult.clock,
            dataQualityFlags: mergeFlags(state.dataQualityFlags, clearResult.dataQualityFlags),
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

        finalResultInput = {
          seed,
          actionExecutionRef,
          primitiveExecutionRef: replacePrimitiveExecutionRef,
          clearPrimitiveExecutionRef,
          writePrimitiveExecutionRef,
          operationRef,
          status: writeResult.ok ? "success" : "failed",
          failureReason: writeResult.ok ? null : writeResult.failureReason ?? "primitive_failed",
          reviewRequiredReason: null,
          statusMessage: writeResult.ok
            ? "Text Input replace-input completed as clear followed by governed write."
            : writeResult.statusMessage,
          policyDecision: state.policyDecision,
          sensitiveTextDecision: state.sensitiveTextDecision,
          redactionDecision: state.redactionDecision,
          keyPolicyDecision: state.keyPolicyDecision,
          clipboardDecision: state.clipboardDecision,
          clipboardSnapshotRef: state.clipboardSnapshotRef,
          clipboardProofRef: state.clipboardProofRef,
          originalClipboardHash: state.originalClipboardHash,
          restoredClipboardHash: state.restoredClipboardHash,
          commitPolicyRef: state.commitPolicyRef,
          typedTextHash: state.typedTextHash,
          keySequenceHash: state.keySequenceHash,
          primitiveDecision: writeResult.primitiveDecision,
          primitivePortKind: writeResult.primitivePortKind,
          replaceWriteMode: state.replaceWriteMode,
          primitiveStartedAt: clearResult.primitiveStartedAt,
          primitiveEndedAt: writeResult.primitiveEndedAt,
          startedAt: clearResult.startedAt,
          endedAt: writeResult.endedAt,
          durationMs: clearResult.durationMs + writeResult.durationMs,
          clock: {
            startedMonotonicMs: clearResult.clock.startedMonotonicMs,
            endedMonotonicMs: writeResult.clock.endedMonotonicMs,
          },
          dataQualityFlags: mergeFlags(state.dataQualityFlags, clearResult.dataQualityFlags, writeResult.dataQualityFlags, ["replace_input_composed_clear_then_write"]),
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

      finalResultInput = {
        seed,
        actionExecutionRef,
        primitiveExecutionRef: primitiveResult.primitiveExecutionRef,
        clearPrimitiveExecutionRef: null,
        writePrimitiveExecutionRef: null,
        operationRef: primitiveResult.operationRef,
        status: primitiveResult.ok ? "success" : "failed",
        failureReason: primitiveResult.ok ? null : primitiveResult.failureReason ?? "primitive_failed",
        reviewRequiredReason: null,
        statusMessage: primitiveResult.statusMessage,
        policyDecision: state.policyDecision,
        sensitiveTextDecision: state.sensitiveTextDecision,
        redactionDecision: state.redactionDecision,
        keyPolicyDecision: state.keyPolicyDecision,
        clipboardDecision: state.clipboardDecision,
        clipboardSnapshotRef: state.clipboardSnapshotRef,
        clipboardProofRef: state.clipboardProofRef,
        originalClipboardHash: state.originalClipboardHash,
        restoredClipboardHash: state.restoredClipboardHash,
        commitPolicyRef: state.commitPolicyRef,
        typedTextHash: state.typedTextHash,
        keySequenceHash: state.keySequenceHash,
        primitiveDecision: primitiveResult.primitiveDecision,
        primitivePortKind: primitiveResult.primitivePortKind,
        replaceWriteMode: state.replaceWriteMode,
        primitiveStartedAt: primitiveResult.primitiveStartedAt,
        primitiveEndedAt: primitiveResult.primitiveEndedAt,
        startedAt: primitiveResult.startedAt,
        endedAt: primitiveResult.endedAt,
        durationMs: primitiveResult.durationMs,
        clock: primitiveResult.clock,
        dataQualityFlags: mergeFlags(state.dataQualityFlags, primitiveResult.dataQualityFlags),
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
    finalResultInput.clipboardDecision = state.clipboardDecision;
    finalResultInput.restoredClipboardHash = state.restoredClipboardHash;
    finalResultInput.dataQualityFlags = mergeFlags(finalResultInput.dataQualityFlags, state.dataQualityFlags);
    return buildTextInputResult(finalResultInput);
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