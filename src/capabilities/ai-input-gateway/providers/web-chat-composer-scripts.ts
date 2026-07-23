import { WEB_CHAT_SELECTOR_SCRIPT_PRELUDE } from "./web-chat-selector-prelude.js";

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
  if (input instanceof HTMLElement) {
    const composerForm = input.closest("form");
    if (composerForm instanceof HTMLElement) {
      return {...countAttachmentCandidates(composerForm), scope: "input", input};
    }
    let cursor = input;
    for (let depth = 0; depth < 6 && cursor; depth += 1) {
      const isComposerBoundary = /composer/i.test(String(cursor.className || ""))
        || Boolean(cursor.querySelector("#composer-submit-button, [data-testid='send-button'], button[aria-label*='Send'], button[aria-label*='发送']"));
      if (isComposerBoundary) return {...countAttachmentCandidates(cursor), scope: "input", input};
      cursor = cursor.parentElement;
    }
    return {count: 0, names: [], scope: "input", input};
  }
  return {count: 0, names: [], scope: "none", input};
};
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

export const CLICK_CHATGPT_ADD_BUTTON_SCRIPT = `
${WEB_CHAT_SELECTOR_SCRIPT_PRELUDE}
const visible = (node) => {
  if (!(node instanceof HTMLElement)) return false;
  const rect = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
};
const include = /^(?:Add files and more|Add files|Upload files|添加文件和更多|添加文件|上传文件)$/iu;
const exclude = /(?:send|voice|microphone|camera|发送|语音|麦克风|相机)/iu;
const candidates = Array.from(document.querySelectorAll(
  "button[data-testid='composer-plus-btn'], button[aria-label], [role='button'][aria-label]"
)).filter((node) => {
  if (!(node instanceof HTMLElement) || !visible(node)) return false;
  if (node.getAttribute("data-testid") === "composer-plus-btn") return true;
  const label = clip(node.getAttribute("aria-label") || "");
  return include.test(label) && !exclude.test(label);
});
const unique = Array.from(new Set(candidates));
if (unique.length !== 1) {
  return {status: "review_required", message: "CHATGPT_ADD_BUTTON_AMBIGUOUS", pageUrl: location.href, candidateCount: unique.length};
}
unique[0].click();
return {status: "success", message: "ChatGPT add button clicked", pageUrl: location.href};
`;

export const CLICK_CHATGPT_LOCAL_FILE_MENU_ITEM_SCRIPT = `
${WEB_CHAT_SELECTOR_SCRIPT_PRELUDE}
const visible = (node) => {
  if (!(node instanceof HTMLElement)) return false;
  const rect = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
};
const exclude = /(?:google drive|onedrive|sharepoint|camera|take photo|云端硬盘|相机|拍照)/iu;
const candidates = Array.from(document.querySelectorAll(
  ".__menu-item[tabindex], [role='menuitem'], [role='option'], [data-radix-menu-content] button, [data-radix-popper-content-wrapper] button"
)).filter((node) => {
  if (!(node instanceof HTMLElement) || !visible(node)) return false;
  const label = clip(node.getAttribute("aria-label") || node.textContent || "");
  const descendantTexts = Array.from(node.querySelectorAll("span, div"))
    .map((candidate) => clip(candidate.textContent || ""))
    .filter((value) => value.length > 0);
  const hasPrimary = descendantTexts.includes("Add photos & files")
    || descendantTexts.includes("添加照片和文件");
  const hasLocalSubtitle = descendantTexts.includes("Upload from computer")
    || descendantTexts.includes("从电脑上传");
  const exactCombinedLabel = /^(?:Add photos & filesUpload from computer|添加照片和文件从电脑上传)$/iu.test(label);
  return (exactCombinedLabel || (hasPrimary && hasLocalSubtitle)) && !exclude.test(label);
});
const unique = Array.from(new Set(candidates));
if (unique.length === 0) {
  return {status: "pending", message: "waiting for ChatGPT local file menu item", pageUrl: location.href, candidateCount: 0};
}
if (unique.length !== 1) {
  return {status: "review_required", message: "CHATGPT_LOCAL_FILE_MENU_ITEM_AMBIGUOUS", pageUrl: location.href, candidateCount: unique.length};
}
const rect = unique[0].getBoundingClientRect();
return {
  status: "success",
  message: "ChatGPT local file menu item uniquely located",
  pageUrl: location.href,
  targetPoint: {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2},
};
`;
