import { executionFailure } from "../../../../lib/execution-failure.js";

import {
  declaredFacts,
  requireBrowser,
  requireExactInputKeys,
  success,
  type GptChildHandler,
} from "../../web/child-handler.js";
import {
  hashConversationValue,
  mutationFacts,
  readConversationState,
  requireSourceCheckpoint,
  sourceCheckpointInput,
} from "./observation.js";
import { canonicalGptConversationUrl } from "../../web/contracts/target-document.contract.js";
import { forkDestinationMenuReady } from "./menu-state.js";
import {
  GPT_FORK_DESTINATION_MENU_SELECTOR,
  GPT_FORK_TO_NEW_CHAT_SELECTOR,
  GPT_FORK_TO_NEW_CHAT_TEXT,
} from "./selectors.js";

const relationHash = (source: ReturnType<typeof sourceCheckpointInput>, childUrl: string) =>
  hashConversationValue(`${source.sourceUrl}\n${source.assistantTurnId}\n${source.responseHash}\n${childUrl}`);

export const forkExactGptConversationAtCheckpointHandler:
GptChildHandler<"fork_exact_gpt_conversation_at_checkpoint"> = async (intent, context) => {
  requireExactInputKeys(intent, ["sourceAssistantTurnId", "sourceCanonicalConversationUrl", "sourcePromptHash",
    "sourceResponseHash", "sourceTurnMarker", "timeoutMs"]);
  const source = sourceCheckpointInput(intent);
  const browser = requireBrowser(context);
  const observed = await readConversationState(browser, source.assistantTurnId);
  if (context.mutationMode === "readback") {
    const childUrl = canonicalGptConversationUrl(observed.currentUrl);
    if (childUrl === source.sourceUrl) throw executionFailure("failed", "GPT_FORK_CHILD_NOT_CONFIRMED");
    const childFacts = await requireSourceCheckpoint(browser, { ...source, sourceUrl: childUrl }, observed);
    return success({
      value: { sourceCanonicalConversationUrl: source.sourceUrl, sourceAssistantTurnId: source.assistantTurnId,
        childCanonicalConversationUrl: childUrl, sourceToChildRelationHash: relationHash(source, childUrl) },
      ...declaredFacts({ ...childFacts, decision: "DONE", mutationOutcome: "no",
        browserFact: null, nativeFailureCode: null }),
    });
  }
  await requireSourceCheckpoint(browser, source, observed);
  if (!forkDestinationMenuReady(observed)) {
    throw executionFailure("failed", "GPT_FORK_ACTION_NOT_UNIQUE");
  }
  await browser.executeDomIntent({
    kind: "click", selector: GPT_FORK_TO_NEW_CHAT_SELECTOR,
    scope: { selector: GPT_FORK_DESTINATION_MENU_SELECTOR },
    expectedTextEquals: GPT_FORK_TO_NEW_CHAT_TEXT, expectedMatches: 1,
    postClickTargetTransition: { kind: "gpt-fork-successor", timeoutMs: Math.min(source.timeoutMs, 5_000) },
  });
  const readback = await readConversationState(browser);
  const childUrl = canonicalGptConversationUrl(readback.currentUrl);
  if (childUrl === source.sourceUrl) throw executionFailure("failed", "GPT_FORK_CHILD_NOT_CONFIRMED");
  const childFacts = await requireSourceCheckpoint(browser, { ...source, sourceUrl: childUrl }, readback);
  return success({
    value: { sourceCanonicalConversationUrl: source.sourceUrl, sourceAssistantTurnId: source.assistantTurnId,
      childCanonicalConversationUrl: childUrl, sourceToChildRelationHash: relationHash(source, childUrl) },
    ...mutationFacts(intent, browser, childFacts),
  });
};
