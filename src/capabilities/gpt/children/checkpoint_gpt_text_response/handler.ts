import { executionFailure, executionFailureMetadata, failureCode } from "../../../../lib/execution-failure.js";
import { gptExecutionFailure } from "../../execution-fault.js";
import { type GptProviderObservationWaitReason } from "../../contract.js";
import type { ExactReadbackNegativeObservation } from "../../../../lib/execution-failure.js";

import { declaredFacts, numberInput, requireBrowser, requireExactInputKeys, stringInput, success, type GptChildHandler } from "../../web/child-handler.js";
import {
  projectExactAssistantTurn,
  readExactAssistantTurn,
} from "../../web/gpt-dom-observation.js";
import { canonicalGptConversationUrl } from "../../web/contracts/target-document.contract.js";

type ExactAssistantObservation = Awaited<ReturnType<typeof readExactAssistantTurn>>;

const emptyEndedObservation = (assistant: ExactAssistantObservation): never => {
  const facts = projectExactAssistantTurn(assistant);
  throw gptExecutionFailure("GPT_TEXT_RESPONSE_EMPTY_ENDED", {
    mutationOutcome: "no", proofFacts: { ...facts, decision: "FAIL_CLOSED", mutationOutcome: "no",
      browserFact: null, nativeFailureCode: null, emptyEndedAt: assistant.observedAt },
  });
};

const emptyReadbackFailure = (assistant: ExactAssistantObservation, userTurnId: string) =>
  executionFailure("failed", "GPT_TEXT_RESPONSE_EMPTY_ENDED", { metadata: {
    exactReadbackNegativeObservation: { pendingCause: "response-stopped-empty",
      canonicalConversationUrl: assistant.currentUrl, userTurnId,
      targetRefHash: assistant.targetRefHash, documentRefHash: assistant.documentRefHash,
      observationRevisionHash: projectExactAssistantTurn(assistant).observationRevisionHash!,
      observedAt: assistant.observedAt, generatingRaw: 0, firstObservedAt: assistant.observedAt,
      observationCount: 1 },
  } });

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
  const turnMarker = stringInput(intent, "turnMarker");
  const userTurnId = stringInput(intent, "userTurnId");
  const probeBudgetMs = numberInput(intent, "probeBudgetMs");
  if (!Number.isSafeInteger(probeBudgetMs) || probeBudgetMs < 1 || probeBudgetMs > 3_600_000) throw executionFailure("failed", "GPT_RESPONSE_PROBE_BUDGET_INVALID");
  return { conversationUrl, userTurnId, turnMarker, probeBudgetMs };
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
    const { conversationUrl, userTurnId, turnMarker, probeBudgetMs } = checkpointInput(intent);
    const browser = requireBrowser(context);
    const deadline = Date.now() + probeBudgetMs;
    let exactResponseObserved = false;
    let nextWaitReason: GptProviderObservationWaitReason = "initial-observation";
    const negativeWindow: { current: ExactReadbackNegativeObservation | null } = { current: null };
    while (Date.now() < deadline || exactResponseObserved) {
      const waitForProviderObservation = requireObservationGate(context);
      if (await waitForProviderObservation(exactResponseObserved ? null : deadline, nextWaitReason) === "deadline") {
        if (exactResponseObserved) continue;
        break;
      }
      let assistant: ExactAssistantObservation | null = null;
      try {
        assistant = await readExactAssistantTurn(browser, userTurnId, turnMarker, conversationUrl);
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
      if (!assistant) continue;
      if (assistant.generatingRaw > 0) {
        negativeWindow.current = null;
        nextWaitReason = "stop-present";
        continue;
      }
      if (context.settleLiveStoppedEmpty === true) emptyEndedObservation(assistant);
      exactResponseObserved = false;
      negativeWindow.current = recordNegativeObservation(negativeWindow.current, emptyReadbackFailure(assistant, userTurnId));
      nextWaitReason = "response-stopped-empty";
    }
    const lastNegative = negativeWindow.current;
    if (confirmedNegativeWindow(lastNegative)) {
      throw executionFailure("failed", "GPT_EXACT_READBACK_UNAVAILABLE", {
        metadata: { exactReadbackNegativeObservation: lastNegative },
      });
    }
    throw executionFailure("failed", "GPT_RESPONSE_TIMEOUT");
  };
