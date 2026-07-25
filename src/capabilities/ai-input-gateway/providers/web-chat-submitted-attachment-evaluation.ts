import { WEB_CHAT_ATTACHMENT_COUNT_SCRIPT } from "./web-chat-composer-scripts.js";
import { WEB_CHAT_SELECTOR_SCRIPT_PRELUDE } from "./web-chat-selector-prelude.js";

const WEB_CHAT_SUBMITTED_ATTACHMENT_COUNT_SCRIPT = `
const isChatGptPastedTextTile = (node) => {
  if (!(node instanceof HTMLElement)) return false;
  const text = clip(node.getAttribute("aria-label") || node.textContent || "");
  return /在文本字段中显示|show in text field|display in text field|pasted text|pasted content/i.test(text)
    || Boolean(node.querySelector("button[aria-label*='在文本字段中显示'], button[aria-label*='show in text field' i], button[aria-label*='display in text field' i]"));
};
const isRealSubmittedAttachment = (node) => {
  if (!(node instanceof HTMLElement) || isChatGptPastedTextTile(node)) return false;
  const label = clip(node.getAttribute("aria-label") || node.getAttribute("data-testid") || node.textContent || node.className || "");
  if (/add files?|添加文件|profile|avatar|account|menuitem|button|发送|send/i.test(label)) return false;
  if (/移除文件\\d*|remove file\\d*/i.test(label)) return true;
  if (node.matches("img, picture, canvas, [role='img'], gem-media-attachment, uploader-file-preview, user-query-file-carousel")) return true;
  return /\\b(file|attachment|image)\\b|附件|图片|\\.(png|jpg|jpeg|webp|gif|zip|json|ndjson|md|txt|pdf|csv|mp4|mov|webm)\\b/i.test(label);
};
const readBoundAttachments = (root) => {
  if (!root || typeof root.querySelectorAll !== "function") return {count: 0, names: []};
  const selectors = [
    "gem-media-attachment", "uploader-file-preview", "user-query-file-carousel",
    "[class*='file-tile' i]",
    "[role='group'][aria-label]",
    "button[aria-label*='在文本字段中显示']", "button[aria-label*='show in text field' i]", "button[aria-label*='display in text field' i]",
    "img", "picture", "canvas",
    "[role='img']",
    "[data-testid*='attachment' i]",
    "[data-testid*='file' i]",
    "[class*='attachment' i]",
    "[class*='file' i]",
    "[aria-label*='image' i]"
  ];
  const seen = new Set();
  const names = [];
  for (const selector of selectors) {
    for (const node of Array.from(root.querySelectorAll(selector))) {
      if (!(node instanceof HTMLElement) || seen.has(node) || !isVisible(node)) continue;
      const rect = node.getBoundingClientRect();
      const label = clip(node.getAttribute("aria-label") || node.getAttribute("data-testid") || node.textContent || node.className || "");
      if (rect.width < 12 && rect.height < 12 && label.length === 0) continue;
      const tileRoot = findAttachmentTileRoot(node) || node;
      if (seen.has(tileRoot) || !isRealSubmittedAttachment(tileRoot)) continue;
      seen.add(tileRoot);
      const name = attachmentFileName(tileRoot);
      if (name) names.push(name);
    }
  }
  return {count: seen.size, names};
};
`;

const CHATGPT_SUBMITTED_ATTACHMENT_COUNT_SCRIPT = `
const countChatGptBoundAttachments = (messageNode) => {
  if (!(messageNode instanceof HTMLElement)) return {count: 0, names: []};
  const roots = [messageNode];
  let cursor = messageNode.parentElement;
  for (let depth = 0; depth < 8 && cursor; depth += 1) {
    roots.push(cursor);
    const className = String(cursor.className || "").toLowerCase();
    if (cursor.getAttribute("data-message-author-role") === "user" || className.includes("message")) break;
    if (cursor.tagName.toLowerCase() === "main" || cursor.getAttribute("role") === "main") break;
    cursor = cursor.parentElement;
  }
  for (const sibling of [messageNode.previousElementSibling, messageNode.nextElementSibling]) {
    if (sibling instanceof HTMLElement) roots.push(sibling);
  }
  return roots
    .map((root) => readBoundAttachments(root))
    .sort((left, right) => right.count - left.count)[0] || {count: 0, names: []};
};
`;

const GEMINI_SUBMITTED_ATTACHMENT_COUNT_SCRIPT = `
const countGeminiBoundAttachments = (messageNode) => {
  if (!(messageNode instanceof HTMLElement)) return {count: 0, names: []};
  const roots = [messageNode];
  let cursor = messageNode.parentElement;
  for (let depth = 0; depth < 6 && cursor; depth += 1) {
    roots.push(cursor);
    const tagName = cursor.tagName.toLowerCase();
    const className = String(cursor.className || "").toLowerCase();
    if (tagName === "user-query" || className.includes("user-query")) break;
    if (tagName === "main" || cursor.getAttribute("role") === "main") break;
    cursor = cursor.parentElement;
  }
  for (const sibling of [messageNode.previousElementSibling, messageNode.nextElementSibling]) {
    if (sibling instanceof HTMLElement) roots.push(sibling);
  }
  return roots
    .map((root) => readBoundAttachments(root))
    .sort((left, right) => right.count - left.count)[0] || {count: 0, names: []};
};
`;

export const buildVerifyLastUserMessageAttachmentsScript = (
  expectedCount: number,
  expectedKind: "image" | "file",
  expectedFileNames: readonly string[],
  previousUserMessageCount: number,
): string => `
${WEB_CHAT_SELECTOR_SCRIPT_PRELUDE}
${WEB_CHAT_ATTACHMENT_COUNT_SCRIPT}
const expectedCount = ${JSON.stringify(expectedCount)};
const expectedKind = ${JSON.stringify(expectedKind)};
const expectedFileNames = ${JSON.stringify(expectedFileNames)};
const previousUserMessageCount = ${JSON.stringify(previousUserMessageCount)};
${WEB_CHAT_SUBMITTED_ATTACHMENT_COUNT_SCRIPT}
${CHATGPT_SUBMITTED_ATTACHMENT_COUNT_SCRIPT}
${GEMINI_SUBMITTED_ATTACHMENT_COUNT_SCRIPT}
const chatGptUserMessages = Array.from(document.querySelectorAll("[data-message-author-role='user']"))
  .filter((node) => node instanceof HTMLElement && isVisible(node));
const geminiUserMessageCandidates = Array.from(document.querySelectorAll("user-query, user-query-content, .user-query-container"))
  .filter((node) => node instanceof HTMLElement && isVisible(node))
  .filter((node) => clip(node.innerText || node.textContent || "").length > 0 || countGeminiBoundAttachments(node).count > 0);
const geminiUserMessages = geminiUserMessageCandidates
  .filter((node) => !geminiUserMessageCandidates.some((other) => other !== node && other.contains(node)));
const userMessages = chatGptUserMessages.length > 0 ? chatGptUserMessages : geminiUserMessages;
const lastUserMessage = userMessages[userMessages.length - 1] || null;
const boundAttachments = chatGptUserMessages.length > 0
  ? countChatGptBoundAttachments(lastUserMessage)
  : countGeminiBoundAttachments(lastUserMessage);
const boundAttachmentCount = boundAttachments.count;
const requireExactFileNames = expectedKind === "file" && expectedFileNames.length > 0;
const missingFileNames = requireExactFileNames
  ? expectedFileNames.filter((name) => !boundAttachments.names.includes(name))
  : [];
const unexpectedFileNames = requireExactFileNames
  ? boundAttachments.names.filter((name) => !expectedFileNames.includes(name))
  : [];
const lastUserMessageText = lastUserMessage instanceof HTMLElement ? clip(lastUserMessage.innerText || lastUserMessage.textContent || "") : null;
const proof = {pageUrl: location.href, boundAttachmentCount, attachmentNames: boundAttachments.names, missingFileNames, unexpectedFileNames, lastUserMessageText, userMessageCount: userMessages.length};
if (userMessages.length > previousUserMessageCount + 1) {
  return {status: "failed", message: "WEB_CHAT_USER_TURN_DELTA_MISMATCH", ...proof};
}
if (userMessages.length !== previousUserMessageCount + 1) {
  return {status: "pending", message: "waiting for one fresh submitted user message", ...proof};
}
if (unexpectedFileNames.length > 0) {
  return {status: "failed", message: "GPT_ATTACHMENT_FILENAME_MISMATCH: fresh submitted user message contains unexpected attachments", ...proof};
}
if (boundAttachmentCount === expectedCount && missingFileNames.length === 0) {
  return {status: "success", message: expectedKind === "image" ? "fresh submitted user message contains exact bound image attachment set" : "fresh submitted user message contains exact bound file attachment set", ...proof};
}
if (boundAttachmentCount > expectedCount) {
  return {status: "failed", message: "GPT_ATTACHMENT_COUNT_MISMATCH: fresh submitted user message contains too many attachments", ...proof};
}
return {status: "pending", message: expectedKind === "image" ? "provider_missing_bound_image: fresh submitted user message does not contain required image attachment" : "provider_missing_bound_file: fresh submitted user message does not contain required file attachment", ...proof};
`;
