import { browserInteractionNativeCauseCode } from "../exact-target/browser-interaction-native-cause.js";
import { assertValidCommandPermit, type BrowserCommandPermit } from "../transport/command-permit.js";
import { canonicalizeBrowserAuthorityValue } from "../transport/browser-authority-frame-codec.js";
import { decodeBrowserMutationReceipt } from "../exact-target/browser-mutation-receipt.js";
import { bindBrowserMutationObservation, browserObservationPacketRevisionBytes, browserMutationTerminalFactBytes,
  type BrowserMutationTerminalFact, type BrowserMutationTerminalReceipt } from "../exact-target/browser-observation-receipt.js";
import { knownGptRateLimitPreflightFactShapeValid, knownGptRateLimitPreflightObservationInput } from "../exact-target/browser-gpt-rate-limit-preflight.js";
import { submitRecoveryPayload } from "../exact-target/browser-submit-recovery-payload.js";
import { admitExtensionCommand } from "./command-registry.js";
import type { ExtensionTargetAuthority } from "./extension-target-authority.js";
import { knownGptRateLimitExactCallIdentityHash } from "./gpt-rate-limit-dialog.js";
import { asRecord, browserCommandErrorCode, hashBrowserExtensionText } from "./websocket-actor-crypto.js";
import { extensionCommandDiagnostic, type ExtensionCommandStage } from "./websocket-command-diagnostic.js";
import type { BrowserGovernedCommand } from "../exact-target/browser-command-actor.js";
import { executeAuthenticatedMedia } from "./authenticated-media-runtime.js";
import { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import { executeRegisteredDomIntent } from "./dom-intent-runtime.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";
import { executeExtensionFileInput } from "./extension-file-input-runtime.js";
import { executeBoundedBrowserWait } from "./extension-target-observation.js";

type CommandLifecycle = Readonly<{ assertCurrent(): void; parkTarget(): Promise<void> }>;

export const executeRegisteredExtensionCommand = async (
  runtime: ExtensionDebuggerRuntime, target: ExtensionExactTarget,
  command: Exclude<BrowserGovernedCommand, { kind: "dom-intent" }>, lifecycle: CommandLifecycle,
): Promise<unknown> => {
  switch (command.kind) {
    case "observe": {
      const result = await executeRegisteredDomIntent(runtime, target, { kind: "document" }, lifecycle.assertCurrent);
      lifecycle.assertCurrent(); return result;
    }
    case "wait": return command.transientDomConfirmationStage === undefined ? executeBoundedBrowserWait(command.durationMs)
      : { stage: command.transientDomConfirmationStage, waitedMs: command.transientDomConfirmationStage === 1 ? 1_500 : 3_000 };
    case "park-target": await lifecycle.parkTarget(); return { parked: true };
    case "file-input": return executeExtensionFileInput({ runtime, target, assertCurrent: lifecycle.assertCurrent,
      selector: command.selector, activation: command.activation, approvedFiles: command.approvedFiles, resolvedFilePaths: command.resolvedFilePaths });
    case "authenticated-media": return executeAuthenticatedMedia(runtime, target, command.canonicalConversationUrl,
      command.userTurnId, command.semanticMediaId, lifecycle.assertCurrent);
    default: throw new Error("BROWSER_FILE_GRANT_INVALID");
  }
};

/** Constructs the original wire fact; claim disposal belongs after the worker fixes and sends it. */
export const executeExtensionCommandReply = async (input: Readonly<{
  payload: Readonly<Record<string, unknown>>; permit: BrowserCommandPermit;
  receiptBindingHash: `sha256:${string}` | null; targetAuthority: ExtensionTargetAuthority;
  assertCommandActive(): void; deadline: number; requestSequence: number;
}>): Promise<Readonly<{ body: Record<string, unknown>; diagnostic: Record<string, unknown> | null }>> => {
  const { permit } = input;
  let command: BrowserGovernedCommand | null = null, stage: ExtensionCommandStage = "command-shape";
  let result: unknown, failure: unknown = null;
  let mechanical: Omit<BrowserMutationTerminalReceipt, "schemaVersion" | "completedAt" | "resultHash" | "submitRecoveryPayload"> | null = null;
  let recoveryPayload: Readonly<Record<string, unknown>> | null = null;
  try {
    input.assertCommandActive();
    const candidate = asRecord(input.payload.command);
    if (!candidate || !["dom-intent", "observe", "screenshot", "file-input", "authenticated-media", "wait", "park-target"].includes(String(candidate.kind))) {
      throw new Error("BROWSER_CAPABILITY_REJECTED");
    }
    command = candidate as BrowserGovernedCommand;
    stage = "command-admission";
    const registered = await admitExtensionCommand({ command, permit });
    stage = "target-resolution";
    const target = input.targetAuthority.resolve(permit.targetRef, permit.documentRef);
    stage = "registered-command";
    const identity = await knownGptRateLimitExactCallIdentityHash(permit);
    result = await input.targetAuthority.executeRegisteredCommand(command, target, registered.mutationClass,
      identity, input.assertCommandActive, input.deadline);
    if (input.receiptBindingHash !== null) {
      const projection = await projectExtensionMutation(permit, command, result, identity);
      mechanical = projection.receipt; recoveryPayload = projection.payload;
    }
  } catch (error) {
    failure = error;
    if (input.receiptBindingHash !== null) mechanical = mutationExceptionReceipt(error, result);
  }
  const code = input.receiptBindingHash === null
    ? browserInteractionNativeCauseCode(failure) ?? browserCommandErrorCode(failure) : browserCommandErrorCode(failure);
  const terminalRaw = failure === null ? result : { errorCode: code };
  let mutationReceipt: BrowserMutationTerminalFact | null = null;
  if (input.receiptBindingHash !== null && mechanical !== null) {
    const terminalReceipt: BrowserMutationTerminalReceipt = Object.freeze({
      schemaVersion: "grasseye.browser.command-terminal-receipt.v1", ...mechanical,
      completedAt: new Date().toISOString(),
      resultHash: await hashBrowserExtensionText(canonicalizeBrowserAuthorityValue(terminalRaw)), submitRecoveryPayload: recoveryPayload,
    });
    const unsigned = { commandId: permit.commandId, receiptBindingHash: input.receiptBindingHash, terminalReceipt };
    mutationReceipt = Object.freeze({ type: "fact", ...unsigned,
      receiptHash: await hashBrowserExtensionText(browserMutationTerminalFactBytes(unsigned)) });
  }
  return { body: { requestSequence: input.requestSequence, permitSequence: permit.sequence,
    replyChannelToken: permit.replyChannelToken, mutationReceipt,
    ...(failure === null ? { result } : { errorCode: code }) },
  diagnostic: failure === null ? null : extensionCommandDiagnostic({ reasonCode: code!, failedFrameSequence: input.requestSequence,
    commandStage: stage, commandKind: command?.kind ?? null,
    capabilityId: permit.capabilityId }) };
};

export const readExtensionCommandPayload = (payload: Readonly<Record<string, unknown>>, frameDeadline: string) => {
  if (Object.keys(payload).sort().join("|") !== "command|permit|receiptBindingHash") throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  const permit = asRecord(payload.permit) as BrowserCommandPermit | null;
  if (!permit) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  assertValidCommandPermit(permit);
  const binding = payload.receiptBindingHash;
  const valid = typeof binding === "string" && /^sha256:[a-f0-9]{64}$/u.test(binding);
  if (permit.mutationClass === "mutation" ? !valid : binding !== null) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  const deadline = Date.parse(frameDeadline);
  if (!Number.isFinite(deadline) || new Date(deadline).toISOString() !== frameDeadline) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  return { permit, receiptBindingHash: binding as `sha256:${string}` | null, deadline };
};

const projectExtensionMutation = async (
  permit: BrowserCommandPermit, command: BrowserGovernedCommand, result: unknown, exactCallIdentityHash: `sha256:${string}`,
) => {
  const record = asRecord(result), raw = record?.schemaVersion === "grasseye.browser.command-preflight.v1" ? record.commandResult : result;
  const fact = asRecord(raw)?.knownGptRateLimitPreflightFact;
  const observationHash = knownGptRateLimitPreflightFactShapeValid(fact)
    ? await hashBrowserExtensionText(JSON.stringify(knownGptRateLimitPreflightObservationInput(fact))) : null;
  const packet = asRecord(asRecord(raw)?.postconditionObservation) ?? {};
  const [targetRefHash, documentRefHash, observationRevisionHash] = await Promise.all([
    hashBrowserExtensionText(permit.targetRef), hashBrowserExtensionText(permit.documentRef),
    hashBrowserExtensionText(browserObservationPacketRevisionBytes(packet)),
  ]);
  const bound = bindBrowserMutationObservation(command, raw, { exactCallIdentityHash, targetRefHash, documentRefHash, observationRevisionHash });
  const receipt = decodeBrowserMutationReceipt(command, bound, observationHash);
  const payload = receipt.terminal === "confirmed" && receipt.mutationOutcome === "confirmed"
    && permit.childCapabilityId === "submit_exact_gpt_turn_once" ? submitRecoveryPayload(bound) : null;
  return { receipt, payload };
};

const mutationExceptionReceipt = (error: unknown, result: unknown) => {
  const details = error as { browserInputStarted?: boolean; browserPhysicalInputCount?: number } | null;
  const record = asRecord(result), raw = asRecord(record?.commandResult) ?? record;
  const physicalInputCount: 0 | 1 = details?.browserPhysicalInputCount === 1 || raw?.mutationCount === 1 ? 1 : 0;
  const started = details?.browserInputStarted === true || physicalInputCount === 1;
  return { terminal: "rejected" as const, mutationOutcome: started ? "dispatched" as const : "no" as const,
    physicalInputCount, failureCode: browserCommandErrorCode(error), nativeCauseCode: browserInteractionNativeCauseCode(error) };
};
