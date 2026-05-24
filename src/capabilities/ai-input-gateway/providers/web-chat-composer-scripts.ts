import { WEB_CHAT_SELECTOR_SCRIPT_PRELUDE } from "./web-chat-selector-prelude.js";

const WEB_CHAT_ATTACHMENT_COUNT_SCRIPT = `
const countAttachmentCandidates = (root) => {
  if (!root || typeof root.querySelectorAll !== "function") return 0;
  const selectors = [
    "[data-testid*='attachment' i]",
    "[data-testid*='file' i]",
    "[aria-label*='file' i]",
    "[aria-label*='attachment' i]",
    "[class*='attachment' i]",
    "[class*='file' i]",
    "[role='img']",
    "img[src^='data:']"
  ];
  const seen = new Set();
  let count = 0;
  for (const selector of selectors) {
    for (const node of Array.from(root.querySelectorAll(selector))) {
      if (!(node instanceof HTMLElement) || seen.has(node)) continue;
      seen.add(node);
      const label = clip(node.getAttribute("aria-label") || node.getAttribute("data-testid") || node.textContent || node.className || "");
      if (/add files?|添加文件|button|menuitem/i.test(label)) continue;
      if (/uploading|loading|pending|progress|preparing|上传中|处理中/i.test(label)) continue;
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 && rect.height <= 0 && label.length === 0) continue;
      count += 1;
    }
  }
  return count;
};
const findBestAttachmentScope = () => {
  const input = resolveComposerInput();
  let bestRoot = null;
  let bestCount = 0;
  if (input instanceof HTMLElement) {
    let cursor = input;
    for (let depth = 0; depth < 10 && cursor; depth += 1) {
      const currentCount = countAttachmentCandidates(cursor);
      if (currentCount > bestCount) {
        bestRoot = cursor;
        bestCount = currentCount;
      }
      cursor = cursor.parentElement;
    }
  }
  if (bestCount > 0) return {count: bestCount, scope: "input", input};
  const globalCount = countAttachmentCandidates(document.body);
  return {count: globalCount, scope: globalCount > 0 ? "global" : "none", input};
};
`;

export const buildWaitForAttachmentCountScript = (expectedCount: number): string => `
${WEB_CHAT_SELECTOR_SCRIPT_PRELUDE}
${WEB_CHAT_ATTACHMENT_COUNT_SCRIPT}
const expectedCount = ${JSON.stringify(expectedCount)};
const result = findBestAttachmentScope();
const inputFocused = Boolean(result.input instanceof HTMLElement && (document.activeElement === result.input || result.input.contains(document.activeElement)));
if (result.count >= expectedCount && result.scope === "input") {
  return {status: "success", message: "provider attachments ready", pageUrl: location.href, attachmentCount: result.count, attachmentScope: result.scope, inputFocused};
}
if (result.count === expectedCount && result.scope === "global") {
  return {status: "success", message: "provider attachments ready by global exact count", pageUrl: location.href, attachmentCount: result.count, attachmentScope: result.scope, inputFocused};
}
return {status: "pending", message: "waiting for provider attachment count", pageUrl: location.href, attachmentCount: result.count, attachmentScope: result.scope, inputFocused};
`;

export const CHATGPT_PASTED_TEXT_CARD_READY_SCRIPT = `
${WEB_CHAT_SELECTOR_SCRIPT_PRELUDE}
const input = resolveComposerInput();
const findComposerRoot = () => {
  if (!(input instanceof HTMLElement)) return null;
  let cursor = input;
  for (let depth = 0; depth < 8 && cursor; depth += 1) {
    if (cursor.querySelector("#composer-submit-button, [data-testid='send-button'], button[aria-label*='Send'], button[aria-label*='发送']")) {
      return cursor;
    }
    cursor = cursor.parentElement;
  }
  return input.parentElement;
};
const root = findComposerRoot();
const visibleText = clip(root?.innerText || "");
const hasPastedTextCard = Boolean(root)
  && (visibleText.includes("已粘贴的文本")
    || visibleText.toLowerCase().includes("pasted text")
    || visibleText.toLowerCase().includes("pasted content"));
const sendButton = root?.querySelector("#composer-submit-button, [data-testid='send-button'], button[aria-label*='Send'], button[aria-label*='发送']");
const sendReady = sendButton instanceof HTMLButtonElement
  ? !sendButton.disabled && sendButton.getAttribute("aria-disabled") !== "true"
  : sendButton instanceof HTMLElement;
return {
  status: hasPastedTextCard && sendReady ? "success" : "pending",
  message: hasPastedTextCard
    ? sendReady
      ? "chatgpt pasted text card ready for submit"
      : "chatgpt pasted text card waiting for send readiness"
    : "chatgpt pasted text card not present",
  pageUrl: location.href,
  attachmentCount: hasPastedTextCard ? 1 : 0,
  attachmentScope: hasPastedTextCard ? "input" : "none",
  inputFocused: Boolean(input instanceof HTMLElement && (document.activeElement === input || input.contains(document.activeElement))),
};
`;

export const CLICK_CHATGPT_SEND_BUTTON_SCRIPT = `
${WEB_CHAT_SELECTOR_SCRIPT_PRELUDE}
const input = resolveComposerInput();
let root = input instanceof HTMLElement ? input : document.body;
for (let depth = 0; depth < 8 && root; depth += 1) {
  if (root.querySelector("#composer-submit-button, [data-testid='send-button'], button[aria-label*='Send'], button[aria-label*='发送']")) {
    break;
  }
  root = root.parentElement;
}
const sendButton = root?.querySelector("#composer-submit-button, [data-testid='send-button'], button[aria-label*='Send'], button[aria-label*='发送']");
if (!(sendButton instanceof HTMLElement)) {
  return {status: "review_required", message: "provider send button not found", pageUrl: location.href};
}
const disabled = sendButton instanceof HTMLButtonElement
  ? sendButton.disabled || sendButton.getAttribute("aria-disabled") === "true"
  : sendButton.getAttribute("aria-disabled") === "true";
if (disabled) {
  return {status: "pending", message: "provider send button is disabled", pageUrl: location.href};
}
sendButton.click();
return {status: "success", message: "provider send button clicked", pageUrl: location.href};
`;

export const VERIFY_COMPOSER_FOCUSED_SCRIPT = `
${WEB_CHAT_SELECTOR_SCRIPT_PRELUDE}
const input = resolveComposerInput();
const inputFocused = Boolean(input instanceof HTMLElement && (document.activeElement === input || input.contains(document.activeElement)));
return {
  status: inputFocused ? "success" : "pending",
  message: inputFocused ? "provider input box is focused" : "provider input box is not focused",
  pageUrl: location.href,
  inputFocused,
};
`;

export const FOCUS_COMPOSER_SCRIPT = `
${WEB_CHAT_SELECTOR_SCRIPT_PRELUDE}
const input = resolveComposerInput();
if (!(input instanceof HTMLElement)) {
  return {status: "review_required", message: "provider input box not found", pageUrl: location.href};
}
input.focus();
input.click();
const inputFocused = document.activeElement === input || input.contains(document.activeElement);
return {
  status: inputFocused ? "success" : "pending",
  message: inputFocused ? "provider input box focused" : "provider input box focus did not stick",
  pageUrl: location.href,
  inputFocused,
};
`;
