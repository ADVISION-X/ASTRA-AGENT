import { WEB_CHAT_SELECTOR_SCRIPT_PRELUDE } from "./web-chat-selector-prelude.js";

const CHATGPT_FRESH_ZERO_STATE_FIELDS = [
  "userCount",
  "assistantCount",
  "composerText.length",
  "removeAttachmentCount",
] as const;

export const CHATGPT_FRESH_CONVERSATION_SCRIPT = `
${WEB_CHAT_SELECTOR_SCRIPT_PRELUDE}
const composer = resolveComposerInput();
const userCount = document.querySelectorAll('[data-message-author-role="user"]').length;
const assistantCount = document.querySelectorAll('[data-message-author-role="assistant"]').length;
const pageUrl = new URL(location.href);
const isFreshPath = pageUrl.host === "chatgpt.com" && (pageUrl.pathname === "/" || pageUrl.pathname === "");
const composerText = composer instanceof HTMLElement ? readComposerVisibleText(composer) : "";
const composerRoot = composer instanceof HTMLElement ? composer.closest("form") : null;
const removeAttachmentCount = composerRoot instanceof HTMLElement
  ? Array.from(composerRoot.querySelectorAll("button")).filter((button) =>
      /remove file|移除文件|删除文件/i.test(clip(button.getAttribute("aria-label") || button.textContent || ""))
    ).length
  : 0;
const composerRootText = composerRoot instanceof HTMLElement ? clip(composerRoot.innerText || "") : "";
const hasPastedTextCard = /已粘贴的文本|在文本字段中显示|pasted text|pasted content/i.test(composerRootText);
const composerTurnMarkers = Array.from(
  composerText.matchAll(/\\[INTERNAL_TRANSPORT_MARKER:(GRASSEYE_TURN_[a-f0-9]{32})\\]/gu),
  (match) => match[1],
);
const internalMarkerMentionCount = (
  composerText.match(/INTERNAL_TRANSPORT_MARKER:/gu) || []
).length;
const generating = Array.from(document.querySelectorAll("button")).some((button) =>
  isVisible(button)
  && /stop streaming|stop generating|停止生成|停止回应/i.test(clip(
    button.getAttribute("aria-label") || button.getAttribute("title") || button.textContent || ""
  ))
);
const isFreshConversation = Boolean(composer)
  && isFreshPath
${CHATGPT_FRESH_ZERO_STATE_FIELDS.map((field) => `  && ${field} === 0`).join("\n")}
  && !hasPastedTextCard
  && !generating;
const eligibleSubmittedDraftCleanup = Boolean(composer)
  && isFreshPath
  && userCount === 0
  && assistantCount === 0
  && composerText.length > 0
  && removeAttachmentCount === 0
  && !hasPastedTextCard
  && !generating
  && composerTurnMarkers.length === 1
  && internalMarkerMentionCount === 1;
return {
  status: isFreshConversation ? "success" : "pending",
  message: isFreshConversation
    ? "ChatGPT fresh conversation established"
    : "ChatGPT fresh conversation pending",
  pageUrl: location.href,
  userCount,
  assistantCount,
  isFreshPath,
  composerReady: Boolean(composer),
  composerTextLength: composerText.length,
  composerTurnMarkers,
  internalMarkerMentionCount,
  eligibleSubmittedDraftCleanup,
  removeAttachmentCount,
  hasPastedTextCard,
  generating,
};
`;
