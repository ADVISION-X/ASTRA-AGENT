import { executionFailure } from "../../../../lib/execution-failure.js";

import {
  declaredFacts,
  requireBrowser,
  requireExactInputKeys,
  stringInput,
  success,
  type GptChildHandler,
} from "../../web/child-handler.js";
import {
  hashConversationValue,
  hashInput,
  readConversationState,
  timeoutInput,
  turnOrdinal,
} from "./observation.js";
import { canonicalGptConversationUrl } from "../../web/contracts/target-document.contract.js";
import { projectExactAssistantTurn, readExactAssistantTurn } from "../../web/gpt-dom-observation.js";

export const verifyGptConversationIdentityHandler:
GptChildHandler<"verify_gpt_conversation_identity"> = async (intent, context) => {
  requireExactInputKeys(intent, [
    "canonicalConversationUrl", "expectedPromptHash", "expectedResponseHash", "timeoutMs", "turnMarker",
  ]);
  const expectedUrl = canonicalGptConversationUrl(stringInput(intent, "canonicalConversationUrl"));
  const expectedPromptHash = hashInput(intent, "expectedPromptHash");
  const expectedResponseHash = hashInput(intent, "expectedResponseHash");
  const marker = stringInput(intent, "turnMarker");
  const deadline = Date.now() + timeoutInput(intent);
  const browser = requireBrowser(context);
  do {
    const observed = await readConversationState(browser);
    const matchingUsers = observed.userTurns.filter((turn) => turn.contentHash === expectedPromptHash);
    if (observed.currentUrl === expectedUrl && observed.composerEligible === 1 && matchingUsers.length === 1) {
      const userTurnId = matchingUsers[0]!.testId;
      const assistantTurnId = `conversation-turn-${turnOrdinal(userTurnId) + 1}`;
      if (observed.assistantTurnIds.includes(assistantTurnId)) {
        const assistant = await readExactAssistantTurn(browser, assistantTurnId, {
          canonicalConversationUrl: expectedUrl, expectedPromptHash, turnMarker: marker,
        });
        if (assistant.semanticTextHash !== expectedResponseHash) {
          throw executionFailure("failed", "GPT_RESPONSE_CHECKPOINT_MISMATCH");
        }
        const facts = projectExactAssistantTurn(assistant);
        return success({
          value: { canonicalConversationUrl: expectedUrl, turnMarker: marker, userTurnId, assistantTurnId,
            semanticText: assistant.semanticText, promptHash: expectedPromptHash,
            responseHash: expectedResponseHash,
            conversationHash: hashConversationValue(
              `${expectedUrl}\n${marker}\n${userTurnId}\n${expectedPromptHash}\n${expectedResponseHash}`,
            ) },
          ...declaredFacts({ ...facts, decision: "DONE", mutationOutcome: "no",
            browserFact: null, nativeFailureCode: null }),
        });
      }
    }
    const remaining = deadline - Date.now();
    if (remaining > 0) {
      await browser.wait({ durationMs: Math.max(25, Math.min(500, Math.ceil(remaining / 20))) });
    }
  } while (Date.now() < deadline);
  throw executionFailure("failed", "GPT_CONVERSATION_HYDRATION_PENDING");
};
