import assert from "node:assert/strict";

import {
  advanceStableAnswer,
  createStableAnswerState,
} from "../providers/web-chat-answer-support.js";

export const assertPartialAnswerQuietWindow = (): void => {
  let stableAnswerState = createStableAnswerState();
  const quietWindowStartedAt = stableAnswerState.lastActivityAt;
  const partialAnswer = {
    status: "success" as const,
    message: "partial streamed answer",
    answerText: '{"',
    pageUrl: "https://chatgpt.com/c/partial",
    generating: false,
    assistantCount: 1,
    userMessageCount: 1,
    conversationTurnIds: ["conversation-turn-1", "conversation-turn-2"],
  };
  let progress = advanceStableAnswer({
    evaluation: partialAnswer,
    minStableDurationMs: 3_000,
    now: quietWindowStartedAt,
    stableRoundsRequired: 2,
    state: stableAnswerState,
  });
  stableAnswerState = progress.nextState;
  progress = advanceStableAnswer({
    evaluation: partialAnswer,
    minStableDurationMs: 3_000,
    now: quietWindowStartedAt + 1_500,
    stableRoundsRequired: 2,
    state: stableAnswerState,
  });
  assert.equal(
    progress.successEvaluation,
    null,
    "an unchanged partial stream must not complete before the quiet window",
  );
  progress = advanceStableAnswer({
    evaluation: partialAnswer,
    minStableDurationMs: 3_000,
    now: quietWindowStartedAt + 3_000,
    stableRoundsRequired: 2,
    state: progress.nextState,
  });
  assert.equal(progress.successEvaluation?.answerText, '{"');
};
