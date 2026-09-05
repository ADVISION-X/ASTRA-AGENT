import { createHash } from "node:crypto";
import { executionFailure } from "../../../../lib/execution-failure.js";

import type { BrowserTargetLease } from "../../../../lib/browser/browser-authority-api.js";
import {
  projectCoherentObservation,
  readCoherentObservation,
  type GptCoherentFactProjection,
} from "../../web/gpt-dom-observation.js";
import { GPT_COMPOSER_SELECTOR } from "./selectors.js";

const HASH = /^sha256:[a-f0-9]{64}$/u;

export const gptComposerHash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

export const promptIdentity = (text: string) => Object.freeze({
  length: text.length,
  prefix: text.slice(0, 80),
  suffix: text.slice(-80),
  hash: gptComposerHash(text),
});
export type DraftState = Readonly<{
  composerRaw: number;
  composerEligible: number;
  composerHash: string | null;
  facts: GptCoherentFactProjection;
}>;

const exactComposerHash = (match: Readonly<Record<string, unknown>> | undefined): string | null => {
  const value = match?.exactEditableTextHash;
  if (value !== undefined && (typeof value !== "string" || !HASH.test(value))) {
    throw executionFailure("failed", "GPT_DOM_RESULT_INVALID");
  }
  return typeof value === "string" ? value : null;
};

export const readDraftState = async (
  browser: BrowserTargetLease,
): Promise<DraftState> => {
  const observation = await readCoherentObservation(browser, [
    { queryId: "composer", selector: GPT_COMPOSER_SELECTOR, maxMatches: 2,
      fields: ["exactEditableTextHash" as const] },
  ]);
  const composer = observation.rows[0]!;
  return Object.freeze({
    composerRaw: composer.rawCount,
    composerEligible: composer.eligibleCount,
    composerHash: exactComposerHash(composer.matches[0]),
    facts: projectCoherentObservation(observation, "composer"),
  });
};

export const requireExactComposer = (state: DraftState): void => {
  if (state.composerRaw !== 1 || state.composerEligible !== 1 || state.composerHash === null) {
    throw executionFailure("failed", `GPT_COMPOSER_INVALID:raw=${state.composerRaw}:eligible=${state.composerEligible}`);
  }
};
