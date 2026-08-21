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
  const composerCandidates = Array.from(document.querySelectorAll(
    "div#prompt-textarea[contenteditable='true'][role='textbox'], div[contenteditable='true'][role='textbox'][aria-label='Enter a prompt for Gemini'], rich-textarea div[contenteditable='true'][role='textbox'], div.ql-editor[contenteditable='true'][role='textbox']"
  )).filter((node) => node instanceof HTMLElement && node.isContentEditable && isVisible(node));
  const input = composerCandidates.length === 1 ? composerCandidates[0] : null;
  if (!(input instanceof HTMLElement)) {
    return {
      count: 0,
      names: [],
      scope: "none",
      input: null,
      composerCandidateCount: composerCandidates.length,
      composerRootCount: 0,
      conversationTurnCountInScope: 0,
      generalFileInputCount: 0,
      imageFileInputCountInScope: 0,
      pendingAttachmentCount: 0,
      sendButtonCount: 0,
      sendReady: false,
      composerTextLength: 0,
    };
  }
  const composerForm = input.closest("form");
  let composerRoot = composerForm instanceof HTMLElement ? composerForm : null;
  if (!composerRoot) {
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
    return {
      count: 0,
      names: [],
      scope: "none",
      input,
      composerCandidateCount: composerCandidates.length,
      composerRootCount: 0,
      conversationTurnCountInScope: 0,
      generalFileInputCount: 0,
      imageFileInputCountInScope: 0,
      pendingAttachmentCount: 0,
      sendButtonCount: 0,
      sendReady: false,
      composerTextLength: readComposerVisibleText(input).length,
    };
  }
  const attachmentState = countAttachmentCandidates(composerRoot);
  const fileInputs = Array.from(composerRoot.querySelectorAll("input[type='file'][multiple]"))
    .filter((node) => node instanceof HTMLInputElement);
  const generalFileInputCount = fileInputs
    .filter((node) => clip(node.getAttribute("accept") || "").toLowerCase() !== "image/*")
    .length;
  const imageFileInputCountInScope = fileInputs
    .filter((node) => clip(node.getAttribute("accept") || "").toLowerCase() === "image/*")
    .length;
  const conversationTurnCountInScope = composerRoot.querySelectorAll(
    "[data-testid^='conversation-turn-'], [data-message-author-role]"
  ).length;
  const pendingAttachmentCount = Array.from(composerRoot.querySelectorAll(
    "[aria-busy='true'], [role='progressbar'], progress, [data-testid*='upload' i], [class*='uploading' i], [class*='progress' i]"
  )).filter((node) => {
    if (!(node instanceof HTMLElement) || !isVisible(node)) return false;
    const label = clip(node.getAttribute("aria-label") || node.getAttribute("data-testid") || node.textContent || node.className || "");
    return /uploading|loading|pending|progress|preparing|上传中|处理中/i.test(label)
      || node.getAttribute("aria-busy") === "true"
      || node.getAttribute("role") === "progressbar"
      || node.tagName.toLowerCase() === "progress";
  }).length;
  const sendButtons = Array.from(composerRoot.querySelectorAll(
    "#composer-submit-button, [data-testid='send-button'], button[aria-label*='Send'], button[aria-label*='发送']"
  )).filter((node) => node instanceof HTMLElement && isVisible(node));
  const sendButton = sendButtons.length === 1 ? sendButtons[0] : null;
  const sendReady = sendButton instanceof HTMLButtonElement
    ? !sendButton.disabled && sendButton.getAttribute("aria-disabled") !== "true"
    : sendButton instanceof HTMLElement && sendButton.getAttribute("aria-disabled") !== "true";
  return {
    ...attachmentState,
    scope: "composer",
    input,
    composerRoot,
    composerCandidateCount: composerCandidates.length,
    composerRootCount: 1,
    conversationTurnCountInScope,
    generalFileInputCount,
    imageFileInputCountInScope,
    pendingAttachmentCount,
    sendButtonCount: sendButtons.length,
    sendReady,
    composerTextLength: readComposerVisibleText(input).length,
  };
};
`;

export const buildWaitForExactAttachmentCountScript = (
  expectedCount: number,
  expectedFileNames: readonly string[] = [],
  options: {
    expectedPageUrl?: string | null;
    baselineAttachmentCount?: number;
    requireReady?: boolean;
    requireComposerTextEmpty?: boolean;
  } = {},
): string => `
${WEB_CHAT_SELECTOR_SCRIPT_PRELUDE}
${WEB_CHAT_ATTACHMENT_COUNT_SCRIPT}
const expectedCount = ${JSON.stringify(expectedCount)};
const expectedFileNames = ${JSON.stringify(expectedFileNames)};
const expectedPageUrl = ${JSON.stringify(options.expectedPageUrl ?? null)};
const baselineAttachmentCount = ${JSON.stringify(options.baselineAttachmentCount ?? 0)};
const requireReady = ${JSON.stringify(options.requireReady ?? expectedCount > 0)};
const requireComposerTextEmpty = ${JSON.stringify(options.requireComposerTextEmpty ?? false)};
const result = findBestAttachmentScope();
const inputFocused = Boolean(result.input instanceof HTMLElement && (document.activeElement === result.input || result.input.contains(document.activeElement)));
const missingFileNames = expectedFileNames.filter((name) => !result.names.includes(name));
const unexpectedFileNames = result.names.filter((name) => !expectedFileNames.includes(name));
const attachmentDelta = result.count - baselineAttachmentCount;
const isChatGpt = location.hostname === "chatgpt.com" || location.hostname.endsWith(".chatgpt.com");
const providerIdentityUnchanged = expectedPageUrl === null || location.href === expectedPageUrl;
const composerStructureExact = result.scope === "composer"
  && result.composerCandidateCount === 1
  && result.composerRootCount === 1
  && result.conversationTurnCountInScope === 0
  && (!isChatGpt || (result.generalFileInputCount === 1 && result.imageFileInputCountInScope === 0));
const readyStateExact = !requireReady
  || (result.pendingAttachmentCount === 0 && (!isChatGpt || (result.sendButtonCount === 1 && result.sendReady)));
const composerTextExact = !requireComposerTextEmpty || result.composerTextLength === 0;
const proof = {
  pageUrl: location.href,
  attachmentCount: result.count,
  attachmentNames: result.names,
  missingFileNames,
  unexpectedFileNames,
  attachmentScope: result.scope,
  inputFocused,
  composerCandidateCount: result.composerCandidateCount,
  composerRootCount: result.composerRootCount,
  conversationTurnCountInScope: result.conversationTurnCountInScope,
  generalFileInputCount: result.generalFileInputCount,
  imageFileInputCountInScope: result.imageFileInputCountInScope,
  pendingAttachmentCount: result.pendingAttachmentCount,
  sendReady: result.sendReady,
  attachmentDelta,
  composerTextLength: result.composerTextLength,
};
if (!providerIdentityUnchanged) {
  return {status: "review_required", message: "WEB_CHAT_PROVIDER_IDENTITY_DRIFT", ...proof};
}
if (!composerStructureExact) {
  return {status: "review_required", message: "WEB_CHAT_COMPOSER_SCOPE_AMBIGUOUS", ...proof};
}
if (result.count > expectedCount) {
  return {status: "failed", message: "GPT_ATTACHMENT_COUNT_MISMATCH", ...proof};
}
if (unexpectedFileNames.length > 0) {
  return {status: "failed", message: "GPT_ATTACHMENT_FILENAME_MISMATCH", ...proof};
}
if (
  result.count === expectedCount
  && attachmentDelta === expectedCount - baselineAttachmentCount
  && missingFileNames.length === 0
  && readyStateExact
  && composerTextExact
) {
  return {status: "success", message: "provider exact fresh composer attachment state ready", ...proof};
}
return {status: "pending", message: "waiting for provider exact fresh composer attachment state", ...proof};
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

