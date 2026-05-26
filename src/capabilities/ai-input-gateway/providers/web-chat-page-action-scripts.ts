import { WEB_CHAT_SELECTOR_SCRIPT_PRELUDE } from "./web-chat-selector-prelude.js";

export const CLEAR_COMPOSER_SCRIPT = `
${WEB_CHAT_SELECTOR_SCRIPT_PRELUDE}
for (const button of Array.from(document.querySelectorAll("button"))) {
  const label = clip(button.getAttribute("aria-label") || button.textContent || "");
  if (/remove file|移除文件|删除文件/i.test(label) && button instanceof HTMLElement) {
    button.click();
  }
}
const input = resolveComposerInput();
if (input instanceof HTMLElement) {
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
}
return {status: "success", message: "provider composer cleared", pageUrl: location.href};
`;
