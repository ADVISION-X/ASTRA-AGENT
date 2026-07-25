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
