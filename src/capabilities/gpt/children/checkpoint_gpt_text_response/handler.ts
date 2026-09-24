import { executionFailure, executionFailureMetadata, failureCode } from "../../../../lib/execution-failure.js";
import { gptExecutionFailure } from "../../execution-fault.js";
import { gptCanonicalHash, type GptProviderObservationWaitReason } from "../../contract.js";
import type { ExactReadbackNegativeObservation, ProviderStoppedEmptyProof } from "../../../../lib/execution-failure.js";

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

const checkpointInput = (intent: Parameters<GptChildHandler<"checkpoint_gpt_text_response">>[0]) => {
  requireExactInputKeys(intent, ["canonicalConversationUrl", "probeBudgetMs", "turnMarker", "userTurnId"]);
  const conversationUrl = canonicalGptConversationUrl(stringInput(intent, "canonicalConversationUrl"));
  stringInput(intent, "turnMarker");
  const userTurnId = stringInput(intent, "userTurnId");
  const probeBudgetMs = numberInput(intent, "probeBudgetMs");
  if (!Number.isSafeInteger(probeBudgetMs) || probeBudgetMs < 1 || probeBudgetMs > 3_600_000) throw executionFailure("failed", "GPT_RESPONSE_PROBE_BUDGET_INVALID");
  return { conversationUrl, userTurnId, probeBudgetMs };
};

const recordNegativeObservation = (
  current: ExactReadbackNegativeObservation | null,
  error: unknown,
): ExactReadbackNegativeObservation | null => {
  const negative = executionFailureMetadata(error)?.exactReadbackNegativeObservation;
  if (!negative || negative.generatingRaw !== 0) return null;
  const same = current !== null
    && current.canonicalConversationUrl === negative.canonicalConversationUrl
    && current.userTurnId === negative.userTurnId
    && current.targetRefHash === negative.targetRefHash
    && current.documentRefHash === negative.documentRefHash
    && current.pendingCause === negative.pendingCause;
  return Object.freeze({ ...negative,
    firstObservedAt: same ? current.firstObservedAt : negative.observedAt,
    observationCount: same ? current.observationCount + 1 : 1,
  });
};

const confirmedNegativeWindow = (
  observation: ExactReadbackNegativeObservation | null,
): observation is ExactReadbackNegativeObservation => observation !== null
  && observation.observationCount >= 2
  && Date.parse(observation.observedAt) > Date.parse(observation.firstObservedAt);

const requireObservationGate = (context: Parameters<GptChildHandler<"checkpoint_gpt_text_response">>[1]) => {
  const gate = context.waitForProviderObservation;
  if (!gate) throw executionFailure("failed", "GPT_PROVIDER_OBSERVATION_GATE_REQUIRED");
  return gate;
};

export const checkpointGptTextResponseHandler: GptChildHandler<"checkpoint_gpt_text_response"> =
  async (intent, context) => {
    const { conversationUrl, userTurnId, probeBudgetMs } = checkpointInput(intent);
    const browser = requireBrowser(context);
    const deadline = Date.now() + probeBudgetMs;
    let stoppedEmptyWindow: StoppedEmptyWindow | null = null;
    let exactResponseObserved = false;
    let nextWaitReason: GptProviderObservationWaitReason = "initial-observation";
    const negativeWindow: { current: ExactReadbackNegativeObservation | null } = { current: null };
    while (Date.now() < deadline || exactResponseObserved) {
      const waitForProviderObservation = requireObservationGate(context);
      const observationDeadline = exactResponseObserved
        ? Date.now() + GPT_STOPPED_EMPTY_CONFIRMATION_MS : deadline;
      if (await waitForProviderObservation(observationDeadline, nextWaitReason) === "deadline") {
        if (exactResponseObserved) continue;
        break;
      }
      let assistant: ExactAssistantObservation | null = null;
      try {
        assistant = await readExactAssistantTurn(browser, userTurnId, conversationUrl);
      } catch (error) {
        const code = failureCode(error);
        if (code === "BROWSER_EXACT_USER_TURN_UNAVAILABLE") {
          nextWaitReason = "exact-user-turn-unavailable";
        } else if (code === "BROWSER_ADJACENT_ASSISTANT_TURN_MISSING") {
          nextWaitReason = "adjacent-assistant-missing";
        } else {
          throw error;
        }
        negativeWindow.current = recordNegativeObservation(negativeWindow.current, error);
      }
      exactResponseObserved = assistant !== null;
      if (assistant && assistant.generatingRaw === 0 && assistant.semanticText.trim().length > 0) {
        return settledTextResponse(assistant);
      }
      if (!assistant) {
        stoppedEmptyWindow = null;
        continue;
      }
      negativeWindow.current = null;
      nextWaitReason = assistant.generatingRaw > 0
        ? "stop-present" : "stopped-empty-confirming";
      stoppedEmptyWindow = advanceObservedAssistant(assistant, stoppedEmptyWindow);
    }
    const lastNegative = negativeWindow.current;
    if (confirmedNegativeWindow(lastNegative)) {
      throw executionFailure("failed", "GPT_EXACT_READBACK_UNAVAILABLE", {
        metadata: { exactReadbackNegativeObservation: lastNegative },
      });
    }
    throw executionFailure("failed", "GPT_RESPONSE_TIMEOUT");
  };
