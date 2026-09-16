import { executionFailure, failureCode } from "../../../../lib/execution-failure.js";
import { gptExecutionFailure } from "../../execution-fault.js";
import { gptCanonicalHash } from "../../contract.js";
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
): Readonly<{ window: StoppedEmptyWindow | null; confirmed: boolean }> => {
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
    while (Date.now() < deadline) {
      if (!context.waitForProviderObservation) {
        throw executionFailure("failed", "GPT_PROVIDER_OBSERVATION_GATE_REQUIRED");
      }
      if (await context.waitForProviderObservation(deadline) === "deadline") break;
      let assistant: Awaited<ReturnType<typeof readExactAssistantTurn>> | null = null;
      try {
        assistant = await readExactAssistantTurn(browser, userTurnId, conversationUrl);
      } catch (error) {
        if (failureCode(error) !== "BROWSER_DOM_CANDIDATE_MISSING") throw error;
      }
      if (assistant && assistant.generatingRaw === 0 && assistant.semanticText.trim().length > 0) {
        const facts = projectExactAssistantTurn(assistant);
        return success({
          value: { assistantTurnId: assistant.assistantTurnId, rawDomHtml: assistant.rawDomHtml, rawDomHash: assistant.rawDomHash,
            semanticText: assistant.semanticText, semanticTextHash: assistant.semanticTextHash },
          ...declaredFacts({ ...facts, decision: "DONE", mutationOutcome: "no",
            browserFact: null, nativeFailureCode: null }),
        });
      }
      if (!assistant) {
        stoppedEmptyWindow = null;
        continue;
      }
      const observedAt = performance.now();
      const identityHash = gptCanonicalHash({
        canonicalConversationUrl: assistant.currentUrl,
        userTurnId: assistant.precedingUserTurnId,
        assistantTurnId: assistant.assistantTurnId,
        targetRefHash: assistant.targetRefHash,
        documentRefHash: assistant.documentRefHash,
      });
      const stoppedEmpty = advanceStoppedEmptyWindow(stoppedEmptyWindow, {
        generatingRaw: assistant.generatingRaw,
        semanticText: assistant.semanticText,
        observedAt: assistant.observedAt,
        identityHash,
      }, observedAt);
      stoppedEmptyWindow = stoppedEmpty.window;
      if (!stoppedEmpty.confirmed) continue;
      if (!stoppedEmptyWindow) {
        throw executionFailure("failed", "GPT_STOPPED_EMPTY_WINDOW_INVALID");
      }
      throwStoppedEmptyFailure(assistant, stoppedEmptyWindow, observedAt);
    }
    throw executionFailure("failed", "GPT_RESPONSE_TIMEOUT");
  };
