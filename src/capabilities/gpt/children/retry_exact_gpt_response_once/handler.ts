import { assertGptRetryTerminalPayload, browserExactCallIdentityHash } from "../../../../lib/browser/browser-authority-api.js";
import { executionFailure } from "../../../../lib/execution-failure.js";
import { declaredFacts, projectBrowserFact, requireBrowser, requireExactInputKeys, success,
  type GptChildHandler } from "../../web/child-handler.js";

export const retryExactGptResponseOnceHandler: GptChildHandler<"retry_exact_gpt_response_once"> = async (intent, context) => {
  requireExactInputKeys(intent, ["originalEffectIdentityHash", "previousEffectIdentityHash", "retryOrdinal",
    "promptHash", "originalUserTurnId", "profileHash", "approvedModel", "turnMarker", "turnMarkerHash"]);
  const readback = context.confirmedProviderEffectReadback;
  if (!readback) {
    if (!context.stoppedEmptyConversationUrl || context.stoppedEmptyRetryAuthorized !== true) {
      throw executionFailure("failed", "GPT_STOPPED_EMPTY_RETRY_NOT_AUTHORIZED");
    }
    context.assertProviderInputAllowed?.();
    await requireBrowser(context).executeDomIntent({ kind: "click",
      selector: "button[aria-label='重新生成回复']", expectedMatches: 1,
      gptStoppedEmpty: { ...intent.input, action: "regenerate", canonicalConversationUrl: context.stoppedEmptyConversationUrl } });
  }
  const confirmed = projectBrowserFact(intent, context);
  const identity = context.browserAtomicIdentity;
  if (!confirmed || !identity || confirmed.fact.browserOutcome !== "CONFIRMED"
    || confirmed.fact.mutationOutcome !== "confirmed" || confirmed.outcome.physicalInputCount !== 1) {
    throw executionFailure("failed", "GPT_BROWSER_TERMINAL_FACT_REQUIRED");
  }
  const exact = readback?.exactCallIdentityHash ?? browserExactCallIdentityHash({
    jobId: intent.jobId, attemptId: intent.attemptId, writerFenceHash: requireBrowser(context).writerFenceHash, ...identity });
  const payload = confirmed.outcome.terminalPayload;
  assertGptRetryTerminalPayload(payload, { childCapabilityId: intent.childCapabilityId,
    callId: intent.callId, exactCallIdentityHash: exact as `sha256:${string}` });
  if (payload.originalEffectIdentityHash !== intent.input.originalEffectIdentityHash
    || payload.previousEffectIdentityHash !== intent.input.previousEffectIdentityHash
    || payload.retryOrdinal !== intent.input.retryOrdinal || payload.profileHash !== intent.input.profileHash
    || payload.turnMarkerHash !== intent.input.turnMarkerHash || payload.promptHash !== intent.input.promptHash
    || payload.userTurnId !== intent.input.originalUserTurnId) {
    throw executionFailure("failed", "GPT_RETRY_BROWSER_RECEIPT_INVALID");
  }
  return success({ value: { state: "generation-started", preEmptyObservationRevisionHash: payload.preEmptyObservationRevisionHash,
    userTurnId: payload.userTurnId, promptHash: payload.promptHash },
    ...declaredFacts({ decision: readback ? "DONE" : "ACT", mutationOutcome: readback ? "no" : "confirmed",
      browserFact: confirmed.fact, nativeFailureCode: null, candidateCardinality: { raw: 1, eligible: 1 },
      factResultIds: [confirmed.fact.evidenceRef], authorityRefHashes: [payload.targetRefHash, payload.documentRefHash,
        confirmed.fact.evidenceHash], observationRevisionHash: payload.observationRevisionHash }) });
};
