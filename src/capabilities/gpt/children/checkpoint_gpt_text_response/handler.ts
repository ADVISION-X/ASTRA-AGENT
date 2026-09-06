import { executionFailure } from "../../../../lib/execution-failure.js";

import {
  declaredFacts,
  requireBrowser,
  requireExactInputKeys,
  stringInput,
  success,
  type GptChildHandler,
} from "../../web/child-handler.js";
import { projectExactAssistantTurn, readExactAssistantTurn } from "../../web/gpt-dom-observation.js";
import {
  isGptTurnId,
  responseHashInput,
} from "./response-support.js";
import { canonicalGptConversationUrl } from "../../web/contracts/target-document.contract.js";

export const checkpointGptTextResponseHandler: GptChildHandler<"checkpoint_gpt_text_response"> =
  async (intent, context) => {
    requireExactInputKeys(intent, [
      "assistantTurnId", "canonicalConversationUrl", "expectedPromptHash", "expectedResponseHash", "turnMarker",
    ]);
    const assistantTurnId = stringInput(intent, "assistantTurnId");
    if (!isGptTurnId(assistantTurnId)) {
      throw executionFailure("failed", "GPT_CHILD_INPUT_INVALID:checkpoint_gpt_text_response:assistantTurnId");
    }
    const conversationUrl = canonicalGptConversationUrl(stringInput(intent, "canonicalConversationUrl"));
    const expectedPromptHash = responseHashInput(intent, "expectedPromptHash");
    const expectedResponseHash = responseHashInput(intent, "expectedResponseHash");
    const turnMarker = stringInput(intent, "turnMarker");
    const browser = requireBrowser(context);
    const assistant = await readExactAssistantTurn(browser, assistantTurnId, {
      canonicalConversationUrl: conversationUrl, expectedPromptHash, turnMarker,
    });
    if (assistant.generatingRaw !== 0 || assistant.semanticText.trim().length === 0
      || assistant.semanticTextHash !== expectedResponseHash) {
      throw executionFailure("failed", "GPT_RESPONSE_CHECKPOINT_MISMATCH");
    }
    const facts = projectExactAssistantTurn(assistant);
    return success({
      value: { assistantTurnId, rawDomHtml: assistant.rawDomHtml, rawDomHash: assistant.rawDomHash,
        semanticText: assistant.semanticText, semanticTextHash: assistant.semanticTextHash },
      ...declaredFacts({ ...facts, decision: "DONE", mutationOutcome: "no",
        browserFact: null, nativeFailureCode: null }),
    });
  };
