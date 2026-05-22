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
  input.textContent = "";
  input.dispatchEvent(new InputEvent("input", {bubbles: true, inputType: "deleteContentBackward", data: null}));
}
return {status: "success", message: "provider composer cleared", pageUrl: location.href};
`;

export const FIND_COMPOSER_POINT_SCRIPT = `
${WEB_CHAT_SELECTOR_SCRIPT_PRELUDE}
const browserChromeTopInset = Math.max(0, window.outerHeight - window.innerHeight);
const input = resolveComposerInput();
if (!(input instanceof HTMLElement)) {
  return {status: "review_required", message: "provider input box not found", pageUrl: location.href};
}
const rect = input.getBoundingClientRect();
return {
  status: "success",
  message: "provider composer point located",
  pageUrl: location.href,
  x: Math.round(window.screenX + rect.x + Math.max(10, Math.min(rect.width / 2, 220))),
  y: Math.round(window.screenY + browserChromeTopInset + rect.y + Math.max(10, Math.min(rect.height / 2, 32))),
};
`;

export const CLICK_SUBMIT_BUTTON_SCRIPT = `
${WEB_CHAT_SELECTOR_SCRIPT_PRELUDE}
const input = resolveComposerInput();
const composerForm = input instanceof HTMLElement ? input.closest("form") : null;
const submit = composerForm?.querySelector("#composer-submit-button, button[data-testid='send-button']");
if (!(submit instanceof HTMLButtonElement || submit instanceof HTMLElement)) {
  return {status: "review_required", message: "provider submit button not found", pageUrl: location.href};
}
if ("disabled" in submit && submit.disabled === true) {
  return {status: "pending", message: "provider submit button disabled", pageUrl: location.href};
}
submit.click();
return {status: "success", message: "provider submit button clicked", pageUrl: location.href};
`;

export const FIND_SUBMIT_BUTTON_POINT_SCRIPT = `
${WEB_CHAT_SELECTOR_SCRIPT_PRELUDE}
const browserChromeTopInset = Math.max(0, window.outerHeight - window.innerHeight);
const input = resolveComposerInput();
const composerForm = input instanceof HTMLElement ? input.closest("form") : null;
const submit = composerForm?.querySelector("#composer-submit-button, button[data-testid='send-button']");
if (!(submit instanceof HTMLElement)) {
  return {status: "review_required", message: "provider submit button not found", pageUrl: location.href};
}
if ("disabled" in submit && submit.disabled === true) {
  return {status: "pending", message: "provider submit button disabled", pageUrl: location.href};
}
const rect = submit.getBoundingClientRect();
return {
  status: "success",
  message: "provider submit button point located",
  pageUrl: location.href,
  x: Math.round(window.screenX + rect.x + rect.width / 2),
  y: Math.round(window.screenY + browserChromeTopInset + rect.y + rect.height / 2),
};
`;
