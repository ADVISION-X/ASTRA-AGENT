const seenRoundInputs = new Set<string>();

type AiFeedRateDecision = {
  ok: boolean;
  cooldownMs: number;
  reason: string | null;
};

export const checkAiFeedRateGuard = (input: {
  inputHash: string;
  roundId: string | null;
  transport: "api" | "web-chat";
}): AiFeedRateDecision => {
  const roundKey = input.roundId ? `${input.roundId}:${input.inputHash}` : null;
  if (roundKey && seenRoundInputs.has(roundKey)) {
    return {
      ok: false,
      cooldownMs: 0,
      reason: "duplicate inputHash in the same round.",
    };
  }
  if (roundKey) seenRoundInputs.add(roundKey);
  return { ok: true, cooldownMs: 0, reason: null };
};
