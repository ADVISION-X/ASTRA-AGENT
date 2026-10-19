import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";
import { executeClickIntent } from "./dom-pointer-intent-runtime.js";
import { readFixedDocument } from "./dom-fixed-document-read.js";
import type { BrowserDomIntent } from "../exact-target/browser-dom-intent.js";
import type { BrowserCommandPermit } from "../transport/command-permit.js";
import {
  KNOWN_GPT_RATE_LIMIT_ACK,
  KNOWN_GPT_RATE_LIMIT_ACK_HASH,
  KNOWN_GPT_RATE_LIMIT_ACK_SELECTOR,
  KNOWN_GPT_RATE_LIMIT_BODY,
  KNOWN_GPT_RATE_LIMIT_BODY_HASH,
  KNOWN_GPT_RATE_LIMIT_DIALOG_HASH,
  KNOWN_GPT_RATE_LIMIT_DIALOG_SELECTOR,
  KNOWN_GPT_RATE_LIMIT_TITLE,
  KNOWN_GPT_RATE_LIMIT_TITLE_HASH,
  knownGptRateLimitPreflightFactShapeValid,
  knownGptRateLimitPreflightObservationInput,
  type KnownGptRateLimitPreflightFact,
} from "../exact-target/browser-gpt-rate-limit-preflight.js";

type RateLimitIntent = Extract<BrowserDomIntent,
{ kind: "acknowledgeKnownGptRateLimit" | "readKnownGptRateLimitClearance" }>;
type CurrentDocumentAssertion = () => void;

const KNOWN_GPT_RATE_LIMIT_FAILURE = "BROWSER_KNOWN_GPT_RATE_LIMIT";
const GPT_DIALOG_UNRECOGNIZED_FAILURE = "BROWSER_GPT_DIALOG_UNRECOGNIZED";

export const KNOWN_GPT_RATE_LIMIT_DETECTOR = `async function (expected) {
  const visible = (node) => {
    if (!(node instanceof HTMLElement) || !node.isConnected || node.hidden
      || node.getAttribute("aria-hidden") === "true" || node.closest("[inert]")) return false;
    const style = getComputedStyle(node);
    return style.display !== "none" && style.visibility !== "hidden"
      && Number(style.opacity || "1") > 0 && node.getClientRects().length > 0;
  };
  const canonical = (value) => String(value || "").normalize("NFC")
    .replace(/\\s+/gu, " ").trim();
  const actionable = (button) => {
    if (!visible(button) || button.disabled || button.getAttribute("aria-disabled") === "true") return false;
    const style = getComputedStyle(button);
    if (style.pointerEvents === "none") return false;
    const rect = button.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || rect.right <= 0 || rect.bottom <= 0
      || rect.left >= innerWidth || rect.top >= innerHeight) return false;
    const x = Math.min(Math.max(rect.left + rect.width / 2, 0), innerWidth - 1);
    const y = Math.min(Math.max(rect.top + rect.height / 2, 0), innerHeight - 1);
    const hit = document.elementFromPoint(x, y);
    return hit === button || (hit instanceof Node && button.contains(hit));
  };
  const rawDialogs = Array.from(document.querySelectorAll(expected.dialogSelector));
  const eligibleDialogs = rawDialogs.filter(visible);
  const exactLines = [expected.title, ...expected.body, expected.ack];
  const visibleLines = (dialog) => String(dialog.innerText || "").normalize("NFC")
    .split(/\\r?\\n/gu).map(canonical).filter(Boolean);
  const actionableDialogs = eligibleDialogs.filter((dialog) => {
    const lines = visibleLines(dialog);
    return lines.length === exactLines.length
      && lines.every((line, index) => line === exactLines[index]);
  });
  const rawButtons = rawDialogs.flatMap((dialog) => Array.from(dialog.querySelectorAll("button")));
  const eligibleButtons = rawButtons.filter((button) => eligibleDialogs.some((dialog) => dialog.contains(button))
    && visible(button)
    && canonical(button.innerText) === expected.ack);
  const actionableButtons = eligibleButtons.filter(actionable);
  const exact = rawDialogs.length === 1 && eligibleDialogs.length === 1
    && actionableDialogs.length === 1 && rawButtons.length === 1
    && eligibleButtons.length === 1 && actionableButtons.length === 1;
  const state = eligibleDialogs.length === 0 ? "absent" : exact ? "exact_present" : "mismatch";
  const unsigned = {
    schemaVersion: "grasseye.browser.known-gpt-rate-limit-preflight.v2",
    state,
    dialogHash: expected.dialogHash,
    titleHash: expected.titleHash,
    bodyHash: expected.bodyHash,
    acknowledgementHash: expected.acknowledgementHash,
    exactCallIdentityHash: expected.exactCallIdentityHash,
    targetRefHash: expected.targetRefHash,
    documentRefHash: expected.documentRefHash,
    observedAt: new Date().toISOString(),
    dialogRawCount: rawDialogs.length,
    dialogEligibleCount: eligibleDialogs.length,
    dialogActionableCount: actionableDialogs.length,
    acknowledgementButtonRawCount: rawButtons.length,
    acknowledgementButtonEligibleCount: eligibleButtons.length,
    acknowledgementButtonActionableCount: actionableButtons.length,
  };
  const hashInput = [unsigned.schemaVersion, unsigned.state, unsigned.dialogHash,
    unsigned.titleHash, unsigned.bodyHash, unsigned.acknowledgementHash,
    unsigned.exactCallIdentityHash, unsigned.targetRefHash, unsigned.documentRefHash,
    unsigned.observedAt, unsigned.dialogRawCount, unsigned.dialogEligibleCount,
    unsigned.dialogActionableCount, unsigned.acknowledgementButtonRawCount,
    unsigned.acknowledgementButtonEligibleCount, unsigned.acknowledgementButtonActionableCount];
  const digest = await crypto.subtle.digest("SHA-256",
    new TextEncoder().encode(JSON.stringify(hashInput)));
  const observationHash = "sha256:" + Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return { ...unsigned, observationHash };
}`;

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("BROWSER_DOM_READ_INVALID");
  }
  return value as Record<string, unknown>;
};

const sha256 = async (value: string): Promise<`sha256:${string}`> => {
  const result = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return `sha256:${Array.from(new Uint8Array(result))
    .map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
};

export const knownGptRateLimitExactCallIdentityHash = async (
  permit: Pick<BrowserCommandPermit, "jobId" | "attemptId" | "resultRevision" | "writerFenceHash"
  | "productStepId" | "callId" | "childCapabilityId" | "inputHash" | "replayPolicy">,
): Promise<`sha256:${string}`> => sha256(JSON.stringify([
  permit.jobId,
  permit.resultRevision,
  ...(permit.replayPolicy === "provider-effect-once" ? [] : [permit.attemptId, permit.writerFenceHash]),
  permit.productStepId,
  permit.callId,
  permit.childCapabilityId,
  permit.inputHash,
]));

const knownGptRateLimitTargetIdentity = async (
  target: ExtensionExactTarget,
): Promise<Readonly<{
  targetRefHash: `sha256:${string}`;
  documentRefHash: `sha256:${string}`;
}>> => Object.freeze({
  targetRefHash: await sha256(target.targetRef),
  documentRefHash: await sha256(target.documentRef),
});

export const observeKnownGptRateLimitDialog = async (
  runtime: ExtensionDebuggerRuntime, target: ExtensionExactTarget,
  exactCallIdentityHash: `sha256:${string}`, assertCurrent: CurrentDocumentAssertion,
): Promise<KnownGptRateLimitPreflightFact> => {
  const expectedMainFrameLoaderId = target.loaderId;
  const identity = await knownGptRateLimitTargetIdentity(target);
  return readFixedDocument({ runtime, target, expectedMainFrameLoaderId, assertCurrent,
    stage: "rate-limit-preflight", script: KNOWN_GPT_RATE_LIMIT_DETECTOR,
    argument: { dialogSelector: KNOWN_GPT_RATE_LIMIT_DIALOG_SELECTOR,
      title: KNOWN_GPT_RATE_LIMIT_TITLE, body: KNOWN_GPT_RATE_LIMIT_BODY, ack: KNOWN_GPT_RATE_LIMIT_ACK,
      dialogHash: KNOWN_GPT_RATE_LIMIT_DIALOG_HASH, titleHash: KNOWN_GPT_RATE_LIMIT_TITLE_HASH,
      bodyHash: KNOWN_GPT_RATE_LIMIT_BODY_HASH, acknowledgementHash: KNOWN_GPT_RATE_LIMIT_ACK_HASH,
      exactCallIdentityHash, ...identity },
    decode: async (value) => {
      const fact = record(value);
      if (!knownGptRateLimitPreflightFactShapeValid(fact)
        || fact.exactCallIdentityHash !== exactCallIdentityHash
        || fact.targetRefHash !== identity.targetRefHash || fact.documentRefHash !== identity.documentRefHash
        || fact.observationHash !== await sha256(JSON.stringify(knownGptRateLimitPreflightObservationInput(fact)))) {
        throw new Error("BROWSER_DOM_READ_INVALID");
      }
      return Object.freeze(fact);
    },
  });
};

const readKnownGptRateLimitClearance = async (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  exactCallIdentityHash: `sha256:${string}`,
  assertCurrent: CurrentDocumentAssertion,
): Promise<unknown> => {
  const fact = await observeKnownGptRateLimitDialog(runtime, target, exactCallIdentityHash, assertCurrent);
  if (fact.state === "exact_present") throw new Error("BROWSER_GPT_RATE_LIMIT_STILL_PRESENT");
  if (fact.state === "mismatch") return unrecognizedGptDialogReceipt(fact);
  return Object.freeze({
    schemaVersion: "grasseye.browser.known-gpt-rate-limit-clearance.v1",
    state: "confirmed_absent",
    dialogHash: fact.dialogHash,
    targetRefHash: fact.targetRefHash,
    documentRefHash: fact.documentRefHash,
    observationHash: fact.observationHash,
    observedAt: fact.observedAt,
    candidateCount: 0,
    identityRevalidated: true,
    mutationCount: 0,
    postconditionVerified: true,
    zeroActionSatisfied: true,
  });
};

export const knownGptRateLimitBlockerReceipt = (
  fact: KnownGptRateLimitPreflightFact,
): Readonly<Record<string, unknown>> => Object.freeze({
  schemaVersion: "grasseye.browser.known-gpt-rate-limit-blocker.v2",
  failureCode: KNOWN_GPT_RATE_LIMIT_FAILURE,
  nativeCauseCode: null,
  candidateCount: fact.dialogEligibleCount,
  identityRevalidated: true,
  mutationCount: 0,
  physicalInputCount: 0,
  postconditionVerified: false,
  qualificationRejected: true,
  qualificationStage: "candidate-set",
  knownGptRateLimitPreflightFact: fact,
});

export const unrecognizedGptDialogReceipt = (
  fact: KnownGptRateLimitPreflightFact,
): Readonly<Record<string, unknown>> => Object.freeze({
  schemaVersion: "grasseye.browser.gpt-dialog-unrecognized-rejection.v1",
  failureCode: GPT_DIALOG_UNRECOGNIZED_FAILURE,
  nativeCauseCode: null,
  candidateCount: fact.dialogEligibleCount,
  identityRevalidated: true,
  mutationCount: 0,
  physicalInputCount: 0,
  postconditionVerified: false,
  qualificationRejected: true,
  qualificationStage: "candidate-set",
  knownGptRateLimitPreflightFact: fact,
});

export const knownGptRateLimitAbsentEnvelope = (
  fact: KnownGptRateLimitPreflightFact,
  commandResult: unknown,
): Readonly<Record<string, unknown>> => Object.freeze({
  schemaVersion: "grasseye.browser.command-preflight.v1",
  knownGptRateLimitPreflightFact: fact,
  commandResult,
});

const assertRateLimitIdentity = async (
  target: ExtensionExactTarget,
  intent: Extract<RateLimitIntent, { kind: "acknowledgeKnownGptRateLimit" }>,
): Promise<void> => {
  const identity = await knownGptRateLimitTargetIdentity(target);
  if (identity.targetRefHash !== intent.targetRefHash
    || identity.documentRefHash !== intent.documentRefHash) throw new Error("BROWSER_DOCUMENT_INVALID");
};

export const executeKnownGptRateLimitIntent = async (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: RateLimitIntent,
  exactCallIdentityHash: `sha256:${string}`,
  assertCurrent: CurrentDocumentAssertion,
): Promise<unknown> => {
  if (intent.kind === "readKnownGptRateLimitClearance") {
    assertCurrent();
    const result = await readKnownGptRateLimitClearance(runtime, target, exactCallIdentityHash, assertCurrent);
    assertCurrent();
    return result;
  }
  await assertRateLimitIdentity(target, intent);
  const fact = await observeKnownGptRateLimitDialog(runtime, target, exactCallIdentityHash, assertCurrent);
  if (fact.state === "mismatch") return unrecognizedGptDialogReceipt(fact);
  if (fact.state === "absent") return Object.freeze({ candidateCount: 0, identityRevalidated: true,
    mutationCount: 0, postconditionVerified: true, zeroActionSatisfied: true });
  if (fact.targetRefHash !== intent.targetRefHash
    || fact.documentRefHash !== intent.documentRefHash) throw new Error("BROWSER_DOCUMENT_INVALID");
  const dispatchNotAfter = intent.dispatchNotAfter === null
    ? Date.parse(fact.observedAt) + 1_000 : Date.parse(intent.dispatchNotAfter);
  return executeClickIntent(runtime, target, {
    kind: "click", selector: KNOWN_GPT_RATE_LIMIT_ACK_SELECTOR,
    scope: { selector: KNOWN_GPT_RATE_LIMIT_DIALOG_SELECTOR },
    expectedTextEquals: KNOWN_GPT_RATE_LIMIT_ACK, expectedMatches: 1,
    postClickMatch: { selector: KNOWN_GPT_RATE_LIMIT_DIALOG_SELECTOR,
      expectedMatches: 0, timeoutMs: 5_000 },
    postClickMinimumDelayMs: 2_500,
  }, assertCurrent, () => {
    if (Date.now() > dispatchNotAfter) throw new Error("BROWSER_GPT_RATE_LIMIT_ACK_SLO_EXCEEDED");
  }, false);
};
