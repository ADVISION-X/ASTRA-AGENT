import { decodeBrowserMutationReceipt } from "./browser-mutation-receipt.js";
import { bindBrowserMutationObservation, bindBrowserObservationPacket, browserObservationPacketRevisionBytes, browserMutationTerminalFactShapeValid, type BrowserMutationTerminalFact } from "./browser-observation-receipt.js";
import { decodeKnownGptRateLimitPreflightReply, preflightReceiptObservationHash } from "./browser-special-mutation-receipt.js";
import { submitRecoveryPayload } from "./browser-submit-recovery-payload.js";
import { createHash } from "node:crypto";

import type { BrowserCommandPermit } from "../transport/command-permit.js";
import { canonicalizeBrowserAuthorityValue } from "../transport/browser-authority-frame-codec.js";
import type { BrowserGovernedCommand } from "./browser-command-actor.js";
import type {
  BrowserDomObservationPacketV2,
} from "./browser-dom-intent.js";

const hashValue = (value: unknown): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;

const hashText = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

type BrowserExactCallIdentityInput = Pick<BrowserCommandPermit,
  "jobId" | "attemptId" | "resultRevision" | "writerFenceHash" | "productStepId"
  | "callId" | "childCapabilityId" | "inputHash" | "replayPolicy">;

export const browserExactCallIdentityHash = (
  permit: BrowserExactCallIdentityInput,
): `sha256:${string}` => hashValue([
  permit.jobId,
  permit.resultRevision,
  ...(permit.replayPolicy === "provider-effect-once" ? [] : [permit.attemptId, permit.writerFenceHash]),
  permit.productStepId,
  permit.callId, permit.childCapabilityId, permit.inputHash,
]);

export const browserProviderEffectIdentityHash = (
  permit: BrowserCommandPermit,
  payloadHash: `sha256:${string}`,
): `sha256:${string}` => hashValue([
  permit.jobId,
  permit.resultRevision,
  permit.productStepId,
  permit.callId,
  permit.childCapabilityId,
  permit.inputHash,
  payloadHash,
]);

const observationBinding = (permit: BrowserCommandPermit, packet: unknown) => ({
  exactCallIdentityHash: browserExactCallIdentityHash(permit), targetRefHash: hashText(permit.targetRef),
  documentRefHash: hashText(permit.documentRef), observationRevisionHash: hashText(browserObservationPacketRevisionBytes(
    packet && typeof packet === "object" ? packet as Record<string, unknown> : {})),
});

export const bindBrowserCommandObservationPacket = (
  permit: BrowserCommandPermit,
  command: BrowserGovernedCommand,
  result: unknown,
): unknown => {
  if (command.kind !== "dom-intent") return result;
  if (command.intent.kind === "observe") return bindBrowserObservationPacket(result, command.intent.queries,
    observationBinding(permit, result)) as BrowserDomObservationPacketV2;
  if (command.intent.kind !== "click" || command.intent.postClickObservation === undefined) return result;
  const packet = result && typeof result === "object" ? (result as Record<string, unknown>).postconditionObservation : null;
  return bindBrowserMutationObservation(command, result, observationBinding(permit, packet));
};

const BROWSER_TERMINAL_REPLY_MARGIN_MS = 4_000;
export const BROWSER_POST_SUBMIT_QUIET_MS = 40_000;

export const browserPostSubmitQuietRemainingMs = (
  latestTerminalAt: string | null,
  now = Date.now(),
): number => {
  if (latestTerminalAt === null) return 0;
  const terminalAt = Date.parse(latestTerminalAt);
  if (!Number.isFinite(terminalAt)) throw new Error("BROWSER_TERMINAL_AT_INVALID");
  return Math.max(0, Math.min(BROWSER_POST_SUBMIT_QUIET_MS,
    BROWSER_POST_SUBMIT_QUIET_MS - (now - terminalAt)));
};

export const awaitBrowserPostSubmitQuiet = async (
  readLatestTerminalAt: () => string | null,
): Promise<void> => {
  while (true) {
    const remaining = browserPostSubmitQuietRemainingMs(readLatestTerminalAt());
    if (remaining === 0) return;
    await new Promise<void>((resolve) => globalThis.setTimeout(resolve, remaining));
  }
};

const declaredPostconditionTimeoutMs = (command: BrowserGovernedCommand): number | null => {
  if (command.kind !== "dom-intent") return null;
  const intent = command.intent;
  if (intent.kind === "click") return intent.postClickAttribute?.timeoutMs
    ?? intent.postClickMatch?.timeoutMs ?? intent.postClickObservation?.timeoutMs
    ?? intent.postClickUrl?.timeoutMs ?? 1;
  if (intent.kind === "hover") return intent.postHoverAttribute.timeoutMs ?? 1;
  if (intent.kind === "doubleClick") return intent.postDoubleClickMatch.timeoutMs ?? 1;
  if (intent.kind === "keypress") return intent.postKeypressMatch.timeoutMs ?? 1;
  return null;
};

export const assertBrowserCommandTerminalReplyMargin = (
  permit: BrowserCommandPermit,
  command: BrowserGovernedCommand,
): void => {
  const postconditionTimeoutMs = declaredPostconditionTimeoutMs(command);
  if (postconditionTimeoutMs !== null
    && permit.commandTtlMs < postconditionTimeoutMs + BROWSER_TERMINAL_REPLY_MARGIN_MS) {
    throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  }
};

export const verifyNormalBrowserMutationReply = (
  permit: BrowserCommandPermit, command: BrowserGovernedCommand,
  body: Readonly<Record<string, unknown>>,
): BrowserMutationTerminalFact => {
  const fact = body.mutationReceipt;
  if (!browserMutationTerminalFactShapeValid(fact) || fact.commandId !== permit.commandId) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  const raw = Object.hasOwn(body, "errorCode") ? { errorCode: body.errorCode } : body.result;
  if (fact.terminalReceipt.resultHash !== hashText(canonicalizeBrowserAuthorityValue(raw))) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  if (Object.hasOwn(body, "errorCode")) {
    if (fact.terminalReceipt.terminal !== "rejected" || fact.terminalReceipt.failureCode !== body.errorCode) {
      throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    }
    return fact;
  }
  const preflight = decodeKnownGptRateLimitPreflightReply(permit, command, body.result);
  const bound = bindBrowserCommandObservationPacket(permit, command, preflight.commandResult);
  const mechanical = decodeBrowserMutationReceipt(command, bound, preflightReceiptObservationHash(preflight.commandResult));
  if (Object.entries(mechanical).some(([key, value]) => fact.terminalReceipt[key as keyof typeof mechanical] !== value)) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  const payload = mechanical.terminal === "confirmed" && mechanical.mutationOutcome === "confirmed"
    && permit.childCapabilityId === "submit_exact_gpt_turn_once" ? submitRecoveryPayload(bound) : null;
  if (canonicalizeBrowserAuthorityValue(payload) !== canonicalizeBrowserAuthorityValue(fact.terminalReceipt.submitRecoveryPayload)) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  return fact;
};
