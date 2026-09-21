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

export const conversationFacts = (
  draft: string | null,
  overrides: ConversationOverrides = {},
) => ({
  composer: { rawCount: draft === null ? 0 : 1, eligibleCount: draft === null ? 0 : 1,
    matches: draft === null ? [] : [{ exactEditableTextHash: hashConversationValue(draft) }] },
  "user-turns": { rawCount: overrides.user ?? 0, eligibleCount: overrides.user ?? 0 },
  "assistant-turns": { rawCount: overrides.assistant ?? 0, eligibleCount: overrides.assistant ?? 0 },
  attachments: { rawCount: overrides.attachments ?? 0, eligibleCount: overrides.attachments ?? 0 },
  generating: { rawCount: overrides.generating ?? 0, eligibleCount: overrides.generating ?? 0 },
  "chat-mode": { rawCount: overrides.chatModeRaw ?? 1,
    eligibleCount: overrides.chatModeEligible ?? overrides.chatModeRaw ?? 1,
    matches: (overrides.chatModeRaw ?? 1) === 0 ? []
      : [{ ariaChecked: overrides.mode === "work" ? "false" : "true" }] },
  "work-mode": { rawCount: overrides.workModeRaw ?? 1,
    eligibleCount: overrides.workModeEligible ?? overrides.workModeRaw ?? 1,
    matches: (overrides.workModeRaw ?? 1) === 0 ? []
      : [{ ariaChecked: overrides.mode === "work" ? "true"
        : overrides.mode === "invalid" ? "true" : "false" }] },
});
