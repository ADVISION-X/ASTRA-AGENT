import { executionFailure, failureCode } from "../../../../lib/execution-failure.js";

import { declaredFacts, numberInput, requireBrowser, requireExactInputKeys, stringInput, success, type GptChildHandler } from "../../web/child-handler.js";
import {
  projectExactAssistantTurn,
  readExactAssistantTurn,
} from "../../web/gpt-dom-observation.js";
import { canonicalGptConversationUrl } from "../../web/contracts/target-document.contract.js";

export const checkpointGptTextResponseHandler: GptChildHandler<"checkpoint_gpt_text_response"> =
  async (intent, context) => {
    requireExactInputKeys(intent, ["canonicalConversationUrl", "probeBudgetMs", "turnMarker", "userTurnId"]);
    const conversationUrl = canonicalGptConversationUrl(stringInput(intent, "canonicalConversationUrl"));
    stringInput(intent, "turnMarker");
    const userTurnId = stringInput(intent, "userTurnId");
    const probeBudgetMs = numberInput(intent, "probeBudgetMs");
    if (!Number.isSafeInteger(probeBudgetMs) || probeBudgetMs < 1 || probeBudgetMs > 3_600_000) throw executionFailure("failed", "GPT_RESPONSE_PROBE_BUDGET_INVALID");
    const browser = requireBrowser(context);
    const deadline = Date.now() + probeBudgetMs;
    await browser.executeDomIntent({ kind: "selectExactGptConversation", canonicalConversationUrl: conversationUrl });
    while (Date.now() < deadline) {
      let assistant: Awaited<ReturnType<typeof readExactAssistantTurn>> | null = null;
      try {
        assistant = await readExactAssistantTurn(browser, userTurnId, conversationUrl);
      } catch (error) {
        if (failureCode(error) !== "BROWSER_DOM_CANDIDATE_MISSING") throw error;
      }
      if (assistant && assistant.generatingRaw === 0 && assistant.semanticText.trim().length > 0) {
        const facts = projectExactAssistantTurn(assistant);
        return success({
          value: { assistantTurnId: assistant.assistantTurnId, rawDomHtml: assistant.rawDomHtml, rawDomHash: assistant.rawDomHash,
            semanticText: assistant.semanticText, semanticTextHash: assistant.semanticTextHash },
          ...declaredFacts({ ...facts, decision: "DONE", mutationOutcome: "no",
            browserFact: null, nativeFailureCode: null }),
        });
      }
      if (!context.yieldForProviderProbe) {
        throw executionFailure("failed", "GPT_PROVIDER_PROBE_GATE_REQUIRED");
      }
      if (await context.yieldForProviderProbe(conversationUrl, deadline) === "deadline") break;
    }
    throw executionFailure("failed", "GPT_RESPONSE_TIMEOUT");
  };
