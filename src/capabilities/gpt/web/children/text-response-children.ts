import { executionFailure } from "../../../../lib/execution-failure.js";
import type { BrowserTargetLease } from "../../../../lib/browser/browser-authority-api.js";

import type { GptChildHandlerMap } from "../child-handler.js";
import {
  declaredFacts, requireBrowser, requireConfirmedBrowserFact, requireExactInputKeys, stringInput, success,
} from "../child-handler.js";
import {
  readExactAssistantTurn, type GptCoherentFactProjection, type GptExactAssistantTurnObservation,
} from "../gpt-dom-observation.js";
import {
  assistantTurnForPrompt, ensureResponseConversation, rateLimitState, type GptResponsePageState,
} from "../gpt-response-page.js";
import { GPT_RATE_LIMIT_ACK_SELECTOR, GPT_RATE_LIMIT_ROOT_SELECTOR } from "../gpt-page-selectors.js";
import { canonicalGptConversationUrl } from "../contracts/target-document.contract.js";

const HASH = /^sha256:[a-f0-9]{64}$/u;
const TURN = /^conversation-turn-[1-9][0-9]*$/u;
type AnyHandler = NonNullable<GptChildHandlerMap[keyof GptChildHandlerMap]>;
type AnyIntent = Parameters<AnyHandler>[0];

const hashInput = (intent: AnyIntent, key: string): `sha256:${string}` => {
  const value = stringInput(intent, key);
  if (!HASH.test(value)) throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:${key}`);
  return value as `sha256:${string}`;
};

const assistantFacts = (
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

const providerWait = (
  context: Parameters<AnyHandler>[1],
  browser: BrowserTargetLease,
  durationMs: number,
): Promise<void> => context.yieldForProviderWait
  ? context.yieldForProviderWait(Math.max(25, Math.min(5_000, Math.floor(durationMs))))
  : browser.wait({ durationMs: Math.max(25, Math.min(5_000, Math.floor(durationMs))) });

const maybeAcknowledgeRateLimit = async (
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

const completionFacts = (
  intent: AnyIntent,
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

type AssistantPageState = GptResponsePageState["assistantTurns"][number];
const stableTextObserved = (
  assistant: AssistantPageState | undefined,
  generatingCount: number,
  overdueRecoveryProbe: boolean,
  prior: Readonly<{ assistantTurnId: string; responseHash: string }> | null,
): assistant is AssistantPageState => Boolean(assistant
  && generatingCount === 0
  && assistant.semanticTextHash !== `sha256:${"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}`
  && (overdueRecoveryProbe || (prior?.assistantTurnId === assistant.testId
    && prior.responseHash === assistant.semanticTextHash)));

export const textResponseChildHandlers = {
  async wait_for_stable_gpt_text(intent, context) {
    requireExactInputKeys(intent, ["absoluteDeadline", "canonicalConversationUrl", "expectedPromptHash", "turnMarker"]);
    const canonicalConversationUrl = canonicalGptConversationUrl(stringInput(intent, "canonicalConversationUrl"));
    const expectedPromptHash = hashInput(intent, "expectedPromptHash");
    stringInput(intent, "turnMarker");
    const deadline = Date.parse(stringInput(intent, "absoluteDeadline"));
    if (!Number.isFinite(deadline) || deadline > Date.now() + 3_600_000) {
      throw executionFailure("failed", "GPT_RESPONSE_ABSOLUTE_DEADLINE_INVALID");
    }
    const browser = requireBrowser(context);
    const overdueRecoveryProbe = Date.now() >= deadline;
    let prior: Readonly<{ assistantTurnId: string; responseHash: string }> | null = null;
    let rateLimitAcknowledged = false;
    let probeDelayMs = 250;
    do {
      if (context.signal?.aborted) throw executionFailure("failed", "GPT_RESPONSE_WAIT_ABORTED");
      const observed = await ensureResponseConversation(browser, canonicalConversationUrl);
      const assistantTurnId = assistantTurnForPrompt(observed, expectedPromptHash);
      const assistantState = assistantTurnId === null ? undefined
        : observed.assistantTurns.find((turn) => turn.testId === assistantTurnId);
      if (stableTextObserved(assistantState, observed.generatingRaw, overdueRecoveryProbe, prior)) {
        const stableAssistantTurnId = assistantState.testId;
        const assistant = await readExactAssistantTurn(browser, stableAssistantTurnId);
        if (assistant.semanticText.trim().length > 0
          && assistant.semanticTextHash === assistantState.semanticTextHash) {
          const facts = assistantFacts(observed.facts, assistant);
          return success({
            value: { assistantTurnId: stableAssistantTurnId,
              responseHash: assistant.semanticTextHash, responseText: assistant.semanticText },
            ...completionFacts(intent, browser, facts, rateLimitAcknowledged),
          });
        }
      }
      if (assistantState && observed.generatingRaw === 0) {
        prior = Object.freeze({ assistantTurnId: assistantState.testId, responseHash: assistantState.semanticTextHash });
      }
      rateLimitAcknowledged = await maybeAcknowledgeRateLimit(
        browser, observed, rateLimitAcknowledged, context.mutationMode === "readback",
      );
      if (overdueRecoveryProbe) break;
      const remaining = deadline - Date.now();
      if (remaining >= 25) {
        await providerWait(context, browser, Math.min(probeDelayMs, remaining));
        probeDelayMs = Math.min(5_000, Math.ceil(probeDelayMs * 1.5));
      } else break;
    } while (Date.now() < deadline);
    throw executionFailure("failed", "GPT_RESPONSE_STABILITY_TIMEOUT");
  },

  async checkpoint_gpt_text_response(intent, context) {
    requireExactInputKeys(intent, [
      "assistantTurnId", "canonicalConversationUrl", "expectedPromptHash", "expectedResponseHash", "turnMarker",
    ]);
    const assistantTurnId = stringInput(intent, "assistantTurnId");
    if (!TURN.test(assistantTurnId)) {
      throw executionFailure("failed", "GPT_CHILD_INPUT_INVALID:checkpoint_gpt_text_response:assistantTurnId");
    }
    const canonicalConversationUrl = canonicalGptConversationUrl(stringInput(intent, "canonicalConversationUrl"));
    const expectedPromptHash = hashInput(intent, "expectedPromptHash");
    const expectedResponseHash = hashInput(intent, "expectedResponseHash");
    stringInput(intent, "turnMarker");
    const browser = requireBrowser(context);
    const observed = await ensureResponseConversation(browser, canonicalConversationUrl);
    if (assistantTurnForPrompt(observed, expectedPromptHash) !== assistantTurnId || observed.generatingRaw !== 0) {
      throw executionFailure("failed", "GPT_RESPONSE_CHECKPOINT_MISMATCH");
    }
    const assistant = await readExactAssistantTurn(browser, assistantTurnId);
    if (assistant.semanticText.trim().length === 0 || assistant.semanticTextHash !== expectedResponseHash) {
      throw executionFailure("failed", "GPT_RESPONSE_CHECKPOINT_MISMATCH");
    }
    const facts = assistantFacts(observed.facts, assistant);
    return success({
      value: { assistantTurnId, rawDomHtml: assistant.rawDomHtml, rawDomHash: assistant.rawDomHash,
        semanticText: assistant.semanticText, semanticTextHash: assistant.semanticTextHash },
      ...declaredFacts({ ...facts, decision: "DONE", mutationOutcome: "no",
        browserFact: null, nativeFailureCode: null }),
    });
  },
} satisfies GptChildHandlerMap;
