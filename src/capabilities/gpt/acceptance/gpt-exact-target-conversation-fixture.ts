import { hashConversationValue } from "../children/prepare_clean_gpt_chat/observation.js";

type ConversationOverrides = Readonly<{
  user?: number;
  assistant?: number;
  attachments?: number;
  generating?: number;
  mode?: "chat" | "work" | "invalid";
  chatModeRaw?: number;
  chatModeEligible?: number;
  workModeRaw?: number;
  workModeEligible?: number;
}>;

const countFacts = (count: number) => ({ rawCount: count, eligibleCount: count });
const modeFacts = (raw: number, eligible: number, checked: "true" | "false") => ({
  rawCount: raw, eligibleCount: eligible,
  matches: raw === 0 ? [] : [{ ariaPressed: checked }],
});

export const conversationFacts = (
  draft: string | null,
  overrides: ConversationOverrides = {},
) => {
  const chatModeRaw = overrides.chatModeRaw ?? 1;
  const workModeRaw = overrides.workModeRaw ?? 1;
  return {
    composer: { rawCount: draft === null ? 0 : 1, eligibleCount: draft === null ? 0 : 1,
      matches: draft === null ? [] : [{ exactEditableTextHash: hashConversationValue(draft) }] },
    "user-turns": countFacts(overrides.user ?? 0),
    "assistant-turns": countFacts(overrides.assistant ?? 0),
    attachments: countFacts(overrides.attachments ?? 0),
    generating: countFacts(overrides.generating ?? 0),
    "chat-mode": modeFacts(chatModeRaw, overrides.chatModeEligible ?? chatModeRaw,
      overrides.mode === "work" ? "false" : "true"),
    "work-mode": modeFacts(workModeRaw, overrides.workModeEligible ?? workModeRaw,
      overrides.mode === "work" || overrides.mode === "invalid" ? "true" : "false"),
  };
};
