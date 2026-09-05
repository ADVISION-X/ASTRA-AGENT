import type { BrowserTargetLease } from "../../../../lib/browser/browser-authority-api.js";
import {
  projectCoherentObservation,
  readCoherentObservation,
  type GptCoherentFactProjection,
} from "../../web/gpt-dom-observation.js";
import { GPT_COMPOSER_SELECTOR } from "./selectors.js";

type ConversationState = Readonly<{
  currentUrl: string;
  composerRaw: number;
  composerEligible: number;
  facts: GptCoherentFactProjection;
}>;

export const readConversationState = async (
  browser: BrowserTargetLease,
): Promise<ConversationState> => {
  const observation = await readCoherentObservation(browser, [
    { queryId: "composer", selector: GPT_COMPOSER_SELECTOR, maxMatches: 2, fields: [] },
  ]);
  const composer = observation.rows[0]!;
  return Object.freeze({
    currentUrl: observation.currentUrl,
    composerRaw: composer.rawCount,
    composerEligible: composer.eligibleCount,
    facts: projectCoherentObservation(observation, "composer"),
  });
};
