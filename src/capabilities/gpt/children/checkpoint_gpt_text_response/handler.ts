import { executionFailure, failureCode } from "../../../../lib/execution-failure.js";

import { declaredFacts, numberInput, requireBrowser, requireExactInputKeys, stringInput, success, type GptChildHandler } from "../../web/child-handler.js";
import {
  projectExactAssistantTurn,
  readExactAssistantTurn,
} from "../../web/gpt-dom-observation.js";
import { canonicalGptConversationUrl } from "../../web/contracts/target-document.contract.js";
import { adjacentGptAssistantTurnId, readCurrentGptDocumentUrl } from "./exact-response.js";

const HASH = /^sha256:[a-f0-9]{64}$/u;

export const checkpointGptTextResponseHandler: GptChildHandler<"checkpoint_gpt_text_response"> =
  async (intent, context) => {
    requireExactInputKeys(intent, ["canonicalConversationUrl", "expectedPromptHash", "probeBudgetMs", "turnMarker", "userTurnId"]);
    const conversationUrl = canonicalGptConversationUrl(stringInput(intent, "canonicalConversationUrl"));
    const expectedPromptHash = stringInput(intent, "expectedPromptHash");
    if (!HASH.test(expectedPromptHash)) throw executionFailure("failed", "GPT_CHILD_INPUT_INVALID:checkpoint_gpt_text_response:expectedPromptHash");
    const turnMarker = stringInput(intent, "turnMarker");
    const userTurnId = stringInput(intent, "userTurnId");
    const assistantTurnId = adjacentGptAssistantTurnId(userTurnId);
    const probeBudgetMs = numberInput(intent, "probeBudgetMs");
    if (!Number.isSafeInteger(probeBudgetMs) || probeBudgetMs < 1 || probeBudgetMs > 3_600_000) throw executionFailure("failed", "GPT_RESPONSE_PROBE_BUDGET_INVALID");
    const browser = requireBrowser(context);
    const deadline = Date.now() + probeBudgetMs;
    while (Date.now() < deadline) {
      if (await readCurrentGptDocumentUrl(browser) !== conversationUrl) {
        if (!context.selectExactProviderConversation) {
          throw executionFailure("failed", "GPT_PROVIDER_CONVERSATION_GATE_REQUIRED");
        }
        if (await context.selectExactProviderConversation(conversationUrl, deadline) === "deadline") break;
        continue;
      }
      let assistant: Awaited<ReturnType<typeof readExactAssistantTurn>> | null = null;
      try {
        assistant = await readExactAssistantTurn(browser, assistantTurnId, {
          canonicalConversationUrl: conversationUrl, expectedPromptHash: expectedPromptHash as `sha256:${string}`, turnMarker,
        });
      } catch (error) {
        if (failureCode(error) !== "BROWSER_DOM_CANDIDATE_MISSING") throw error;
      }
      if (assistant && assistant.generatingRaw === 0 && assistant.semanticText.trim().length > 0) {
        const facts = projectExactAssistantTurn(assistant);
        return success({
          value: { assistantTurnId, rawDomHtml: assistant.rawDomHtml, rawDomHash: assistant.rawDomHash,
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
