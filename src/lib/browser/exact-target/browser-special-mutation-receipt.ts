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
