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
  if (input.isContentEditable) {
    input.textContent = "";
    input.dispatchEvent(new InputEvent("input", {bubbles: true, inputType: "deleteContentBackward", data: null}));
  } else if ("value" in input) {
    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value");
    if (descriptor && typeof descriptor.set === "function") descriptor.set.call(input, "");
    else input.value = "";
    input.dispatchEvent(new InputEvent("input", {bubbles: true, inputType: "deleteContentBackward", data: null}));
  }
}
return {status: "success", message: "provider composer cleared", pageUrl: location.href};
`;

export const FIND_UPLOAD_MENU_POINT_SCRIPT = `
${WEB_CHAT_SELECTOR_SCRIPT_PRELUDE}
const browserChromeTopInset = Math.max(0, window.outerHeight - window.innerHeight);
const pointFor = (target) => {
  const rect = target.getBoundingClientRect();
  return {
    x: Math.round(window.screenX + rect.x + rect.width / 2),
    y: Math.round(window.screenY + browserChromeTopInset + rect.y + rect.height / 2),
  };
};
const visible = (node) => {
  if (!(node instanceof HTMLElement)) return false;
  const rect = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
};
const menuItem = Array.from(document.querySelectorAll("[role='menuitem'], button, [role='button'], label"))
  .find((node) => visible(node) && /add photos? and files?|add files?|upload files?|添加照片和文件|上传文件|添加文件/i.test(clip(node.getAttribute("aria-label") || node.textContent || "")));
if (menuItem instanceof HTMLElement) {
  const point = pointFor(menuItem);
  return {status: "success", message: "provider upload menu item located", pageUrl: location.href, target: "upload-menu-item", ...point};
}
const plus = document.querySelector("#composer-plus-btn")
  || Array.from(document.querySelectorAll("button, [role='button']")).find((node) => visible(node) && /添加文件|add files?|attach|upload/i.test(clip(node.getAttribute("aria-label") || node.textContent || "")));
if (plus instanceof HTMLElement) {
  const point = pointFor(plus);
  return {status: "success", message: "provider composer plus button located", pageUrl: location.href, target: "composer-plus", ...point};
}
return {status: "review_required", message: "provider upload menu trigger not found", pageUrl: location.href};
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
const submit = document.querySelector("#composer-submit-button")
  || Array.from(document.querySelectorAll("button")).find((button) => {
    const label = clip(button.getAttribute("aria-label") || button.textContent || "");
    return /send|submit|发送|提交/i.test(label);
  });
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
const submit = document.querySelector("#composer-submit-button")
  || Array.from(document.querySelectorAll("button")).find((button) => {
    const label = clip(button.getAttribute("aria-label") || button.textContent || "");
    return /send|submit|发送|提交/i.test(label);
  });
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

