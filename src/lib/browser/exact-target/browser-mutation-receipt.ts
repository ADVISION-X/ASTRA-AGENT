import type { BrowserGovernedCommand } from "./browser-command-actor.js";

export type BrowserMutationReceipt = Readonly<{
  terminal: "confirmed" | "rejected";
  mutationOutcome: "no" | "confirmed";
  failureCode: string | null;
}>;

const DOM_REJECTION_CODES = new Set([
  "BROWSER_DOM_CANDIDATE_MISSING",
  "BROWSER_DOM_CANDIDATE_AMBIGUOUS",
  "BROWSER_DOM_ACTION_NOT_QUALIFIED",
  "BROWSER_DOM_NODE_STALE",
  "BROWSER_DOM_READ_INVALID",
]);

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

const actionKeys = (command: BrowserGovernedCommand, failed: boolean): readonly string[] => {
  const common = ["candidateCount", "identityRevalidated", "mutationCount", "postconditionVerified"];
  const specific = command.kind === "file-input"
    ? ["selectedFileCount", "approvedSetVerified", "acceptVerified"]
    : command.kind === "dom-intent" ? domActionKeys(command) : [];
  if (specific.length === 0) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  return [...common, ...specific, ...(failed ? ["failureCode"] : [])];
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
  && exactKeys(value, ["candidateCount", "identityRevalidated", "mutationCount",
    "postconditionVerified", "zeroActionSatisfied"]);

const qualificationReceiptValid = (
  command: BrowserGovernedCommand,
  value: Readonly<Record<string, unknown>>,
): value is Readonly<Record<string, unknown>> & { failureCode: string } =>
  value.qualificationRejected === true
  && Number.isSafeInteger(value.candidateCount) && (value.candidateCount as number) >= 0
  && value.identityRevalidated === false && value.postconditionVerified === false
  && exactKeys(value, ["candidateCount", "identityRevalidated", "mutationCount",
    "postconditionVerified", "qualificationRejected", "qualificationStage", "failureCode"])
  && qualificationFailureValid(command, value.failureCode, value.candidateCount)
  && qualificationFactsConsistent(value);

const decodeZeroMutationReceipt = (
  command: BrowserGovernedCommand,
  value: Readonly<Record<string, unknown>>,
): BrowserMutationReceipt => {
  if (zeroActionReceiptValid(command, value)) {
    return Object.freeze({ terminal: "confirmed", mutationOutcome: "no", failureCode: null });
  }
  if (qualificationReceiptValid(command, value)) {
    return Object.freeze({ terminal: "rejected", mutationOutcome: "no", failureCode: value.failureCode });
  }
  throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
};

const decodeDispatchedMutationReceipt = (
  command: BrowserGovernedCommand,
  value: Readonly<Record<string, unknown>>,
): BrowserMutationReceipt => {
  if (value.candidateCount !== 1 || value.identityRevalidated !== true
    || value.zeroActionSatisfied === true || value.qualificationRejected === true) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  if (value.postconditionVerified === false && value.failureCode !== "BROWSER_POSTCONDITION_FAILED") {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  if (!exactKeys(value, actionKeys(command, value.postconditionVerified === false))) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  if (command.kind === "file-input") assertFileInputReceipt(command, value);
  else if (command.kind === "dom-intent") assertDomActionReceipt(command, value);
  else throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  return Object.freeze({
    terminal: value.postconditionVerified ? "confirmed" : "rejected",
    mutationOutcome: "confirmed",
    failureCode: value.postconditionVerified ? null : "BROWSER_POSTCONDITION_FAILED",
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
