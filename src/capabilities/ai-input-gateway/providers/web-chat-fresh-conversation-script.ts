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
const isFreshPath = location.hostname === "chatgpt.com"
  && (location.pathname === "/" || location.pathname === "");
const composerText = composer instanceof HTMLElement ? readComposerVisibleText(composer) : "";
const composerForms = composer instanceof HTMLElement
  ? Array.from(document.querySelectorAll("form")).filter((form) =>
      form.querySelector("div#prompt-textarea[contenteditable='true'][role='textbox']") === composer
    )
  : [];
const composerRoot = composerForms.length === 1 ? composerForms[0] : null;
const removeAttachmentCount = composerRoot instanceof HTMLElement
  ? composerRoot.querySelectorAll(
      'button[aria-label="Remove file"],button[aria-label="移除文件"],button[aria-label="删除文件"]'
    ).length
  : 0;
const composerRootText = composerRoot instanceof HTMLElement ? clip(composerRoot.innerText || "") : "";
const hasPastedTextCard = /已粘贴的文本|在文本字段中显示|pasted text|pasted content/i.test(composerRootText);
const markerPrefix = "[INTERNAL_TRANSPORT_MARKER:";
const markerSegments = composerText.split(markerPrefix).slice(1);
const markerAlphabet = "0123456789abcdef";
const composerTurnMarkers = markerSegments.map((segment) => {
  const closingBracket = segment.indexOf("]");
  const marker = closingBracket >= 0 ? segment.slice(0, closingBracket) : "";
  const suffix = marker.slice("GRASSEYE_TURN_".length);
  const exactMarker = marker.startsWith("GRASSEYE_TURN_")
    && suffix.length === 32
    && Array.from(suffix).every((character) => markerAlphabet.includes(character));
  return exactMarker ? marker : null;
}).filter((marker) => marker !== null);
const internalMarkerMentionCount = composerText.split("INTERNAL_TRANSPORT_MARKER:").length - 1;
const generationControls = Array.from(document.querySelectorAll(
  'button[data-testid="stop-button"],button[aria-label="Stop streaming"],button[aria-label="Stop generating"],button[aria-label="停止生成"],button[aria-label="停止回应"]'
));
const generating = generationControls.some(isVisible);
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
