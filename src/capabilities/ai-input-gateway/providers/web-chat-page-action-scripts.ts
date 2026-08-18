import { WEB_CHAT_SELECTOR_SCRIPT_PRELUDE } from "./web-chat-selector-prelude.js";

export const CLEAR_COMPOSER_SCRIPT = `
${WEB_CHAT_SELECTOR_SCRIPT_PRELUDE}
const input = resolveComposerInput();
if (!(input instanceof HTMLElement)) {
  return {status: "review_required", message: "provider composer not uniquely found", pageUrl: location.href};
}
let composerRoot = input.closest("form");
if (!(composerRoot instanceof HTMLElement)) {
  let cursor = input.parentElement;
  for (let depth = 0; depth < 6 && cursor; depth += 1) {
    const isComposerBoundary = /composer|input-area|prompt-area/i.test(String(cursor.className || ""))
      || Boolean(cursor.querySelector("[data-testid='send-button'], button[aria-label*='Send'], button[aria-label*='发送']"));
    if (isComposerBoundary) {
      composerRoot = cursor;
      break;
    }
    cursor = cursor.parentElement;
  }
}
if (!(composerRoot instanceof HTMLElement)) {
  return {status: "review_required", message: "provider composer root not uniquely proven", pageUrl: location.href};
}
if (composerRoot.querySelector("[data-testid^='conversation-turn-'], [data-message-author-role]")) {
  return {status: "review_required", message: "provider composer scope contains conversation history", pageUrl: location.href};
}
for (const button of Array.from(composerRoot.querySelectorAll("button"))) {
  const label = clip(button.getAttribute("aria-label") || button.textContent || "");
  if (/remove file|移除文件|删除文件/i.test(label) && button instanceof HTMLElement) {
    button.click();
  }
}
input.focus();
if (!input.isContentEditable) {
  return {status: "review_required", message: "provider composer is not the editable root", pageUrl: location.href};
}
const selection = window.getSelection();
const range = document.createRange();
range.selectNodeContents(input);
selection?.removeAllRanges();
selection?.addRange(range);
const deletedByEditor = document.execCommand("delete");
if (!deletedByEditor || clip(input.textContent || "").length > 0) {
  input.textContent = "";
  input.dispatchEvent(new InputEvent("input", {bubbles: true, inputType: "deleteContentBackward", data: null}));
}
return {
  status: "success",
  message: "provider composer clear action issued inside exact composer scope",
  pageUrl: location.href,
  composerTextLength: clip(input.textContent || "").length,
};
`;

export const buildClearProvenSubmittedRootDraftScript = (
  expectedTurnMarker: string,
): string => `
${WEB_CHAT_SELECTOR_SCRIPT_PRELUDE}
const expectedTurnMarker = ${JSON.stringify(expectedTurnMarker)};
const input = resolveComposerInput();
if (!(input instanceof HTMLElement) || !input.isContentEditable) {
  return {status: "review_required", message: "owned stale draft composer not uniquely editable", pageUrl: location.href};
}
const pageUrl = new URL(location.href);
const composerText = readComposerVisibleText(input);
const composerRoot = input.closest("form");
const userCount = document.querySelectorAll('[data-message-author-role="user"]').length;
const assistantCount = document.querySelectorAll('[data-message-author-role="assistant"]').length;
const markers = Array.from(
  composerText.matchAll(/\\[INTERNAL_TRANSPORT_MARKER:(GRASSEYE_TURN_[a-f0-9]{32})\\]/gu),
  (match) => match[1],
);
const markerMentionCount = (composerText.match(/INTERNAL_TRANSPORT_MARKER:/gu) || []).length;
const removeAttachmentCount = composerRoot instanceof HTMLElement
  ? Array.from(composerRoot.querySelectorAll("button")).filter((button) =>
      /remove file|移除文件|删除文件/i.test(clip(button.getAttribute("aria-label") || button.textContent || ""))
    ).length
  : -1;
const composerRootText = composerRoot instanceof HTMLElement ? clip(composerRoot.innerText || "") : "";
const hasPastedTextCard = /已粘贴的文本|在文本字段中显示|pasted text|pasted content/i.test(composerRootText);
const generatingButton = document.querySelector(
  "button[data-testid*='stop' i], button[aria-label*='stop streaming' i], button[aria-label*='stop generating' i], button[aria-label*='停止生成'], button[aria-label*='停止回应']",
);
const generating = generatingButton instanceof HTMLElement && isVisible(generatingButton);
const guarded = pageUrl.host === "chatgpt.com"
  && (pageUrl.pathname === "/" || pageUrl.pathname === "")
  && userCount === 0
  && assistantCount === 0
  && composerText.length > 0
  && removeAttachmentCount === 0
  && !hasPastedTextCard
  && !generating
  && markers.length === 1
  && markerMentionCount === 1
  && markers[0] === expectedTurnMarker;
if (!guarded) {
  return {
    status: "review_required",
    message: "owned stale draft guard changed before clear",
    pageUrl: location.href,
    composerTextLength: composerText.length,
    composerTurnMarkers: markers,
    internalMarkerMentionCount: markerMentionCount,
  };
}
input.focus();
const selection = window.getSelection();
const range = document.createRange();
range.selectNodeContents(input);
selection?.removeAllRanges();
selection?.addRange(range);
const deletedByEditor = document.execCommand("delete");
if (!deletedByEditor || readComposerVisibleText(input).length > 0) {
  input.textContent = "";
  input.dispatchEvent(new InputEvent("input", {bubbles: true, inputType: "deleteContentBackward", data: null}));
}
return {
  status: readComposerVisibleText(input).length === 0 ? "success" : "pending",
  message: "uniquely owned submitted root draft clear issued",
  pageUrl: location.href,
  composerTextLength: readComposerVisibleText(input).length,
};
`;
