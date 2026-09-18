import { executionFailure, failureCode } from "../../../../lib/execution-failure.js";
import { gptExecutionFailure } from "../../execution-fault.js";
import { gptCanonicalHash, type GptProviderObservationWaitReason } from "../../contract.js";
import type { ProviderStoppedEmptyProof } from "../../../../lib/execution-failure.js";

import { declaredFacts, numberInput, requireBrowser, requireExactInputKeys, stringInput, success, type GptChildHandler } from "../../web/child-handler.js";
import {
  projectExactAssistantTurn,
  readExactAssistantTurn,
} from "../../web/gpt-dom-observation.js";
import { canonicalGptConversationUrl } from "../../web/contracts/target-document.contract.js";

export const GPT_STOPPED_EMPTY_CONFIRMATION_MS = 20 * 60 * 1_000;

type StoppedEmptyWindow = Readonly<{
  sinceMonotonicMs: number;
  firstObservedAt: string;
  observationCount: number;
  identityHash: `sha256:${string}`;
}>;

type ExactAssistantObservation = Awaited<ReturnType<typeof readExactAssistantTurn>>;

const throwStoppedEmptyFailure = (
  assistant: ExactAssistantObservation,
  window: StoppedEmptyWindow,
  observedAt: number,
): never => {
  const facts = projectExactAssistantTurn(assistant);
  const evidenceRef = facts.factResultIds[0];
  if (!evidenceRef || !facts.observationRevisionHash) {
    throw executionFailure("failed", "GPT_STOPPED_EMPTY_EVIDENCE_INVALID");
  }
  const stoppedEmptyProof: ProviderStoppedEmptyProof = Object.freeze({
    firstObservedAt: window.firstObservedAt,
    terminalObservedAt: assistant.observedAt,
    continuousMonotonicMs: Math.floor(observedAt - window.sinceMonotonicMs),
    observationCount: window.observationCount,
    identityHash: window.identityHash,
    terminalObservationRevisionHash: facts.observationRevisionHash,
  });
  throw gptExecutionFailure("GPT_RESPONSE_STOPPED_EMPTY", {
    mutationOutcome: "no", evidence: { evidenceRef, evidenceHash: facts.observationRevisionHash },
    proofFacts: Object.freeze({ ...facts, decision: "FAIL_CLOSED", mutationOutcome: "no",
      browserFact: null, nativeFailureCode: "GPT_RESPONSE_STOPPED_EMPTY", stoppedEmptyProof }),
  });
};

export const advanceStoppedEmptyWindow = (
  current: StoppedEmptyWindow | null,
  observation: Readonly<{
    generatingRaw: number;
    semanticText: string;
    observedAt: string;
    identityHash: `sha256:${string}`;
  }>,
  observedAt: number,
): Readonly<{ window: null; confirmed: false }> | Readonly<{ window: StoppedEmptyWindow; confirmed: boolean }> => {
  if (observation.generatingRaw > 0 || observation.semanticText.trim().length > 0) {
    return Object.freeze({ window: null, confirmed: false });
  }
  const window = current === null || current.identityHash !== observation.identityHash
    ? Object.freeze({
        sinceMonotonicMs: observedAt,
        firstObservedAt: observation.observedAt,
        observationCount: 1,
        identityHash: observation.identityHash,
      })
    : Object.freeze({ ...current, observationCount: current.observationCount + 1 });
  return Object.freeze({
    window,
    confirmed: observedAt - window.sinceMonotonicMs >= GPT_STOPPED_EMPTY_CONFIRMATION_MS,
  });
};

type ExactTurnRead = Readonly<{ assistant: ExactAssistantObservation }>
  | Readonly<{ assistant: null; waitReason: GptProviderObservationWaitReason }>;

/** One exact read; only the two pending Browser facts become a typed wait reason. */
const readExactTurnOrPending = async (
  browser: ReturnType<typeof requireBrowser>,
  userTurnId: string,
  conversationUrl: string,
): Promise<ExactTurnRead> => {
  try {
    return { assistant: await readExactAssistantTurn(browser, userTurnId, conversationUrl) };
  } catch (error) {
    const code = failureCode(error);
    if (code === "BROWSER_EXACT_USER_TURN_UNAVAILABLE") {
      return { assistant: null, waitReason: "exact-user-turn-unavailable" };
    }
    if (code === "BROWSER_ADJACENT_ASSISTANT_TURN_MISSING") {
      return { assistant: null, waitReason: "adjacent-assistant-missing" };
    }
    throw error;
  }
};

/** Advances the stopped-empty window for an observed, not yet settled assistant turn. */
const advanceObservedAssistant = (
  assistant: ExactAssistantObservation,
  current: StoppedEmptyWindow | null,
): StoppedEmptyWindow | null => {
  const observedAt = performance.now();
  const stoppedEmpty = advanceStoppedEmptyWindow(current, {
    generatingRaw: assistant.generatingRaw,
    semanticText: assistant.semanticText,
    observedAt: assistant.observedAt,
    identityHash: gptCanonicalHash({
      canonicalConversationUrl: assistant.currentUrl,
      userTurnId: assistant.precedingUserTurnId,
      assistantTurnId: assistant.assistantTurnId,
      targetRefHash: assistant.targetRefHash,
      documentRefHash: assistant.documentRefHash,
    }),
  }, observedAt);
  if (stoppedEmpty.confirmed) throwStoppedEmptyFailure(assistant, stoppedEmpty.window, observedAt);
  return stoppedEmpty.window;
};

const settledTextResponse = (assistant: ExactAssistantObservation) => success({
  value: { assistantTurnId: assistant.assistantTurnId, rawDomHtml: assistant.rawDomHtml,
    rawDomHash: assistant.rawDomHash, semanticText: assistant.semanticText,
    semanticTextHash: assistant.semanticTextHash },
  ...declaredFacts({ ...projectExactAssistantTurn(assistant), decision: "DONE", mutationOutcome: "no",
    browserFact: null, nativeFailureCode: null }),
});

export const checkpointGptTextResponseHandler: GptChildHandler<"checkpoint_gpt_text_response"> =
  async (intent, context) => {
    requireExactInputKeys(intent, ["canonicalConversationUrl", "probeBudgetMs", "turnMarker", "userTurnId"]);
    const conversationUrl = canonicalGptConversationUrl(stringInput(intent, "canonicalConversationUrl"));
    stringInput(intent, "turnMarker");
    const userTurnId = stringInput(intent, "userTurnId");
    const probeBudgetMs = numberInput(intent, "probeBudgetMs");
    if (!Number.isSafeInteger(probeBudgetMs) || probeBudgetMs < 1 || probeBudgetMs > 3_600_000) throw executionFailure("failed", "GPT_RESPONSE_PROBE_BUDGET_INVALID");
    const browser = requireBrowser(context);
    const deadline = Date.now() + probeBudgetMs;
    let stoppedEmptyWindow: StoppedEmptyWindow | null = null;
    let exactResponseObserved = false;
    let nextWaitReason: GptProviderObservationWaitReason = "initial-observation";
    while (Date.now() < deadline || exactResponseObserved) {
      if (!context.waitForProviderObservation) {
        throw executionFailure("failed", "GPT_PROVIDER_OBSERVATION_GATE_REQUIRED");
      }
      const observationDeadline = exactResponseObserved
        ? Date.now() + GPT_STOPPED_EMPTY_CONFIRMATION_MS : deadline;
      if (await context.waitForProviderObservation(observationDeadline, nextWaitReason) === "deadline") {
        if (exactResponseObserved) continue;
        break;
      }
      const read = await readExactTurnOrPending(browser, userTurnId, conversationUrl);
      exactResponseObserved = read.assistant !== null;
      if (read.assistant === null) {
        nextWaitReason = read.waitReason;
        stoppedEmptyWindow = null;
        continue;
      }
      const assistant = read.assistant;
      if (assistant.generatingRaw === 0 && assistant.semanticText.trim().length > 0) {
        return settledTextResponse(assistant);
      }
      nextWaitReason = assistant.generatingRaw > 0 ? "stop-present" : "stopped-empty-confirming";
      stoppedEmptyWindow = advanceObservedAssistant(assistant, stoppedEmptyWindow);
    }
    throw executionFailure("failed", "GPT_RESPONSE_TIMEOUT");
  };
