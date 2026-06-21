import { WEB_CHAT_SELECTOR_SCRIPT_PRELUDE } from "./web-chat-selector-prelude.js";

const GLOBAL_ATTACHMENT_LOWER_BOUND_READY_MESSAGE = "provider attachments ready by global lower-bound count";

export const WEB_CHAT_ATTACHMENT_COUNT_SCRIPT = `
const CHATGPT_FILE_TILE_TEXT_PATTERN = /在文本字段中显示|show in text field|display in text field/i;
const CHATGPT_FILE_REMOVE_PATTERN = /移除文件\\d*|remove file\\d*/i;
const isChatGptFileTileRoot = (node) => {
  if (!(node instanceof HTMLElement)) return false;
  const label = clip(node.getAttribute("aria-label") || node.getAttribute("data-testid") || node.textContent || node.className || "");
  const className = String(node.className || "");
  if (/composer-plus|add files?|添加文件/i.test(label) || /composer-plus/i.test(className)) return false;
  return className.includes("file-tile")
    || (node.getAttribute("role") === "group" && node.querySelector("button[aria-label*='在文本字段中显示'], button[aria-label*='show in text field' i], button[aria-label*='display in text field' i]"))
    || CHATGPT_FILE_TILE_TEXT_PATTERN.test(label);
};
const findAttachmentTileRoot = (node) => {
  if (!(node instanceof HTMLElement)) return null;
  let cursor = node;
  for (let depth = 0; depth < 7 && cursor; depth += 1) {
    if (isChatGptFileTileRoot(cursor)) return cursor;
    cursor = cursor.parentElement;
  }
  return null;
};
const isAttachmentCandidate = (node) => {
  if (!(node instanceof HTMLElement)) return false;
  const label = clip(node.getAttribute("aria-label") || node.getAttribute("data-testid") || node.textContent || node.className || "");
  if (/composer-plus|add files?|添加文件|menuitem/i.test(label)) return false;
  if (/uploading|loading|pending|progress|preparing|上传中|处理中/i.test(label)) return false;
  if (CHATGPT_FILE_REMOVE_PATTERN.test(label) && findAttachmentTileRoot(node)) return true;
  if (CHATGPT_FILE_TILE_TEXT_PATTERN.test(label) || isChatGptFileTileRoot(node)) return true;
  return /\\b(file|attachment|image)\\b|附件|图片/i.test(label);
};
const countAttachmentCandidates = (root) => {
  if (!root || typeof root.querySelectorAll !== "function") return 0;
  const selectors = [
    "[class*='file-tile' i]",
    "[role='group'][aria-label]",
    "button[aria-label*='在文本字段中显示']",
    "button[aria-label*='show in text field' i]",
    "button[aria-label*='display in text field' i]",
    "button[aria-label*='移除文件']",
    "button[aria-label*='remove file' i]",
    "[data-testid*='attachment' i]",
    "[data-testid*='file' i]",
    "[aria-label*='file' i]",
    "[aria-label*='attachment' i]",
    "[class*='attachment' i]",
    "[class*='file' i]",
    "[role='img']",
    "img[src^='data:']"
  ];
  const seenNodes = new Set();
  const seenTiles = new Set();
  for (const selector of selectors) {
    for (const node of Array.from(root.querySelectorAll(selector))) {
      if (!(node instanceof HTMLElement) || seenNodes.has(node) || !isAttachmentCandidate(node)) continue;
      seenNodes.add(node);
      const rect = node.getBoundingClientRect();
      const label = clip(node.getAttribute("aria-label") || node.getAttribute("data-testid") || node.textContent || node.className || "");
      if (rect.width <= 0 && rect.height <= 0 && label.length === 0) continue;
      seenTiles.add(findAttachmentTileRoot(node) || node);
    }
  }
  return seenTiles.size;
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
if (result.count >= expectedCount && result.scope === "global") {
  return {status: "success", message: ${JSON.stringify(GLOBAL_ATTACHMENT_LOWER_BOUND_READY_MESSAGE)}, pageUrl: location.href, attachmentCount: result.count, attachmentScope: result.scope, inputFocused};
}
return {status: "pending", message: "waiting for provider attachment count", pageUrl: location.href, attachmentCount: result.count, attachmentScope: result.scope, inputFocused};
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
