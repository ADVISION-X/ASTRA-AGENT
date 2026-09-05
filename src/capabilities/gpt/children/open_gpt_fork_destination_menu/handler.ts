import { executionFailure } from "../../../../lib/execution-failure.js";

import {
  declaredFacts,
  requireBrowser,
  requireExactInputKeys,
  success,
  type GptChildHandler,
} from "../../web/child-handler.js";
import {
  mutationFacts,
  readConversationState,
  requireSourceCheckpoint,
  sourceCheckpointInput,
} from "./observation.js";
import {
  forkDestinationMenuAbsent,
  forkDestinationMenuReady,
} from "./menu-state.js";
import {
  GPT_CHECKPOINT_ACTIONS_MENU_SELECTOR,
  GPT_FORK_DESTINATION_MENU_SELECTOR,
  GPT_FORK_TO_NEW_CHAT_SELECTOR,
  GPT_FORK_TO_NEW_CHAT_TEXT,
  GPT_OPEN_FORK_ACTION_SELECTOR,
  GPT_OPEN_FORK_ACTION_TEXT,
} from "./selectors.js";

export const openGptForkDestinationMenuHandler:
GptChildHandler<"open_gpt_fork_destination_menu"> = async (intent, context) => {
  requireExactInputKeys(intent, ["sourceAssistantTurnId", "sourceCanonicalConversationUrl", "sourcePromptHash",
    "sourceResponseHash", "sourceTurnMarker", "timeoutMs"]);
  const source = sourceCheckpointInput(intent);
  const browser = requireBrowser(context);
  const observed = await readConversationState(browser, source.assistantTurnId);
  const sourceFacts = await requireSourceCheckpoint(browser, source, observed);
  if (forkDestinationMenuReady(observed)) {
    return success({
      value: { sourceAssistantTurnId: source.assistantTurnId, state: "already-open" },
      ...declaredFacts({ ...sourceFacts, decision: "DONE", mutationOutcome: "no",
        browserFact: null, nativeFailureCode: null }),
    });
  }
  if (!forkDestinationMenuAbsent(observed)) {
    throw executionFailure("failed", "GPT_FORK_DESTINATION_MENU_AMBIGUOUS");
  }
  if (context.mutationMode === "readback") {
    throw executionFailure("failed", "GPT_FORK_DESTINATION_MENU_NOT_CONFIRMED");
  }
  await browser.executeDomIntent({
    kind: "click", selector: GPT_OPEN_FORK_ACTION_SELECTOR,
    scope: { selector: GPT_CHECKPOINT_ACTIONS_MENU_SELECTOR },
    expectedTextEquals: GPT_OPEN_FORK_ACTION_TEXT, expectedMatches: 1,
    postClickMatch: {
      selector: `${GPT_FORK_DESTINATION_MENU_SELECTOR} ${GPT_FORK_TO_NEW_CHAT_SELECTOR}`,
      textEquals: GPT_FORK_TO_NEW_CHAT_TEXT, expectedMatches: 1,
      timeoutMs: Math.min(source.timeoutMs, 5_000),
    },
  });
  const readback = await readConversationState(browser, source.assistantTurnId);
  if (!forkDestinationMenuReady(readback)) {
    throw executionFailure("failed", "GPT_FORK_DESTINATION_MENU_NOT_CONFIRMED");
  }
  return success({
    value: { sourceAssistantTurnId: source.assistantTurnId, state: "opened" },
    ...mutationFacts(intent, browser, readback.facts),
  });
};
