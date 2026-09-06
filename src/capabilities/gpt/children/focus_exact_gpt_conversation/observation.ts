import type { BrowserTargetLease } from "../../../../lib/browser/browser-authority-api.js";
import {
  projectCoherentObservation,
  readCoherentObservation,
  type GptCoherentFactProjection,
} from "../../web/gpt-dom-observation.js";
import { GPT_COMPOSER_SELECTOR } from "./selectors.js";

const GPT_USER_TURN_SELECTOR = "[data-testid^='conversation-turn-'][data-turn='user']";

type ConversationState = Readonly<{
  currentUrl: string;
  composerRaw: number;
  composerEligible: number;
  matchingTurnCount: number;
  facts: GptCoherentFactProjection;
}>;

export const readConversationState = async (
  browser: BrowserTargetLease,
  expectedPromptHash: string,
  turnMarker: string,
): Promise<ConversationState> => {
  const observation = await readCoherentObservation(browser, [
    { queryId: "composer", selector: GPT_COMPOSER_SELECTOR, maxMatches: 2, fields: [] },
    { queryId: "identity-turn", selector: GPT_USER_TURN_SELECTOR, maxMatches: 2,
      exactGptUserPromptContains: turnMarker, fields: ["exactGptUserPromptHash"] },
  ]);
  const composer = observation.rows[0]!;
  const matchingTurnCount = observation.rows[1]!.matches.filter((match) =>
    match.exactGptUserPromptHash === expectedPromptHash).length;
  return Object.freeze({
    currentUrl: observation.currentUrl,
    composerRaw: composer.rawCount,
    composerEligible: composer.eligibleCount,
    matchingTurnCount,
    facts: projectCoherentObservation(observation, "composer"),
  });
};
