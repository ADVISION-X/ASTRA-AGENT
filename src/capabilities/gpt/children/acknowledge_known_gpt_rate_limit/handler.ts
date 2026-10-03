import { executionFailure } from "../../../../lib/execution-failure.js";
import { gptExactCallIdentityHash, type GptChildBrowserFact } from "../../contract.js";
import { declaredFacts, projectBrowserFact, requireBrowser, requireExactInputKeys, success,
  type GptChildHandler } from "../../web/child-handler.js";
const HASH = /^sha256:[a-f0-9]{64}$/u;
const EXACT_DIALOG_HASH = "sha256:084b621b91e3affcf2199269157febb07ded1b7a3287ac61104108317cddde15";
const inputValid = (input: Parameters<GptChildHandler<"acknowledge_known_gpt_rate_limit">>[0]["input"]): boolean =>
  /^aipcooldown_[a-f0-9]{40}$/u.test(input.incidentRequestId) && input.dialogHash === EXACT_DIALOG_HASH
  && [input.observationHash, input.targetRefHash, input.documentRefHash].every(value => HASH.test(value))
  && Number.isFinite(Date.parse(input.observedAt)) && new Date(input.observedAt).toISOString() === input.observedAt
  && Date.now() >= Date.parse(input.observedAt);
const receiptInputCount = (row: Readonly<Record<string, unknown>>): 0 | 1 | null => {
  if (row.postconditionVerified !== true) return null;
  if (row.clicked === true && row.mutationCount === 1) return 1;
  return row.zeroActionSatisfied === true && row.candidateCount === 0 && row.mutationCount === 0 ? 0 : null;
};
const clearanceFactValid = (fact: GptChildBrowserFact,
  intent: Parameters<GptChildHandler<"acknowledge_known_gpt_rate_limit">>[0], row: Readonly<Record<string, unknown>>): boolean =>
  Object.entries({ exactCallIdentityHash: gptExactCallIdentityHash(intent), childCapabilityId: intent.childCapabilityId,
    effectScope: "target_local", browserOutcome: "CONFIRMED", mutationOutcome: "no", providerEffectIdentityHash: null,
    terminalAt: row.observedAt, evidenceHash: row.observationHash,
    evidenceRef: `browser-rate-limit-clearance:${row.observationHash}` }).every(([key, value]) => fact[key as keyof GptChildBrowserFact] === value);

export const acknowledgeKnownGptRateLimitHandler: GptChildHandler<"acknowledge_known_gpt_rate_limit"> = async (intent, context) => {
  requireExactInputKeys(intent, ["incidentRequestId", "dialogHash", "observationHash", "targetRefHash", "documentRefHash", "observedAt"]);
  if (!inputValid(intent.input)) throw executionFailure("failed", "GPT_RATE_LIMIT_ACK_INPUT_INVALID");
  const browser = requireBrowser(context), recovered = context.confirmedRateLimitAcknowledgementReadback;
  const receipt = recovered?.terminalPayload ?? await browser.executeDomIntent({ kind: "acknowledgeKnownGptRateLimit",
    targetRefHash: intent.input.targetRefHash, documentRefHash: intent.input.documentRefHash,
    dispatchNotAfter: context.rateLimitAckDispatchNotAfter === undefined ? null : new Date(context.rateLimitAckDispatchNotAfter).toISOString() });
  const row = receipt && typeof receipt === "object" ? receipt as Readonly<Record<string, unknown>> : {};
  const count = receiptInputCount(row);
  if (count === null) throw executionFailure("failed", "GPT_RATE_LIMIT_ACK_POSTCONDITION_FAILED");
  const supplied = recovered?.browserFact;
  let fact: GptChildBrowserFact;
  if (supplied) {
    if (count !== 0 || !clearanceFactValid(supplied, intent, row)) throw executionFailure("failed", "GPT_RATE_LIMIT_CLEARANCE_READBACK_INVALID");
    fact = supplied;
  } else {
    const projected = projectBrowserFact(intent, context);
    if (!projected || projected.fact.browserOutcome !== "CONFIRMED" || projected.outcome.physicalInputCount !== count) {
      throw executionFailure("failed", "GPT_BROWSER_TERMINAL_FACT_REQUIRED");
    }
    fact = projected.fact;
  }
  return success({ value: { clearance: "confirmed_absent", acknowledgedAt: fact.terminalAt!, acknowledgementReceiptHash: fact.evidenceHash },
    ...declaredFacts({ decision: "ACT", factResultIds: [fact.evidenceRef], candidateCardinality: { raw: 1, eligible: 1 },
      authorityRefHashes: [fact.evidenceHash], observationRevisionHash: intent.input.observationHash,
      mutationOutcome: fact.mutationOutcome, browserFact: fact, nativeFailureCode: null }) });
};
