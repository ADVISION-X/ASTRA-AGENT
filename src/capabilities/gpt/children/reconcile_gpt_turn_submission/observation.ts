import { createHash } from "node:crypto";
import { executionFailure } from "../../../../lib/execution-failure.js";

import type { BrowserTargetLease } from "../../../../lib/browser/browser-authority-api.js";
import type { GptChildCapabilityIntent } from "../../contract.js";
import { stringInput } from "../../web/child-handler.js";
import {
  projectCoherentObservation,
  readCoherentObservation,
  type GptCoherentFactProjection,
} from "../../web/gpt-dom-observation.js";
import {
  GPT_COMPOSER_SELECTOR,
  GPT_USER_TURN_SELECTOR,
} from "./selectors.js";
import { canonicalGptConversationUrl } from "../../web/contracts/target-document.contract.js";

const HASH = /^sha256:[a-f0-9]{64}$/u;

export const gptComposerHash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
export const composerHashInput = (
  intent: GptChildCapabilityIntent<"reconcile_gpt_turn_submission">,
  key: string,
): `sha256:${string}` => {
  const value = stringInput(intent, key);
  if (!HASH.test(value)) {
    throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:${key}`);
  }
  return value as `sha256:${string}`;
};
type DraftState = Readonly<{
  currentUrl: string;
  composerRaw: number;
  composerEligible: number;
  composerHash: string | null;
  userTurns: readonly Readonly<{ testId: string; promptHash: string }>[];
  facts: GptCoherentFactProjection;
}>;

const userTurnsFromObservation = (
  matches: readonly Readonly<Record<string, unknown>>[],
): readonly Readonly<{ testId: string; promptHash: string }>[] => Object.freeze(matches.map((match) => {
  if (typeof match.testId !== "string" || !/^conversation-turn-[1-9][0-9]*$/u.test(match.testId)
    || typeof match.exactGptUserPromptHash !== "string" || !HASH.test(match.exactGptUserPromptHash)) {
    throw executionFailure("failed", "GPT_DOM_RESULT_INVALID");
  }
  return Object.freeze({ testId: match.testId, promptHash: match.exactGptUserPromptHash });
}));

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
    { queryId: "user-turns", selector: GPT_USER_TURN_SELECTOR, maxMatches: 20,
      fields: ["testId" as const, "exactGptUserPromptHash" as const] },
  ]);
  const row = (queryId: string) => observation.rows.find((candidate) => candidate.queryId === queryId);
  const composer = row("composer")!;
  const userTurns = userTurnsFromObservation(row("user-turns")?.matches ?? []);
  return Object.freeze({
    currentUrl: observation.currentUrl,
    composerRaw: composer.rawCount,
    composerEligible: composer.eligibleCount,
    composerHash: exactComposerHash(composer.matches[0]),
    userTurns: Object.freeze(userTurns),
    facts: projectCoherentObservation(observation, "composer"),
  });
};

export const requireExactComposer = (state: DraftState): void => {
  if (state.composerRaw !== 1 || state.composerEligible !== 1 || state.composerHash === null) {
    throw executionFailure("failed", `GPT_COMPOSER_INVALID:raw=${state.composerRaw}:eligible=${state.composerEligible}`);
  }
};

export const canonicalConversationOrNull = (value: string): string | null => {
  try { return canonicalGptConversationUrl(value); } catch { return null; }
};

export const submissionMatch = (state: DraftState, promptHash: string) =>
  state.userTurns.filter((turn) => turn.promptHash === promptHash);
