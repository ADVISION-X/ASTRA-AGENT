const seenRoundInputs = new Map<string, string | null>();

type AiFeedRateDecision = {
  ok: boolean;
  cooldownMs: number;
  reason: string | null;
};

export const checkAiFeedRateGuard = (input: {
  inputHash: string;
  roundId: string | null;
  transport: "api" | "web-chat";
  executionId: string | null;
  supersededExecutionId: string | null;
}): AiFeedRateDecision => {
  const roundKey = input.roundId ? `${input.roundId}:${input.inputHash}` : null;
  const existingExecutionId = roundKey
    ? seenRoundInputs.get(roundKey)
    : undefined;
  const replacesExactPriorExecution = Boolean(
    roundKey
    && input.executionId
    && existingExecutionId
    && input.supersededExecutionId === existingExecutionId,
  );
  if (roundKey && replacesExactPriorExecution) {
    seenRoundInputs.set(roundKey, input.executionId);
    return { ok: true, cooldownMs: 0, reason: null };
  }
  if (roundKey && existingExecutionId !== undefined && (
    !input.executionId
    || !existingExecutionId
    || existingExecutionId !== input.executionId
  )) {
    return {
      ok: false,
      cooldownMs: 0,
      reason: "duplicate inputHash in the same round.",
    };
  }
  if (roundKey && existingExecutionId === undefined) {
    seenRoundInputs.set(roundKey, input.executionId);
  }
  return { ok: true, cooldownMs: 0, reason: null };
};
