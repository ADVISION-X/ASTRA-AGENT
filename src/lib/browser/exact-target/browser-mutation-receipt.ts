import { gptRetryMutationReceipt, assertGptRetryTerminalPayload, GPT_RETRY_CHILD } from "./browser-gpt-retry-contract.js";
import type { BrowserMutationIdentity } from "./browser-mutation-types.js";
import { BROWSER_ERROR_CODES } from "../protocol/generated/browser-protocol.generated.js";
import { assertSubmitRecoveryPayload } from "./browser-submit-recovery-payload.js";
import type { BrowserGovernedCommand } from "./browser-command-actor.js";
import {
  browserDomCandidateMissingStage, browserInteractionNativeCauseCode,
  browserPostconditionNativeCauseValid,
} from "./browser-interaction-native-cause.js";
import {
  knownRateLimitBlockerReceiptValid,
  unrecognizedGptDialogReceiptValid,
} from "./browser-observation-receipt.js";
import { postconditionEvidenceValid, browserMutationTerminalFactShapeValid, type BrowserMutationTerminalFact, type BrowserMutationTerminalReceipt, observationPostconditionEvidenceValid } from "./browser-observation-receipt.js";

export type BrowserMutationReceipt = Readonly<{
  terminal: "confirmed" | "rejected";
  mutationOutcome: "no" | "confirmed";
  failureCode: string | null;
  nativeCauseCode: string | null;
  physicalInputCount: 0 | 1;
}>;

const DOM_REJECTION_CODES = new Set([
  "BROWSER_DOM_CANDIDATE_MISSING", "BROWSER_DOM_CANDIDATE_AMBIGUOUS",
  "BROWSER_DOM_ACTION_NOT_QUALIFIED", "BROWSER_DOM_NODE_STALE", "BROWSER_DOM_READ_INVALID",
]);

const outgoingIdentityRejectionCode = (value: unknown): boolean =>
  /^BROWSER_DOM_ACTION_OUTGOING_(?:STRUCTURE|PROMPT_HASH|ATTACHMENT_SET)_MISMATCH$/u.test(String(value));

const POSTCONDITION_NATIVE_CAUSES = new Set([
  "BROWSER_DOM_CANDIDATE_MISSING", "BROWSER_DOM_CANDIDATE_AMBIGUOUS",
  "BROWSER_DOM_NODE_STALE", "BROWSER_DOM_READ_INVALID", "DISCONNECTED", "NO_LAYOUT_BOX",
  "DISPLAY_HIDDEN", "VISIBILITY_HIDDEN", "OPACITY_HIDDEN", "HTML_HIDDEN", "ARIA_HIDDEN",
  "INERT", "TEXT_MISMATCH",
]);

const POINTER_ACTIONABILITY_NATIVE_CAUSES = new Set([
  "BROWSER_DOM_CANDIDATE_MISSING", "BROWSER_DOM_NODE_STALE", "BROWSER_DOM_READ_INVALID",
  "BROWSER_DOM_ACTION_NODE_DISCONNECTED", "BROWSER_DOM_ACTION_NO_LAYOUT_BOX",
  "BROWSER_DOM_ACTION_NOT_VISIBLE", "BROWSER_DOM_ACTION_ARIA_HIDDEN", "BROWSER_DOM_ACTION_INERT",
  "BROWSER_DOM_ACTION_DISABLED", "BROWSER_DOM_ACTION_ARIA_DISABLED", "BROWSER_DOM_ACTION_OUTSIDE_VIEWPORT",
  "BROWSER_DOM_ACTION_POINTER_EVENTS_NONE", "BROWSER_DOM_ACTION_HIT_TEST_FAILED",
]);
const KEYBOARD_ACTIONABILITY_NATIVE_CAUSES = new Set([
  "BROWSER_DOM_CANDIDATE_MISSING",
  "BROWSER_DOM_NODE_STALE",
  "BROWSER_DOM_READ_INVALID",
]);

const domActionabilityNativeCauseValid = (
  command: BrowserGovernedCommand,
  value: unknown,
): boolean => {
  if (command.kind !== "dom-intent") return false;
  const pointer = command.intent.kind === "click" || command.intent.kind === "hover"
    || command.intent.kind === "doubleClick";
  return (pointer ? POINTER_ACTIONABILITY_NATIVE_CAUSES : KEYBOARD_ACTIONABILITY_NATIVE_CAUSES)
    .has(String(value));
};

const exactKeys = (value: Readonly<Record<string, unknown>>, expected: readonly string[]): boolean => {
  const keys = Object.keys(value);
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
};

const mutationCommandValid = (command: BrowserGovernedCommand): boolean => command.kind === "file-input"
  || (command.kind === "dom-intent" && ["click", "hover", "doubleClick", "keypress", "fill",
    "acknowledgeKnownGptRateLimit"]
    .includes(command.intent.kind));

const qualificationFailureValid = (
  command: BrowserGovernedCommand,
  failureCode: unknown,
  candidateCount: unknown,
): failureCode is string => {
  if (typeof failureCode !== "string" || !Number.isSafeInteger(candidateCount)) return false;
  if (failureCode === "BROWSER_TARGET_NOT_INTERACTIVE") return candidateCount === 0;
  if (command.kind === "file-input") return failureCode === "BROWSER_FILE_INPUT_NOT_QUALIFIED"
    || (DOM_REJECTION_CODES.has(failureCode) && failureCode !== "BROWSER_DOM_ACTION_NOT_QUALIFIED");
  return (DOM_REJECTION_CODES.has(failureCode) || outgoingIdentityRejectionCode(failureCode))
    && failureCode !== "BROWSER_FILE_INPUT_NOT_QUALIFIED";
};

const qualificationFactsConsistent = (
  value: Readonly<Record<string, unknown>>,
): boolean => {
  const code = value.failureCode;
  const count = value.candidateCount as number;
  const stage = value.qualificationStage;
  if (stage === "candidate-set") {
    if (code === "BROWSER_DOM_CANDIDATE_AMBIGUOUS"
      || (typeof code === "string" && code.endsWith("_MULTIPLE"))) return count >= 2;
    return count === 0 && code !== "BROWSER_FILE_INPUT_NOT_QUALIFIED"
      && code !== "BROWSER_DOM_ACTION_NOT_QUALIFIED";
  }
  return stage === "actionability" && count === 1 && (code === "BROWSER_DOM_ACTION_NOT_QUALIFIED"
    || code === "BROWSER_FILE_INPUT_NOT_QUALIFIED" || outgoingIdentityRejectionCode(code));
};

const domActionKeys = (
  command: Extract<BrowserGovernedCommand, { kind: "dom-intent" }>,
): readonly string[] => {
  if (command.intent.kind === "fill") return ["filled", "retainedValueVerified"];
  if (command.intent.kind === "click") return ["clicked",
    ...(command.intent.postClickObservation?.clickedCandidateAttribute === undefined
      ? [] : ["clickedCandidateAttributeReadback"])];
  if (command.intent.kind === "hover") return ["hovered"];
  if (command.intent.kind === "doubleClick") return ["doubleClicked"];
  if (command.intent.kind === "keypress") return ["keyPressed", "keypressCount"];
  return [];
};

const hasMatchPostcondition = (command: BrowserGovernedCommand): boolean => command.kind === "dom-intent"
  && (command.intent.kind === "doubleClick" || command.intent.kind === "keypress"
    || (command.intent.kind === "click" && command.intent.postClickMatch !== undefined));

const hasObservationPostcondition = (command: BrowserGovernedCommand): boolean =>
  command.kind === "dom-intent" && command.intent.kind === "click"
  && command.intent.postClickObservation !== undefined;

const postconditionEvidenceKeys = [
  "postconditionRawCount", "postconditionEligibleCount", "postconditionRejections",
] as const;

const actionKeys = (command: BrowserGovernedCommand, failed: boolean): readonly string[] => {
  const common = ["candidateCount", "identityRevalidated", "mutationCount", "postconditionVerified"];
  const specific = command.kind === "dom-intent" ? domActionKeys(command) : [];
  if (command.kind !== "file-input" && specific.length === 0) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  const match = hasMatchPostcondition(command);
  const observation = hasObservationPostcondition(command);
  return [...common, ...specific, ...(match ? postconditionEvidenceKeys : []),
    ...(observation ? ["postconditionObservation"] : []),
    ...(failed ? ["failureCode"] : []),
    ...(failed && (match || observation) ? ["nativeCauseCode"] : [])];
};

const clickedAttributeReceiptValid = (
  clickedAttribute: Readonly<{ name: string; equals: string }> | undefined,
  clickedReadback: unknown,
  postconditionVerified: unknown,
): boolean => {
  if (clickedAttribute === undefined) return true;
  if (!clickedReadback || typeof clickedReadback !== "object" || Array.isArray(clickedReadback)) return false;
  const readback = clickedReadback as Readonly<Record<string, unknown>>;
  return exactKeys(readback, ["name", "value", "verified"])
    && readback.name === clickedAttribute.name
    && typeof readback.value === "string"
    && readback.verified === (readback.value === clickedAttribute.equals)
    && (postconditionVerified !== true || readback.verified === true);
};

const domActionReceiptValid = (
  intent: Extract<BrowserGovernedCommand, { kind: "dom-intent" }>["intent"],
  value: Readonly<Record<string, unknown>>,
  clickedAttributeValid: boolean,
): boolean => {
  if (intent.kind === "acknowledgeKnownGptRateLimit") return value.clicked === true;
  if (intent.kind === "click") return value.clicked === true && clickedAttributeValid;
  if (intent.kind === "hover") return value.hovered === true;
  if (intent.kind === "doubleClick") return value.doubleClicked === true;
  if (intent.kind === "keypress") {
    return value.keyPressed === intent.key && value.keypressCount === (intent.repeat ?? 1);
  }
  return intent.kind === "fill"
    && value.filled === true
    && value.retainedValueVerified === value.postconditionVerified;
};

const assertDomActionReceipt = (
  command: Extract<BrowserGovernedCommand, { kind: "dom-intent" }>,
  value: Readonly<Record<string, unknown>>,
): void => {
  const intent = command.intent;
  const clickedAttribute = intent.kind === "click"
    ? intent.postClickObservation?.clickedCandidateAttribute : undefined;
  const clickedReadback = value.clickedCandidateAttributeReadback;
  const clickedAttributeValid = clickedAttributeReceiptValid(
    clickedAttribute, clickedReadback, value.postconditionVerified,
  );
  const valid = domActionReceiptValid(intent, value, clickedAttributeValid);
  if (!valid) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
};

const requiresPhysicalClick = (command: BrowserGovernedCommand): boolean =>
  command.kind === "dom-intent" && command.intent.kind === "click"
    && command.intent.requiredClickPointSelector !== undefined;

const zeroActionReceiptValid = (
  command: BrowserGovernedCommand,
  value: Readonly<Record<string, unknown>>,
): boolean => value.zeroActionSatisfied === true
  && !requiresPhysicalClick(command)
  && (value.candidateCount === 1
    || (command.kind === "dom-intent"
      && command.intent.kind === "acknowledgeKnownGptRateLimit"
      && value.candidateCount === 0))
  && value.identityRevalidated === true
  && value.postconditionVerified === true
  && command.kind === "dom-intent"
  && (!hasMatchPostcondition(command) || postconditionEvidenceValid(command, value))
  && (!hasObservationPostcondition(command) || observationPostconditionEvidenceValid(command, value))
  && exactKeys(value, ["candidateCount", "identityRevalidated", "mutationCount",
    "postconditionVerified", "zeroActionSatisfied",
    ...(hasMatchPostcondition(command) ? postconditionEvidenceKeys : []),
    ...(hasObservationPostcondition(command) ? ["postconditionObservation"] : [])]);

const CANDIDATE_MISSING_STAGE_INTENTS = new Set([
  "click", "hover", "doubleClick", "fill", "keypress", "acknowledgeKnownGptRateLimit",
]);

const candidateMissingStageValid = (
  command: BrowserGovernedCommand,
  value: Readonly<Record<string, unknown>>,
): boolean => value.failureCode === "BROWSER_DOM_CANDIDATE_MISSING"
  && command.kind === "dom-intent" && CANDIDATE_MISSING_STAGE_INTENTS.has(command.intent.kind)
  && browserDomCandidateMissingStage(value.nativeCauseCode) === value.nativeCauseCode;

const qualificationReceiptValid = (
  command: BrowserGovernedCommand,
  value: Readonly<Record<string, unknown>>,
): value is Readonly<Record<string, unknown>> & { failureCode: string } =>
  value.qualificationRejected === true
  && Number.isSafeInteger(value.candidateCount) && (value.candidateCount as number) >= 0
  && value.identityRevalidated === false && value.postconditionVerified === false
  && exactKeys(value, ["candidateCount", "identityRevalidated", "mutationCount",
    "postconditionVerified", "qualificationRejected", "qualificationStage", "failureCode", "nativeCauseCode"])
  && qualificationFailureValid(command, value.failureCode, value.candidateCount)
  && (value.qualificationStage !== "actionability"
    ? value.failureCode === "BROWSER_TARGET_NOT_INTERACTIVE"
      ? value.nativeCauseCode === null
        || browserInteractionNativeCauseCode(value.nativeCauseCode) === value.nativeCauseCode
      : value.nativeCauseCode === null || candidateMissingStageValid(command, value)
    : command.kind === "file-input"
      ? value.nativeCauseCode === null
      : outgoingIdentityRejectionCode(value.failureCode)
        ? value.nativeCauseCode === null
        : domActionabilityNativeCauseValid(command, value.nativeCauseCode))
  && qualificationFactsConsistent(value);

const decodeZeroMutationReceipt = (
  command: BrowserGovernedCommand,
  value: Readonly<Record<string, unknown>>,
  preflightObservationHash: `sha256:${string}` | null,
): BrowserMutationReceipt => {
  if (knownRateLimitBlockerReceiptValid(value, preflightObservationHash)) {
    return Object.freeze({ terminal: "rejected", mutationOutcome: "no",
      failureCode: "BROWSER_KNOWN_GPT_RATE_LIMIT", nativeCauseCode: null,
      physicalInputCount: 0 });
  }
  if (unrecognizedGptDialogReceiptValid(value, preflightObservationHash)) {
    return Object.freeze({ terminal: "rejected", mutationOutcome: "no",
      failureCode: "BROWSER_GPT_DIALOG_UNRECOGNIZED", nativeCauseCode: null,
      physicalInputCount: 0 });
  }
  if (zeroActionReceiptValid(command, value)) {
    return Object.freeze({ terminal: "confirmed", mutationOutcome: "no", failureCode: null,
      nativeCauseCode: null, physicalInputCount: 0 });
  }
  if (qualificationReceiptValid(command, value)) {
    return Object.freeze({
      terminal: "rejected", mutationOutcome: "no", failureCode: value.failureCode,
      nativeCauseCode: value.nativeCauseCode as string | null,
      physicalInputCount: 0,
    });
  }
  throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
};

type DispatchedRejectionState = Readonly<{
  fillReadback: boolean;
  matchPostcondition: boolean;
  observationPostcondition: boolean;
}>;

const dispatchedRejectionState = (
  command: BrowserGovernedCommand,
  value: Readonly<Record<string, unknown>>,
): DispatchedRejectionState => {
  const rejected = value.postconditionVerified === false;
  return {
    fillReadback: command.kind === "dom-intent" && command.intent.kind === "fill"
      && rejected && value.identityRevalidated === false
      && (value.candidateCount === 0 || value.candidateCount === 1 || value.candidateCount === 2),
    matchPostcondition: hasMatchPostcondition(command) && rejected,
    observationPostcondition: hasObservationPostcondition(command) && rejected,
  };
};

const hasDispatchedPostconditionRejection = (state: DispatchedRejectionState): boolean =>
  state.fillReadback || state.matchPostcondition || state.observationPostcondition;

const dispatchedEvidenceValid = (
  command: BrowserGovernedCommand,
  value: Readonly<Record<string, unknown>>,
): boolean => (!hasMatchPostcondition(command) || postconditionEvidenceValid(command, value))
  && (!hasObservationPostcondition(command) || observationPostconditionEvidenceValid(command, value));

const dispatchedEnvelopeValid = (
  command: BrowserGovernedCommand,
  value: Readonly<Record<string, unknown>>,
  rejection: DispatchedRejectionState,
): boolean => {
  const exactIdentity = value.candidateCount === 1 && value.identityRevalidated === true;
  const hasRejection = hasDispatchedPostconditionRejection(rejection);
  const nativeCauseValid = hasRejection
    ? POSTCONDITION_NATIVE_CAUSES.has(String(value.nativeCauseCode))
      || browserPostconditionNativeCauseValid(value.nativeCauseCode)
    : value.nativeCauseCode === undefined;
  return (exactIdentity || rejection.fillReadback) && nativeCauseValid
    && dispatchedEvidenceValid(command, value)
    && value.zeroActionSatisfied !== true && value.qualificationRejected !== true;
};

const assertDispatchedActionReceipt = (
  command: BrowserGovernedCommand,
  value: Readonly<Record<string, unknown>>,
): void => {
  if (command.kind === "dom-intent") assertDomActionReceipt(command, value);
  else if (command.kind !== "file-input") throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
};

const decodeDispatchedMutationReceipt = (
  command: BrowserGovernedCommand,
  value: Readonly<Record<string, unknown>>,
): BrowserMutationReceipt => {
  const rejection = dispatchedRejectionState(command, value);
  if (!dispatchedEnvelopeValid(command, value, rejection)) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  if (value.postconditionVerified === false && value.failureCode !== "BROWSER_POSTCONDITION_FAILED") {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  const expectedKeys = [
    ...actionKeys(command, value.postconditionVerified === false),
    ...(rejection.fillReadback ? ["nativeCauseCode"] : []),
  ];
  if (!exactKeys(value, expectedKeys)) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  assertDispatchedActionReceipt(command, value);
  return Object.freeze({
    terminal: value.postconditionVerified ? "confirmed" : "rejected",
    mutationOutcome: "confirmed",
    failureCode: value.postconditionVerified ? null : "BROWSER_POSTCONDITION_FAILED",
    nativeCauseCode: hasDispatchedPostconditionRejection(rejection)
      ? String(value.nativeCauseCode) : null,
    physicalInputCount: 1,
  });
};

export const decodeBrowserMutationReceipt = (
  command: BrowserGovernedCommand,
  result: unknown,
  preflightObservationHash: `sha256:${string}` | null,
): BrowserMutationReceipt => {
  if (!mutationCommandValid(command)) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  const value = result && typeof result === "object" ? result as Record<string, unknown> : {};
  if (command.kind === "dom-intent" && command.intent.kind === "click" && command.intent.gptStoppedEmpty && value.gptRetryState !== undefined)
    return gptRetryMutationReceipt(command.intent.gptStoppedEmpty, value);
  const mutationCount = value.mutationCount;
  if ((mutationCount !== 0 && mutationCount !== 1) || typeof value.postconditionVerified !== "boolean"
    || (value.zeroActionSatisfied === true && value.qualificationRejected === true)) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  return mutationCount === 0
    ? decodeZeroMutationReceipt(command, value, preflightObservationHash)
    : decodeDispatchedMutationReceipt(command, value);
};

export const verifyBrowserMutationTerminalFact = (
  identity: BrowserMutationIdentity, fact: BrowserMutationTerminalFact,
  expectedBindingHash: `sha256:${string}`, expectedReceiptHash: `sha256:${string}`,
): BrowserMutationTerminalReceipt => {
  if (!browserMutationTerminalFactShapeValid(fact) || fact.commandId !== identity.commandId
    || fact.receiptBindingHash !== expectedBindingHash || fact.receiptHash !== expectedReceiptHash) {
    throw new Error("BROWSER_RECONCILIATION_IDENTITY_MISMATCH");
  }
  const receipt = fact.terminalReceipt;
  if (!terminalCommandFieldsValid(identity, receipt) || !terminalMechanicalFieldsValid(receipt)
    || !terminalOutcomeFieldsValid(receipt) || !terminalNativeCauseValid(receipt.nativeCauseCode))
    throw new Error("BROWSER_RECONCILIATION_RECEIPT_INVALID");
  const confirmedSubmit = receipt.terminal === "confirmed" && receipt.mutationOutcome === "confirmed"
    && identity.childCapabilityId === "submit_exact_gpt_turn_once" && identity.effectScope === "provider_effect";
  if (confirmedSubmit) assertSubmitRecoveryPayload(receipt.submitRecoveryPayload, identity);
  else if (receipt.terminal === "confirmed" && receipt.mutationOutcome === "confirmed"
    && identity.childCapabilityId === GPT_RETRY_CHILD && identity.effectScope === "provider_effect")
    assertGptRetryTerminalPayload(receipt.submitRecoveryPayload, identity);
  else if (receipt.submitRecoveryPayload !== null) throw new Error("BROWSER_RECONCILIATION_RECEIPT_INVALID");
  return receipt;
};

const terminalMechanicalFieldsValid = (receipt: BrowserMutationTerminalReceipt): boolean =>
  typeof receipt.completedAt === "string" && Number.isFinite(Date.parse(receipt.completedAt))
  && new Date(receipt.completedAt).toISOString() === receipt.completedAt
  && typeof receipt.resultHash === "string" && /^sha256:[a-f0-9]{64}$/u.test(receipt.resultHash)
  && [0, 1].includes(receipt.physicalInputCount) && ["confirmed", "rejected"].includes(receipt.terminal)
  && ["no", "confirmed", "dispatched"].includes(receipt.mutationOutcome);
const terminalOutcomeFieldsValid = (receipt: BrowserMutationTerminalReceipt): boolean => {
  if (receipt.mutationOutcome === "no" && receipt.physicalInputCount !== 0) return false;
  if (receipt.mutationOutcome === "confirmed" && receipt.physicalInputCount !== 1) return false;
  return receipt.terminal === "confirmed" ? receipt.failureCode === null && receipt.nativeCauseCode === null
    && receipt.mutationOutcome !== "dispatched" : typeof receipt.failureCode === "string"
    && (BROWSER_ERROR_CODES as readonly string[]).includes(receipt.failureCode);
};
const terminalNativeCauseValid = (code: string | null): boolean => code === null || typeof code === "string"
  && (POSTCONDITION_NATIVE_CAUSES.has(code) || POINTER_ACTIONABILITY_NATIVE_CAUSES.has(code)
    || browserInteractionNativeCauseCode(code) === code || browserPostconditionNativeCauseValid(code)
    || browserDomCandidateMissingStage(code) === code);

const terminalCommandFieldsValid = (identity: BrowserMutationIdentity, receipt: BrowserMutationTerminalReceipt): boolean => {
  const mutationAction = identity.actionId === "browser.file-input.v1"
    || /^browser\.dom\.(?:click|hover|double-click|keypress|fill)\.v1$/u.test(identity.actionId);
  const confirmedNoInput = receipt.terminal === "confirmed" && receipt.mutationOutcome === "no";
  return mutationAction && (!confirmedNoInput || (identity.actionId !== "browser.file-input.v1"
    && identity.effectScope !== "provider_effect"));
};
