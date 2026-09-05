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
  checkpointActionsMenuAbsent,
  checkpointActionsMenuReady,
  checkpointActionsReadbackReady,
} from "./menu-state.js";
import {
  GPT_CHECKPOINT_ACTIONS_MENU_SELECTOR,
  GPT_OPEN_FORK_ACTION_SELECTOR,
  GPT_OPEN_FORK_ACTION_TEXT,
  gptMoreActionsButtonSelector,
} from "./selectors.js";

export const openGptCheckpointActionsMenuHandler:
GptChildHandler<"open_gpt_checkpoint_actions_menu"> = async (intent, context) => {
  requireExactInputKeys(intent, ["sourceAssistantTurnId", "sourceCanonicalConversationUrl", "sourcePromptHash",
    "sourceResponseHash", "sourceTurnMarker", "timeoutMs"]);
  const source = sourceCheckpointInput(intent);
  const browser = requireBrowser(context);
  const observed = await readConversationState(browser, source.assistantTurnId);
  const sourceFacts = await requireSourceCheckpoint(browser, source, observed);
  if (observed.triggerRaw !== 1 || observed.triggerEligible !== 1) {
    throw executionFailure("failed", "GPT_CHECKPOINT_ACTIONS_TRIGGER_NOT_UNIQUE");
  }
  if (checkpointActionsMenuReady(observed)) {
    return success({
      value: { sourceAssistantTurnId: source.assistantTurnId, state: "already-open" },
      ...declaredFacts({
        ...sourceFacts, decision: "DONE", mutationOutcome: "no", browserFact: null, nativeFailureCode: null,
      }),
    });
  }
  if (!checkpointActionsMenuAbsent(observed)) {
    throw executionFailure("failed", "GPT_CHECKPOINT_ACTIONS_MENU_AMBIGUOUS");
  }
  if (context.mutationMode === "readback") {
    throw executionFailure("failed", "GPT_CHECKPOINT_ACTIONS_MENU_NOT_CONFIRMED");
  }
  await browser.executeDomIntent({
    kind: "click", selector: gptMoreActionsButtonSelector(source.assistantTurnId), expectedMatches: 1,
    postClickMatch: {
      selector: `${GPT_CHECKPOINT_ACTIONS_MENU_SELECTOR} ${GPT_OPEN_FORK_ACTION_SELECTOR}`,
      textEquals: GPT_OPEN_FORK_ACTION_TEXT, expectedMatches: 1,
      timeoutMs: Math.min(source.timeoutMs, 5_000) },
  });
  const readback = await readConversationState(browser, source.assistantTurnId);
  if (!checkpointActionsReadbackReady(readback)) {
    throw executionFailure("failed", "GPT_CHECKPOINT_ACTIONS_MENU_NOT_CONFIRMED");
  }
  return success({
    value: { sourceAssistantTurnId: source.assistantTurnId, state: "opened" },
    ...mutationFacts(intent, browser, readback.facts),
  });
};
