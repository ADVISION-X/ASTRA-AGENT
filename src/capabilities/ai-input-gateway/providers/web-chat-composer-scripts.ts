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
  return /(?:^|\\s)(?:group\\/)?file-tile(?:\\s|$)/u.test(className)
    || (node.getAttribute("role") === "group" && node.querySelector("button[aria-label*='在文本字段中显示'], button[aria-label*='show in text field' i], button[aria-label*='display in text field' i], button[aria-label*='移除文件'], button[aria-label*='remove file' i]"))
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
const ATTACHMENT_FILE_NAME_PATTERN = /([^/\\\\\\n]+?\\.(?:jsonl?|md|txt|zip|pdf|csv|png|jpe?g|webp|gif|mp4|mov|webm))/iu;
const attachmentFileName = (tile) => {
  if (!(tile instanceof HTMLElement)) return null;
  const values = [
    tile.getAttribute("aria-label"),
    tile.getAttribute("data-testid"),
    ...Array.from(tile.querySelectorAll("button, [aria-label], [data-testid]"))
      .flatMap((node) => [node.textContent, node.getAttribute("aria-label"), node.getAttribute("data-testid")]),
    tile.textContent,
  ]
    .map((value) => clip(value || ""))
    .filter((value) => value.length > 0)
    .map((value) => value.replace(/^(?:移除文件\\d*|remove file\\d*)\\s*[:：]?\\s*/iu, ""));
  const candidates = values
    .map((value) => value.match(ATTACHMENT_FILE_NAME_PATTERN)?.[1] || null)
    .filter((value) => typeof value === "string" && value.length > 0);
  if (candidates.length === 0) return null;
  return candidates.sort((left, right) => left.length - right.length)[0];
};
const countAttachmentCandidates = (root) => {
  if (!root || typeof root.querySelectorAll !== "function") return {count: 0, names: []};
  const explicitTiles = new Set();
  for (const node of Array.from(root.querySelectorAll("[class*='file-tile' i], [role='group'][aria-label], button[aria-label*='移除文件'], button[aria-label*='remove file' i]"))) {
    if (!(node instanceof HTMLElement)) continue;
    const tile = findAttachmentTileRoot(node);
    if (tile) explicitTiles.add(tile);
  }
  if (explicitTiles.size > 0) {
    return {
      count: explicitTiles.size,
      names: Array.from(explicitTiles)
        .map((tile) => attachmentFileName(tile))
        .filter((name) => typeof name === "string" && name.length > 0),
    };
  }
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
  return {
    count: seenTiles.size,
    names: Array.from(seenTiles)
      .map((tile) => attachmentFileName(tile))
      .filter((name) => typeof name === "string" && name.length > 0),
  };
};
const findBestAttachmentScope = () => {
  const input = resolveComposerInput();
  let bestRoot = null;
  let bestResult = {count: 0, names: []};
  if (input instanceof HTMLElement) {
    let cursor = input;
    for (let depth = 0; depth < 10 && cursor; depth += 1) {
      const currentResult = countAttachmentCandidates(cursor);
      if (currentResult.count > bestResult.count) {
        bestRoot = cursor;
        bestResult = currentResult;
      }
      cursor = cursor.parentElement;
    }
  }
  if (bestResult.count > 0) return {...bestResult, scope: "input", input};
  const globalResult = countAttachmentCandidates(document.body);
  return {...globalResult, scope: globalResult.count > 0 ? "global" : "none", input};
};
`;

export const buildWaitForAttachmentCountScript = (expectedCount: number): string => `
${WEB_CHAT_SELECTOR_SCRIPT_PRELUDE}
${WEB_CHAT_ATTACHMENT_COUNT_SCRIPT}
const expectedCount = ${JSON.stringify(expectedCount)};
const result = findBestAttachmentScope();
const inputFocused = Boolean(result.input instanceof HTMLElement && (document.activeElement === result.input || result.input.contains(document.activeElement)));
if (result.count >= expectedCount && result.scope === "input") {
  return {status: "success", message: "provider attachments ready", pageUrl: location.href, attachmentCount: result.count, attachmentNames: result.names, attachmentScope: result.scope, inputFocused};
}
if (result.count >= expectedCount && result.scope === "global") {
  return {status: "success", message: ${JSON.stringify(GLOBAL_ATTACHMENT_LOWER_BOUND_READY_MESSAGE)}, pageUrl: location.href, attachmentCount: result.count, attachmentNames: result.names, attachmentScope: result.scope, inputFocused};
}
return {status: "pending", message: "waiting for provider attachment count", pageUrl: location.href, attachmentCount: result.count, attachmentNames: result.names, attachmentScope: result.scope, inputFocused};
`;

export const buildWaitForExactAttachmentCountScript = (
  expectedCount: number,
  expectedFileNames: readonly string[] = [],
): string => `
${WEB_CHAT_SELECTOR_SCRIPT_PRELUDE}
${WEB_CHAT_ATTACHMENT_COUNT_SCRIPT}
const expectedCount = ${JSON.stringify(expectedCount)};
const expectedFileNames = ${JSON.stringify(expectedFileNames)};
const result = findBestAttachmentScope();
const inputFocused = Boolean(result.input instanceof HTMLElement && (document.activeElement === result.input || result.input.contains(document.activeElement)));
const missingFileNames = expectedFileNames.filter((name) => !result.names.includes(name));
const unexpectedFileNames = result.names.filter((name) => !expectedFileNames.includes(name));
if (result.count > expectedCount) {
  return {status: "failed", message: "GPT_ATTACHMENT_COUNT_MISMATCH", pageUrl: location.href, attachmentCount: result.count, attachmentNames: result.names, missingFileNames, unexpectedFileNames, attachmentScope: result.scope, inputFocused};
}
if (result.count === expectedCount && result.scope === "input" && expectedFileNames.length > 0 && (missingFileNames.length > 0 || unexpectedFileNames.length > 0)) {
  return {status: "failed", message: "GPT_ATTACHMENT_FILENAME_MISMATCH", pageUrl: location.href, attachmentCount: result.count, attachmentNames: result.names, missingFileNames, unexpectedFileNames, attachmentScope: result.scope, inputFocused};
}
if (result.count === expectedCount && result.scope === "input") {
  return {status: "success", message: "provider exact attachment count and file names ready", pageUrl: location.href, attachmentCount: result.count, attachmentNames: result.names, missingFileNames, unexpectedFileNames, attachmentScope: result.scope, inputFocused};
}
return {status: "pending", message: "waiting for provider exact attachment count", pageUrl: location.href, attachmentCount: result.count, attachmentNames: result.names, missingFileNames, unexpectedFileNames, attachmentScope: result.scope, inputFocused};
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
