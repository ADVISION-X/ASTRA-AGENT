const seenRoundInputs = new Set<string>();
let lastWebChatFeedAt = 0;

const WEB_CHAT_COOLDOWN_MS = 2_000;

export type AiFeedRateDecision = {
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
  if (input.transport === "web-chat") {
    const elapsed = Date.now() - lastWebChatFeedAt;
    if (elapsed < WEB_CHAT_COOLDOWN_MS) {
      return {
        ok: false,
        cooldownMs: WEB_CHAT_COOLDOWN_MS - elapsed,
        reason: "web chat cooldown is active.",
      };
    }
    lastWebChatFeedAt = Date.now();
  }
  if (roundKey) seenRoundInputs.add(roundKey);
  return { ok: true, cooldownMs: input.transport === "web-chat" ? WEB_CHAT_COOLDOWN_MS : 0, reason: null };
};
