import { executionFailure } from "../../../../lib/execution-failure.js";
import {
  declaredFacts,
  requireBrowser,
  requireConfirmedBrowserFact,
  requireExactInputKeys,
  success,
  type GptChildHandler,
} from "../../web/child-handler.js";
import { gptExactCallIdentityHash, type GptChildBrowserFact } from "../../contract.js";

const HASH = /^sha256:[a-f0-9]{64}$/u;
const EXACT_DIALOG_HASH =
  "sha256:084b621b91e3affcf2199269157febb07ded1b7a3287ac61104108317cddde15";

export const acknowledgeKnownGptRateLimitHandler:
GptChildHandler<"acknowledge_known_gpt_rate_limit"> = async (intent, context) => {
  requireExactInputKeys(intent, [
    "incidentRequestId", "dialogHash", "observationHash", "targetRefHash",
    "documentRefHash", "observedAt",
  ]);
  const input = intent.input;
  if (!/^aipcooldown_[a-f0-9]{40}$/u.test(input.incidentRequestId)
    || input.dialogHash !== EXACT_DIALOG_HASH || !HASH.test(input.observationHash)
    || !HASH.test(input.targetRefHash) || !HASH.test(input.documentRefHash)
    || Number.isNaN(Date.parse(input.observedAt))
    || new Date(input.observedAt).toISOString() !== input.observedAt
    || Date.now() - Date.parse(input.observedAt) < 0) {
    throw executionFailure("failed", "GPT_RATE_LIMIT_ACK_INPUT_INVALID");
  }
  const browser = requireBrowser(context);
  const receipt = context.confirmedRateLimitAcknowledgementReadback?.terminalPayload
    ?? await browser.executeDomIntent({
      kind: "acknowledgeKnownGptRateLimit",
      targetRefHash: input.targetRefHash,
      documentRefHash: input.documentRefHash,
      dispatchNotAfter: context.rateLimitAckDispatchNotAfter === undefined
        ? null : new Date(context.rateLimitAckDispatchNotAfter).toISOString(),
    });
  const row = receipt && typeof receipt === "object" && !Array.isArray(receipt)
    ? receipt as Readonly<Record<string, unknown>> : {};
  const clickedClearance = row.clicked === true && row.mutationCount === 1;
  const absentReadback = row.zeroActionSatisfied === true
    && row.candidateCount === 0 && row.mutationCount === 0;
  if ((!clickedClearance && !absentReadback) || row.postconditionVerified !== true) {
    throw executionFailure("failed", "GPT_RATE_LIMIT_ACK_POSTCONDITION_FAILED");
  }
  const suppliedFact = context.confirmedRateLimitAcknowledgementReadback?.browserFact;
  if (suppliedFact && (!absentReadback
    || suppliedFact.exactCallIdentityHash !== gptExactCallIdentityHash(intent)
    || suppliedFact.childCapabilityId !== intent.childCapabilityId
    || suppliedFact.effectScope !== "target_local"
    || suppliedFact.browserOutcome !== "CONFIRMED"
    || suppliedFact.mutationOutcome !== "no"
    || suppliedFact.providerEffectIdentityHash !== null
    || suppliedFact.terminalAt !== row.observedAt
    || suppliedFact.evidenceHash !== row.observationHash)) {
    throw executionFailure("failed", "GPT_RATE_LIMIT_CLEARANCE_READBACK_INVALID");
  }
  const browserFact: GptChildBrowserFact = suppliedFact
    ?? requireConfirmedBrowserFact(intent, context, {
      allowNoMutationOutcome: absentReadback,
    });
  return success({
    value: {
      clearance: "confirmed_absent",
      acknowledgedAt: browserFact.terminalAt ?? new Date().toISOString(),
      acknowledgementReceiptHash: browserFact.evidenceHash,
    },
    ...declaredFacts({
      decision: "ACT",
      factResultIds: Object.freeze([browserFact.evidenceRef]),
      candidateCardinality: Object.freeze({ raw: 1, eligible: 1 }),
      authorityRefHashes: Object.freeze([browserFact.evidenceHash]),
      observationRevisionHash: input.observationHash,
      mutationOutcome: browserFact.mutationOutcome,
      browserFact,
      nativeFailureCode: null,
    }),
  });
};
