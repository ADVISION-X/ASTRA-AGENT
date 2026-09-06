import { executionFailure, failureCode } from "../../../../lib/execution-failure.js";

import {
  declaredFacts,
  numberInput,
  requireBrowser,
  requireExactInputKeys,
  stringInput,
  success,
  type GptChildHandler,
} from "../../web/child-handler.js";
import {
  canonicalConversationOrNull,
  composerHashInput,
  gptComposerHash,
  readDraftState,
  requireExactComposer,
  submissionMatch,
} from "./observation.js";
import { gptConversationIdentityHash } from "../../web/conversation-identity.js";

const timeoutInput = (intent: Parameters<GptChildHandler<"reconcile_gpt_turn_submission">>[0]): number => {
  const value = numberInput(intent, "timeoutMs");
  if (!Number.isSafeInteger(value) || value < 1 || value > 60_000) {
    throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:timeoutMs`);
  }
  return value;
};

const confirmedSubmitMatches = (
  intent: Parameters<GptChildHandler<"reconcile_gpt_turn_submission">>[0],
  receipt: NonNullable<Parameters<GptChildHandler<"reconcile_gpt_turn_submission">>[1]["confirmedProviderSubmitReceipt"]>,
  expectedPromptHash: `sha256:${string}`,
  marker: string,
): boolean => receipt.sourceAttemptId === intent.attemptId
  && receipt.sourceProductStepId === intent.productStepId
  && receipt.sourceActionOrdinal < intent.actionOrdinal
  && receipt.promptHash === expectedPromptHash
  && receipt.turnMarker === marker
  && /^sha256:[a-f0-9]{64}$/u.test(receipt.sourceExactCallIdentityHash)
  && /^sha256:[a-f0-9]{64}$/u.test(receipt.evidenceHash)
  && Boolean(receipt.sourceCallId && receipt.sourceTargetRef && receipt.sourceDocumentRef && receipt.evidenceRef)
  && !Number.isNaN(Date.parse(receipt.sourceTerminalAt));

const transientReadFailure = (error: unknown): boolean => [
  "BROWSER_DOM_CANDIDATE_MISSING", "BROWSER_DOM_CANDIDATE_AMBIGUOUS",
  "BROWSER_DOM_NODE_STALE", "BROWSER_DOM_READ_INVALID",
].includes(failureCode(error));

export const reconcileGptTurnSubmissionHandler: GptChildHandler<"reconcile_gpt_turn_submission"> =
  async (intent, context) => {
    requireExactInputKeys(intent, ["expectedPromptHash", "timeoutMs", "turnMarker"]);
    const expectedPromptHash = composerHashInput(intent, "expectedPromptHash");
    const marker = stringInput(intent, "turnMarker");
    const submitReceipt = context.confirmedProviderSubmitReceipt;
    if (!submitReceipt || !confirmedSubmitMatches(intent, submitReceipt, expectedPromptHash, marker)) {
      throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_RECEIPT_MISMATCH");
    }
    const deadline = Date.now() + timeoutInput(intent);
    const browser = requireBrowser(context);
    let lastTransient: unknown = null;
    do {
      try {
        const observed = await readDraftState(browser);
        requireExactComposer(observed);
        const matching = submissionMatch(observed, expectedPromptHash);
        if (matching.length > 1) {
          throw executionFailure("failed", `GPT_SUBMITTED_TURN_COUNT_${matching.length}`);
        }
        const canonicalConversationUrl = canonicalConversationOrNull(observed.currentUrl);
        if (matching.length === 1 && observed.composerHash === gptComposerHash("") && canonicalConversationUrl) {
          const userTurnId = matching[0]!.testId;
          return success({
            value: { turnMarker: marker, userTurnId, canonicalConversationUrl, promptHash: expectedPromptHash,
              conversationIdentityHash: gptConversationIdentityHash({
                canonicalConversationUrl, turnMarker: marker, userTurnId, promptHash: expectedPromptHash,
              }) },
            ...declaredFacts({ ...observed.facts, decision: "DONE", mutationOutcome: "no",
              browserFact: null, nativeFailureCode: null }),
          });
        }
        lastTransient = null;
      } catch (error) {
        if (!transientReadFailure(error)) throw error;
        lastTransient = error;
      }
      const remaining = deadline - Date.now();
      if (remaining > 0) {
        await browser.wait({ durationMs: Math.max(25, Math.min(500, Math.ceil(remaining / 20))) });
      }
    } while (Date.now() < deadline);
    if (lastTransient) throw lastTransient;
    throw executionFailure("failed", "GPT_TURN_SUBMISSION_RECONCILIATION_PENDING");
  };
