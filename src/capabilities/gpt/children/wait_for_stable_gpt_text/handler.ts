import { executionFailure } from "../../../../lib/execution-failure.js";

import {
  requireBrowser,
  requireExactInputKeys,
  stringInput,
  success,
  type GptChildHandler,
} from "../../web/child-handler.js";
import { readExactAssistantTurn } from "../../web/gpt-dom-observation.js";
import {
  assistantTurnForPrompt,
  ensureResponseConversation,
  type GptResponsePageState,
} from "./page-observation.js";
import {
  exactAssistantFacts,
  maybeAcknowledgeRateLimit,
  providerWait,
  responseCompletionFacts,
  responseHashInput,
} from "./response-support.js";
import { canonicalGptConversationUrl } from "../../web/contracts/target-document.contract.js";

type AssistantPageState = GptResponsePageState["assistantTurns"][number];

const stableTextObserved = (
  assistant: AssistantPageState | undefined,
  generatingCount: number,
  prior: Readonly<{ assistantTurnId: string; responseHash: string }> | null,
): assistant is AssistantPageState => Boolean(assistant
  && generatingCount === 0
  && assistant.semanticTextHash !== `sha256:${"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}`
  && prior?.assistantTurnId === assistant.testId
  && prior.responseHash === assistant.semanticTextHash);

export const waitForStableGptTextHandler: GptChildHandler<"wait_for_stable_gpt_text"> =
  async (intent, context) => {
    requireExactInputKeys(intent, ["absoluteDeadline", "canonicalConversationUrl", "expectedPromptHash", "turnMarker"]);
    const conversationUrl = canonicalGptConversationUrl(stringInput(intent, "canonicalConversationUrl"));
    const expectedPromptHash = responseHashInput(intent, "expectedPromptHash");
    stringInput(intent, "turnMarker");
    const deadline = Date.parse(stringInput(intent, "absoluteDeadline"));
    if (!Number.isFinite(deadline) || deadline > Date.now() + 3_600_000) {
      throw executionFailure("failed", "GPT_RESPONSE_ABSOLUTE_DEADLINE_INVALID");
    }
    if (Date.now() >= deadline) throw executionFailure("failed", "GPT_RESPONSE_STABILITY_TIMEOUT");
    const browser = requireBrowser(context);
    let prior: Readonly<{ assistantTurnId: string; responseHash: string }> | null = null;
    let rateLimitAcknowledged = false;
    let probeDelayMs = 250;
    do {
      if (context.signal?.aborted) throw executionFailure("failed", "GPT_RESPONSE_WAIT_ABORTED");
      const observed = await ensureResponseConversation({
        browser, canonicalConversationUrl: conversationUrl, context, deadline,
      });
      const assistantTurnId = assistantTurnForPrompt(observed, expectedPromptHash);
      const assistantState = assistantTurnId === null ? undefined
        : observed.assistantTurns.find((turn) => turn.testId === assistantTurnId);
      if (stableTextObserved(assistantState, observed.generatingRaw, prior)) {
        const stableAssistantTurnId = assistantState.testId;
        const assistant = await readExactAssistantTurn(browser, stableAssistantTurnId);
        if (assistant.semanticText.trim().length > 0
          && assistant.semanticTextHash === assistantState.semanticTextHash) {
          const facts = exactAssistantFacts(observed.facts, assistant);
          return success({
            value: { assistantTurnId: stableAssistantTurnId,
              responseHash: assistant.semanticTextHash, responseText: assistant.semanticText },
            ...responseCompletionFacts(intent, browser, facts, rateLimitAcknowledged),
          });
        }
      }
      if (assistantState && observed.generatingRaw === 0) {
        prior = Object.freeze({ assistantTurnId: assistantState.testId, responseHash: assistantState.semanticTextHash });
      }
      rateLimitAcknowledged = await maybeAcknowledgeRateLimit(
        browser, observed, rateLimitAcknowledged, context.mutationMode === "readback",
      );
      const remaining = deadline - Date.now();
      if (remaining >= 25) {
        await providerWait(context, browser, Math.min(probeDelayMs, remaining));
        probeDelayMs = Math.min(5_000, Math.ceil(probeDelayMs * 1.5));
      } else break;
    } while (Date.now() < deadline);
    throw executionFailure("failed", "GPT_RESPONSE_STABILITY_TIMEOUT");
  };
