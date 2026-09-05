import type { BrowserTargetLease } from "../../../../lib/browser/browser-authority-api.js";
import { executionFailure } from "../../../../lib/execution-failure.js";

import type { GptChildCapabilityIntent, GptExecutionContext } from "../../contract.js";
import {
  declaredFacts,
  requireConfirmedBrowserFact,
  stringInput,
} from "../../web/child-handler.js";
import type {
  GptCoherentFactProjection,
  GptExactAssistantTurnObservation,
} from "../../web/gpt-dom-observation.js";
import { rateLimitState, type GptResponsePageState } from "./page-observation.js";
import { GPT_RATE_LIMIT_ACK_SELECTOR, GPT_RATE_LIMIT_ROOT_SELECTOR } from "./selectors.js";

const HASH = /^sha256:[a-f0-9]{64}$/u;

export const responseHashInput = (
  intent: GptChildCapabilityIntent<"wait_for_stable_gpt_text">,
  key: string,
): `sha256:${string}` => {
  const value = stringInput(intent, key);
  if (!HASH.test(value)) {
    throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:${key}`);
  }
  return value as `sha256:${string}`;
};
export const exactAssistantFacts = (
  facts: GptCoherentFactProjection,
  assistant: GptExactAssistantTurnObservation,
): GptCoherentFactProjection => {
  if (!facts.authorityRefHashes.includes(assistant.targetRefHash)
    || !facts.authorityRefHashes.includes(assistant.documentRefHash)) {
    throw executionFailure("failed", "GPT_EXACT_ASSISTANT_TURN_DOCUMENT_MISMATCH");
  }
  return Object.freeze({ ...facts, factResultIds: Object.freeze([
    ...facts.factResultIds, `gpt-assistant-turn-fact:${assistant.exactCallIdentityHash.slice(7)}`,
  ]) });
};

export const providerWait = (
  context: GptExecutionContext,
  browser: BrowserTargetLease,
  durationMs: number,
): Promise<void> => context.yieldForProviderWait
  ? context.yieldForProviderWait(Math.max(25, Math.min(5_000, Math.floor(durationMs))))
  : browser.wait({ durationMs: Math.max(25, Math.min(5_000, Math.floor(durationMs))) });

export const maybeAcknowledgeRateLimit = async (
  browser: BrowserTargetLease,
  state: GptResponsePageState,
  alreadyAcknowledged: boolean,
  readbackOnly: boolean,
): Promise<boolean> => {
  const rate = rateLimitState(state);
  if (rate === "absent") return alreadyAcknowledged;
  if (alreadyAcknowledged) throw executionFailure("failed", "GPT_PROVIDER_RATE_LIMIT_DIALOG_REPEATED");
  if (readbackOnly) throw executionFailure("failed", "GPT_PROVIDER_RATE_LIMIT_ACK_PENDING");
  await browser.executeDomIntent({
    kind: "click", selector: GPT_RATE_LIMIT_ACK_SELECTOR, expectedMatches: 1,
    postClickMatch: { selector: GPT_RATE_LIMIT_ROOT_SELECTOR, expectedMatches: 0, timeoutMs: 5_000 },
  });
  return true;
};

export const responseCompletionFacts = (
  intent: GptChildCapabilityIntent<"wait_for_stable_gpt_text">,
  browser: BrowserTargetLease,
  facts: GptCoherentFactProjection,
  acknowledged: boolean,
) => acknowledged ? (() => {
  const browserFact = requireConfirmedBrowserFact(intent, browser);
  return declaredFacts({ ...facts, decision: "ACT" as const,
    factResultIds: Object.freeze([...facts.factResultIds, browserFact.evidenceRef]),
    authorityRefHashes: Object.freeze([...facts.authorityRefHashes, browserFact.evidenceHash]),
    mutationOutcome: "confirmed" as const, browserFact, nativeFailureCode: null });
})() : declaredFacts({ ...facts, decision: "DONE", mutationOutcome: "no",
  browserFact: null, nativeFailureCode: null });
