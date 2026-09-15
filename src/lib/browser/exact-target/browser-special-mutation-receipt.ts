import type { BrowserMutationReceipt } from "./browser-mutation-receipt.js";

const exactKeys = (value: Readonly<Record<string, unknown>>, expected: readonly string[]): boolean => {
  const keys = Object.keys(value);
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
};

export const knownRateLimitBlockerReceiptValid = (
  value: Readonly<Record<string, unknown>>,
): boolean => {
  const fact = value.knownGptRateLimitDialogFact as Readonly<Record<string, unknown>> | null;
  const envelope = [
    value.schemaVersion === "grasseye.browser.known-gpt-rate-limit-blocker.v1",
    value.failureCode === "BROWSER_KNOWN_GPT_RATE_LIMIT", value.nativeCauseCode === null,
    value.candidateCount === 1, value.identityRevalidated === true, value.mutationCount === 0,
    value.physicalInputCount === 0, value.postconditionVerified === false,
    value.qualificationRejected === true, value.qualificationStage === "candidate-set",
  ].every(Boolean);
  const exactFact = [fact !== null, typeof fact === "object", !Array.isArray(fact),
    fact?.schemaVersion === "grasseye.browser.known-gpt-rate-limit-dialog.v1",
    fact?.state === "exact_present",
    fact?.dialogHash === "sha256:084b621b91e3affcf2199269157febb07ded1b7a3287ac61104108317cddde15",
  ].every(Boolean);
  const hashes = fact && [fact.targetRefHash, fact.documentRefHash, fact.observationHash];
  return [envelope, exactFact, Array.isArray(hashes),
    hashes?.every((hash) => typeof hash === "string" && /^sha256:[a-f0-9]{64}$/u.test(hash)),
    typeof fact?.observedAt === "string",
    Number.isFinite(Date.parse(String(fact?.observedAt))),
  ].every(Boolean);
};

const renameEnvelopeValid = (value: Readonly<Record<string, unknown>>): boolean => {
  const count = value.mutationCount;
  return [Number.isSafeInteger(count), (count as number) >= 0, (count as number) <= 4,
    typeof value.postconditionVerified === "boolean", Number.isSafeInteger(value.candidateCount),
    (value.candidateCount as number) >= 0, (value.candidateCount as number) <= 2,
    typeof value.identityRevalidated === "boolean"].every(Boolean);
};

const renameSuccess = (
  value: Readonly<Record<string, unknown>>, physicalInputCount: 0 | 1 | 2 | 3 | 4,
): boolean => [value.postconditionVerified === true,
  (physicalInputCount === 0 && value.renameState === "already-exact")
    || (physicalInputCount === 4 && value.renameState === "renamed"),
  value.identityRevalidated === true, value.candidateCount === 1].every(Boolean);

const renameFailureValid = (value: Readonly<Record<string, unknown>>): boolean => [
  value.renameState === "failed", typeof value.failureCode === "string",
  /^BROWSER_[A-Z0-9_]+$/u.test(String(value.failureCode)),
  value.nativeCauseCode === null || (typeof value.nativeCauseCode === "string"
    && /^BROWSER_[A-Z0-9_]+$/u.test(value.nativeCauseCode)),
].every(Boolean);

export const decodeConversationRenameReceipt = (
  value: Readonly<Record<string, unknown>>,
): BrowserMutationReceipt => {
  const successKeys = ["renameState", "candidateCount", "identityRevalidated", "mutationCount",
    "postconditionVerified"];
  const failureKeys = [...successKeys, "failureCode", "nativeCauseCode"];
  if (!exactKeys(value, value.renameState === "failed" ? failureKeys : successKeys)
    || !renameEnvelopeValid(value)) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  const physicalInputCount = value.mutationCount as 0 | 1 | 2 | 3 | 4;
  if (renameSuccess(value, physicalInputCount)) return Object.freeze({
    terminal: "confirmed", mutationOutcome: physicalInputCount === 0 ? "no" : "confirmed",
    failureCode: null, nativeCauseCode: null, physicalInputCount,
  });
  if (!renameFailureValid(value)) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  return Object.freeze({
    terminal: "rejected", mutationOutcome: physicalInputCount === 0 ? "no" : "confirmed",
    failureCode: value.failureCode as string, nativeCauseCode: value.nativeCauseCode as string | null,
    physicalInputCount,
  });
};
