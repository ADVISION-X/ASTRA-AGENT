import type { ParsedTextInputAbilityInput } from "../contract.js";
import type { TextInputResultSeed } from "./text-input-input-gate.js";
import type { TextInputRuntimeContext } from "./text-input-runtime-context.js";
import type { TextInputRuntimeDecisionState } from "./text-input-execution-support.js";
import { buildClipboardUnavailableFailureResult } from "./text-input-execution-support.js";

type ClipboardPreparationResult =
  | {
      ok: true;
      backupText: string | null;
      backupExists: boolean;
    }
  | {
      ok: false;
      backupText: string | null;
      backupExists: boolean;
      failureResult: ReturnType<typeof buildClipboardUnavailableFailureResult>;
    };

async function captureTextInputClipboardBackup(input: {
  seed: TextInputResultSeed;
  context: TextInputRuntimeContext;
  state: TextInputRuntimeDecisionState;
}) {
  const backup = await input.context.clipboardPort.readText();
  if (backup.ok) {
    input.state.clipboardDecision = "snapshot_captured";
    input.state.clipboardSnapshotRef = backup.snapshotRef;
    input.state.originalClipboardHash = backup.textHash;
    return {
      ok: true as const,
      backupText: backup.text,
    };
  }

  input.state.clipboardDecision = "failed";
  return {
    ok: false as const,
    failureResult: buildClipboardUnavailableFailureResult({
      seed: input.seed,
      context: input.context,
      state: input.state,
      statusMessage: backup.message,
      dataQualityFlags: ["clipboard_unavailable"],
    }),
  };
}

async function writeTextInputClipboardSnapshot(input: {
  seed: TextInputResultSeed;
  context: TextInputRuntimeContext;
  state: TextInputRuntimeDecisionState;
}) {
  const writeClipboard = await input.context.clipboardPort.writeText(input.seed.inputText ?? "");
  if (writeClipboard.ok) {
    input.state.clipboardDecision = "prepared";
    return {
      ok: true as const,
    };
  }

  input.state.clipboardDecision = "failed";
  return {
    ok: false as const,
    failureResult: buildClipboardUnavailableFailureResult({
      seed: input.seed,
      context: input.context,
      state: input.state,
      statusMessage: writeClipboard.message,
      dataQualityFlags: ["clipboard_unavailable"],
    }),
  };
}

export async function prepareTextInputClipboardExecution(input: {
  request: ParsedTextInputAbilityInput;
  seed: TextInputResultSeed;
  context: TextInputRuntimeContext;
  state: TextInputRuntimeDecisionState;
  usesClipboard: boolean;
}): Promise<ClipboardPreparationResult> {
  if (!input.usesClipboard) {
    return {
      ok: true as const,
      backupText: null,
      backupExists: false,
    };
  }

  const backupResult = await captureTextInputClipboardBackup({
    seed: input.seed,
    context: input.context,
    state: input.state,
  });
  if (!backupResult.ok) {
    return {
      ok: false as const,
      backupText: null,
      backupExists: false,
      failureResult: backupResult.failureResult,
    };
  }

  const writeResult = await writeTextInputClipboardSnapshot({
    seed: input.seed,
    context: input.context,
    state: input.state,
  });
  if (!writeResult.ok) {
    return {
      ok: false as const,
      backupText: backupResult.backupText,
      backupExists: true,
      failureResult: writeResult.failureResult,
    };
  }

  return {
    ok: true as const,
    backupText: backupResult.backupText,
    backupExists: true,
  };
}