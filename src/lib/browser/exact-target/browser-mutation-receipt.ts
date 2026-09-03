import type { BrowserGovernedCommand } from "./browser-command-actor.js";

export type BrowserMutationReceipt = Readonly<{
  terminal: "confirmed" | "rejected";
  mutationOutcome: "no" | "confirmed";
  failureCode: string | null;
  nativeCauseCode: string | null;
}>;

const DOM_REJECTION_CODES = new Set([
  "BROWSER_DOM_CANDIDATE_MISSING",
  "BROWSER_DOM_CANDIDATE_AMBIGUOUS",
  "BROWSER_DOM_ACTION_NOT_QUALIFIED",
  "BROWSER_DOM_NODE_STALE",
  "BROWSER_DOM_READ_INVALID",
]);

const POSTCONDITION_NATIVE_CAUSES = new Set([
  "BROWSER_DOM_CANDIDATE_MISSING",
  "BROWSER_DOM_CANDIDATE_AMBIGUOUS",
  "BROWSER_DOM_NODE_STALE",
  "BROWSER_DOM_READ_INVALID",
  "DISCONNECTED",
  "NO_LAYOUT_BOX",
  "DISPLAY_HIDDEN",
  "VISIBILITY_HIDDEN",
  "OPACITY_HIDDEN",
  "HTML_HIDDEN",
  "ARIA_HIDDEN",
  "INERT",
  "TEXT_MISMATCH",
]);

const POSTCONDITION_REJECTION_REASONS = new Set([
  "DISCONNECTED", "NO_LAYOUT_BOX", "DISPLAY_HIDDEN", "VISIBILITY_HIDDEN", "OPACITY_HIDDEN",
  "HTML_HIDDEN", "ARIA_HIDDEN", "INERT", "TEXT_MISMATCH",
]);

const POINTER_ACTIONABILITY_NATIVE_CAUSES = new Set([
  "BROWSER_DOM_CANDIDATE_MISSING",
  "BROWSER_DOM_NODE_STALE",
  "BROWSER_DOM_READ_INVALID",
  "BROWSER_DOM_ACTION_NODE_DISCONNECTED",
  "BROWSER_DOM_ACTION_NO_LAYOUT_BOX",
  "BROWSER_DOM_ACTION_NOT_VISIBLE",
  "BROWSER_DOM_ACTION_ARIA_HIDDEN",
  "BROWSER_DOM_ACTION_INERT",
  "BROWSER_DOM_ACTION_DISABLED",
  "BROWSER_DOM_ACTION_ARIA_DISABLED",
  "BROWSER_DOM_ACTION_OUTSIDE_VIEWPORT",
  "BROWSER_DOM_ACTION_POINTER_EVENTS_NONE",
  "BROWSER_DOM_ACTION_HIT_TEST_FAILED",
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
  || (command.kind === "dom-intent" && ["click", "hover", "doubleClick", "keypress", "fill"]
    .includes(command.intent.kind));

const qualificationFailureValid = (
  command: BrowserGovernedCommand,
  failureCode: unknown,
  candidateCount: unknown,
): failureCode is string => {
  if (typeof failureCode !== "string" || !Number.isSafeInteger(candidateCount)) return false;
  if (command.kind === "file-input") return failureCode === "BROWSER_FILE_INPUT_NOT_QUALIFIED"
    || (DOM_REJECTION_CODES.has(failureCode) && failureCode !== "BROWSER_DOM_ACTION_NOT_QUALIFIED");
  return DOM_REJECTION_CODES.has(failureCode) && failureCode !== "BROWSER_FILE_INPUT_NOT_QUALIFIED";
};

const qualificationFactsConsistent = (value: Readonly<Record<string, unknown>>): boolean => {
  const code = value.failureCode;
  const count = value.candidateCount as number;
  const stage = value.qualificationStage;
  if (stage === "candidate-set") {
    if (code === "BROWSER_DOM_CANDIDATE_AMBIGUOUS") return count >= 2;
    return count === 0 && code !== "BROWSER_FILE_INPUT_NOT_QUALIFIED"
      && code !== "BROWSER_DOM_ACTION_NOT_QUALIFIED";
  }
  return stage === "actionability" && count === 1
    && (code === "BROWSER_DOM_ACTION_NOT_QUALIFIED" || code === "BROWSER_FILE_INPUT_NOT_QUALIFIED");
};

const domActionKeys = (
  command: Extract<BrowserGovernedCommand, { kind: "dom-intent" }>,
): readonly string[] => {
  if (command.intent.kind === "fill") return ["filled", "retainedValueVerified"];
  if (command.intent.kind === "click") return ["clicked"];
  if (command.intent.kind === "hover") return ["hovered"];
  if (command.intent.kind === "doubleClick") return ["doubleClicked"];
  if (command.intent.kind === "keypress") return ["keyPressed", "keypressCount"];
  return [];
};

const hasMatchPostcondition = (command: BrowserGovernedCommand): boolean => command.kind === "dom-intent"
  && (command.intent.kind === "doubleClick" || command.intent.kind === "keypress"
    || (command.intent.kind === "click" && command.intent.postClickMatch !== undefined));

const postconditionEvidenceKeys = [
  "postconditionRawCount", "postconditionEligibleCount", "postconditionRejections",
] as const;

const expectedMatchCount = (command: BrowserGovernedCommand): number | null => {
  if (command.kind !== "dom-intent") return null;
  if (command.intent.kind === "click") return command.intent.postClickMatch?.expectedMatches ?? null;
  if (command.intent.kind === "doubleClick") return command.intent.postDoubleClickMatch.expectedMatches;
  if (command.intent.kind === "keypress") return command.intent.postKeypressMatch.expectedMatches;
  return null;
};

const postconditionEvidenceValid = (
  command: BrowserGovernedCommand,
  value: Readonly<Record<string, unknown>>,
): boolean => {
  const expected = expectedMatchCount(command);
  if (!Number.isSafeInteger(value.postconditionRawCount) || (value.postconditionRawCount as number) < 0
    || !Number.isSafeInteger(value.postconditionEligibleCount) || (value.postconditionEligibleCount as number) < 0
    || (value.postconditionEligibleCount as number) > (value.postconditionRawCount as number)
    || !Array.isArray(value.postconditionRejections)
    || value.postconditionRejections.length !== (value.postconditionRawCount as number)
      - (value.postconditionEligibleCount as number) || expected === null
    || value.postconditionVerified !== ((value.postconditionEligibleCount as number) === expected)) return false;
  const indices = new Set<number>();
  const rejectionsValid = value.postconditionRejections.every((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
    const record = candidate as Readonly<Record<string, unknown>>;
    if (!exactKeys(record, ["index", "reasons"]) || !Number.isSafeInteger(record.index)
      || (record.index as number) < 0 || (record.index as number) >= (value.postconditionRawCount as number)
      || indices.has(record.index as number) || !Array.isArray(record.reasons) || record.reasons.length < 1
      || new Set(record.reasons).size !== record.reasons.length
      || record.reasons.some((reason) => typeof reason !== "string"
        || !POSTCONDITION_REJECTION_REASONS.has(reason))) return false;
    indices.add(record.index as number);
    return true;
  });
  if (!rejectionsValid || value.postconditionVerified === true) return rejectionsValid;
  const firstReason = (value.postconditionRejections[0] as Readonly<Record<string, unknown>> | undefined)
    ?.reasons as readonly string[] | undefined;
  const expectedCause = (value.postconditionEligibleCount as number) > expected
    ? "BROWSER_DOM_CANDIDATE_AMBIGUOUS"
    : (value.postconditionRawCount as number) === 0
      ? "BROWSER_DOM_CANDIDATE_MISSING" : firstReason?.[0] ?? "BROWSER_DOM_CANDIDATE_MISSING";
  return value.nativeCauseCode === expectedCause;
};

const actionKeys = (command: BrowserGovernedCommand, failed: boolean): readonly string[] => {
  const common = ["candidateCount", "identityRevalidated", "mutationCount", "postconditionVerified"];
  const specific = command.kind === "file-input"
    ? ["selectedFileCount", "approvedSetVerified", "acceptVerified"]
    : command.kind === "dom-intent" ? domActionKeys(command) : [];
  if (specific.length === 0) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  const match = hasMatchPostcondition(command);
  return [...common, ...specific, ...(match ? postconditionEvidenceKeys : []),
    ...(failed ? ["failureCode"] : []), ...(failed && match ? ["nativeCauseCode"] : [])];
};

const assertFileInputReceipt = (
  command: Extract<BrowserGovernedCommand, { kind: "file-input" }>,
  value: Readonly<Record<string, unknown>>,
): void => {
  if (!Number.isSafeInteger(value.selectedFileCount) || (value.selectedFileCount as number) < 0
    || (value.selectedFileCount as number) > 20 || typeof value.approvedSetVerified !== "boolean"
    || typeof value.acceptVerified !== "boolean") {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  if (value.postconditionVerified === true
    && (value.selectedFileCount !== command.approvedFiles.length
      || value.approvedSetVerified !== true || value.acceptVerified !== true)) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
};

const assertDomActionReceipt = (
  command: Extract<BrowserGovernedCommand, { kind: "dom-intent" }>,
  value: Readonly<Record<string, unknown>>,
): void => {
  const intent = command.intent;
  const valid = intent.kind === "click" ? value.clicked === true
    : intent.kind === "hover" ? value.hovered === true
      : intent.kind === "doubleClick" ? value.doubleClicked === true
        : intent.kind === "keypress" ? value.keyPressed === intent.key
          && value.keypressCount === (intent.repeat ?? 1)
          : intent.kind === "fill" ? value.filled === true
            && value.retainedValueVerified === value.postconditionVerified : false;
  if (!valid) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
};

const zeroActionReceiptValid = (
  command: BrowserGovernedCommand,
  value: Readonly<Record<string, unknown>>,
): boolean => value.zeroActionSatisfied === true
  && value.candidateCount === 1
  && value.identityRevalidated === true
  && value.postconditionVerified === true
  && command.kind === "dom-intent"
  && (!hasMatchPostcondition(command) || postconditionEvidenceValid(command, value))
  && exactKeys(value, ["candidateCount", "identityRevalidated", "mutationCount",
    "postconditionVerified", "zeroActionSatisfied",
    ...(hasMatchPostcondition(command) ? postconditionEvidenceKeys : [])]);

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
    ? value.nativeCauseCode === null
    : command.kind === "file-input"
      ? value.nativeCauseCode === null
      : domActionabilityNativeCauseValid(command, value.nativeCauseCode))
  && qualificationFactsConsistent(value);

const decodeZeroMutationReceipt = (
  command: BrowserGovernedCommand,
  value: Readonly<Record<string, unknown>>,
): BrowserMutationReceipt => {
  if (zeroActionReceiptValid(command, value)) {
    return Object.freeze({ terminal: "confirmed", mutationOutcome: "no", failureCode: null, nativeCauseCode: null });
  }
  if (qualificationReceiptValid(command, value)) {
    return Object.freeze({
      terminal: "rejected", mutationOutcome: "no", failureCode: value.failureCode,
      nativeCauseCode: value.nativeCauseCode as string | null,
    });
  }
  throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
};

const decodeDispatchedMutationReceipt = (
  command: BrowserGovernedCommand,
  value: Readonly<Record<string, unknown>>,
): BrowserMutationReceipt => {
  const exactIdentity = value.candidateCount === 1 && value.identityRevalidated === true;
  const fillReadbackRejected = command.kind === "dom-intent" && command.intent.kind === "fill"
    && value.postconditionVerified === false && value.identityRevalidated === false
    && (value.candidateCount === 0 || value.candidateCount === 1 || value.candidateCount === 2);
  const matchPostconditionRejected = hasMatchPostcondition(command) && value.postconditionVerified === false;
  const nativeCauseValid = fillReadbackRejected || matchPostconditionRejected
    ? POSTCONDITION_NATIVE_CAUSES.has(String(value.nativeCauseCode))
    : value.nativeCauseCode === undefined;
  if ((!exactIdentity && !fillReadbackRejected)
    || !nativeCauseValid || (hasMatchPostcondition(command) && !postconditionEvidenceValid(command, value))
    || value.zeroActionSatisfied === true || value.qualificationRejected === true) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  if (value.postconditionVerified === false && value.failureCode !== "BROWSER_POSTCONDITION_FAILED") {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  const expectedKeys = [
    ...actionKeys(command, value.postconditionVerified === false),
    ...(fillReadbackRejected ? ["nativeCauseCode"] : []),
  ];
  if (!exactKeys(value, expectedKeys)) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  if (command.kind === "file-input") assertFileInputReceipt(command, value);
  else if (command.kind === "dom-intent") assertDomActionReceipt(command, value);
  else throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  return Object.freeze({
    terminal: value.postconditionVerified ? "confirmed" : "rejected",
    mutationOutcome: "confirmed",
    failureCode: value.postconditionVerified ? null : "BROWSER_POSTCONDITION_FAILED",
    nativeCauseCode: fillReadbackRejected || matchPostconditionRejected
      ? String(value.nativeCauseCode) : null,
  });
};

export const decodeBrowserMutationReceipt = (
  command: BrowserGovernedCommand,
  result: unknown,
): BrowserMutationReceipt => {
  if (!mutationCommandValid(command)) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  const value = result && typeof result === "object" ? result as Record<string, unknown> : {};
  const mutationCount = value.mutationCount;
  if ((mutationCount !== 0 && mutationCount !== 1) || typeof value.postconditionVerified !== "boolean"
    || (value.zeroActionSatisfied === true && value.qualificationRejected === true)) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  return mutationCount === 0
    ? decodeZeroMutationReceipt(command, value)
    : decodeDispatchedMutationReceipt(command, value);
};
