import { executionFailure } from "../../../../lib/execution-failure.js";
import { declaredFacts, requireBrowser, requireExactInputKeys, success, type GptChildHandler } from "../../web/child-handler.js";

export const getSubmittedGptConversationUrlHandler: GptChildHandler<"get_submitted_gpt_conversation_url"> = async (intent, context) => {
  requireExactInputKeys(intent, ["submitCallId", "providerEffectIdentityHash", "timeoutMs"]);
  if (context.signal?.aborted) throw executionFailure("failed", "GPT_EXECUTION_ABORTED");
  const input = intent.input;
  if (typeof input.submitCallId !== "string" || !input.submitCallId
    || !/^sha256:[a-f0-9]{64}$/u.test(input.providerEffectIdentityHash)
    || !Number.isInteger(input.timeoutMs) || input.timeoutMs < 1 || input.timeoutMs > 15_000) {
    throw executionFailure("failed", "GPT_CHILD_INPUT_INVALID:get_submitted_gpt_conversation_url");
  }
  const locator = context.submittedConversationLocator
    ?? await requireBrowser(context).readSubmittedConversationUrl({ ...input,
      ...(context.signal ? { signal: context.signal } : {}) });
  if (locator.providerEffectIdentityHash !== input.providerEffectIdentityHash) {
    throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH");
  }
  return success({ value: { canonicalConversationUrl: locator.canonicalConversationUrl, userTurnId: locator.userTurnId },
    ...declaredFacts({ decision: "DONE", mutationOutcome: "no", browserFact: null, nativeFailureCode: null,
      factResultIds: [`browser-submitted-conversation:${locator.locatorHash}`], candidateCardinality: { raw: 1, eligible: 1 },
      authorityRefHashes: [locator.targetRefHash, locator.documentRefHash, locator.locatorHash],
      observationRevisionHash: locator.observationRevisionHash }) });
};
