import { WEB_CHAT_SELECTOR_SCRIPT_PRELUDE } from "./web-chat-selector-prelude.js";
import { WEB_CHAT_ATTACHMENT_COUNT_SCRIPT } from "./web-chat-composer-scripts.js";

type WebChatActionStatus = "success" | "review_required" | "failed" | "pending";

export type WebChatEvaluation = {
  status: WebChatActionStatus;
  message: string;
  answerText?: string | null;
  pageUrl?: string | null;
  selector?: string | null;
  generating?: boolean;
  target?: "composer-plus" | "upload-menu-item";
  x?: number;
  y?: number;
  assistantCount?: number;
  composerText?: string | null;
  expectedLength?: number;
  attachmentCount?: number;
  attachmentNames?: string[];
  missingFileNames?: string[];
  unexpectedFileNames?: string[];
  attachmentScope?: "input" | "global" | "none";
  boundAttachmentCount?: number;
  lastUserMessageText?: string | null;
  inputFocused?: boolean;
  promptPrefixVisible?: boolean;
  promptSuffixVisible?: boolean;
  pastedTextCardReady?: boolean;
  hasPastedTextCard?: boolean;
  sendReady?: boolean;
};

const WEB_CHAT_STATUS_TEXT_SCRIPT = `
const visibleStatusText = Array.from(document.querySelectorAll("[role='status'], [aria-live], [data-testid*='status'], [class*='status'], [class*='thinking'], [class*='reasoning'], [class*='loading']"))
  .filter((node) => isVisible(node) && !node.closest("form, footer, header, nav, aside"))
  .map((node) => clip(node.textContent || ""))
  .filter((text) => text.length > 0)
  .join(" ");
const processing = /\\b(thinking|reasoning|analyzing|analysis|searching|processing|reading|browsing|uploading|working)\\b|思考|推理|分析|搜索|处理中|生成中|读取中|工作中/i.test(visibleStatusText);
`;

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
const countBoundAttachments = (root) => {
  if (!root || typeof root.querySelectorAll !== "function") return 0;
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
  let count = 0;
  for (const selector of selectors) {
    for (const node of Array.from(root.querySelectorAll(selector))) {
      if (!(node instanceof HTMLElement) || seen.has(node) || !isVisible(node)) continue;
      const rect = node.getBoundingClientRect();
      const label = clip(node.getAttribute("aria-label") || node.getAttribute("data-testid") || node.textContent || node.className || "");
      if (rect.width < 12 && rect.height < 12 && label.length === 0) continue;
      const tileRoot = findAttachmentTileRoot(node) || node;
      if (seen.has(tileRoot) || !isRealSubmittedAttachment(tileRoot)) continue;
      seen.add(tileRoot);
      count += 1;
    }
  }
  return count;
};
`;

const CHATGPT_SUBMITTED_ATTACHMENT_COUNT_SCRIPT = `
const countChatGptBoundAttachments = (messageNode) => {
  if (!(messageNode instanceof HTMLElement)) return 0;
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
  return Math.max(...roots.map((root) => countBoundAttachments(root)));
};
`;

const GEMINI_SUBMITTED_ATTACHMENT_COUNT_SCRIPT = `
const countGeminiBoundAttachments = (messageNode) => {
  if (!(messageNode instanceof HTMLElement)) return 0;
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
  return Math.max(...roots.map((root) => countBoundAttachments(root)));
};
`;

export const buildVerifyLastUserMessageAttachmentsScript = (expectedCount: number, expectedKind: "image" | "file"): string => `
${WEB_CHAT_SELECTOR_SCRIPT_PRELUDE}
${WEB_CHAT_ATTACHMENT_COUNT_SCRIPT}
const expectedCount = ${JSON.stringify(expectedCount)};
const expectedKind = ${JSON.stringify(expectedKind)};
${WEB_CHAT_SUBMITTED_ATTACHMENT_COUNT_SCRIPT}
${CHATGPT_SUBMITTED_ATTACHMENT_COUNT_SCRIPT}
${GEMINI_SUBMITTED_ATTACHMENT_COUNT_SCRIPT}
const chatGptUserMessages = Array.from(document.querySelectorAll("[data-message-author-role='user']"))
  .filter((node) => node instanceof HTMLElement && isVisible(node));
const geminiUserMessages = Array.from(document.querySelectorAll("user-query, user-query-content, .user-query-container"))
  .filter((node) => node instanceof HTMLElement && isVisible(node))
  .filter((node) => clip(node.innerText || node.textContent || "").length > 0 || countGeminiBoundAttachments(node) > 0);
const userMessages = chatGptUserMessages.length > 0 ? chatGptUserMessages : geminiUserMessages;
const lastUserMessage = userMessages[userMessages.length - 1] || null;
const boundAttachmentCount = chatGptUserMessages.length > 0
  ? countChatGptBoundAttachments(lastUserMessage)
  : countGeminiBoundAttachments(lastUserMessage);
const lastUserMessageText = lastUserMessage instanceof HTMLElement ? clip(lastUserMessage.innerText || lastUserMessage.textContent || "") : null;
if (boundAttachmentCount === expectedCount) {
  return {status: "success", message: expectedKind === "image" ? "provider last submitted user message contains bound image attachment" : "provider last submitted user message contains bound file attachment", pageUrl: location.href, boundAttachmentCount, lastUserMessageText};
}
if (boundAttachmentCount > expectedCount) {
  return {status: "failed", message: "GPT_ATTACHMENT_COUNT_MISMATCH: last submitted user message contains too many attachments", pageUrl: location.href, boundAttachmentCount, lastUserMessageText};
}
return {status: "pending", message: expectedKind === "image" ? "provider_missing_bound_image: last submitted user message does not contain required image attachment" : "provider_missing_bound_file: last submitted user message does not contain required file attachment", pageUrl: location.href, boundAttachmentCount, lastUserMessageText};
`;

const WEB_CHAT_GENERATION_STATE_SCRIPT = `
const visibleButtonText = Array.from(document.querySelectorAll("button"))
  .filter((button) => isVisible(button))
  .map((button) => clip(button.getAttribute("aria-label") || button.textContent || ""))
  .join(" ");
${WEB_CHAT_STATUS_TEXT_SCRIPT}
const generating = /\\b(stop generating|stop responding|stop)\\b|停止生成|停止回答/i.test(visibleButtonText)
  || Boolean(document.querySelector('[aria-busy="true"]'))
  || processing;
`;

const WEB_CHAT_ASSISTANT_COUNT_SCRIPT = `
const assistantCount = Array.from(document.querySelectorAll("[data-message-author-role='assistant']"))
  .map((node) => clip(node.textContent || ""))
  .filter((text) => text.length > 0)
  .length;
`;

const CHATGPT_PASTED_TEXT_CARD_STATE_SCRIPT = `
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
const composerRoot = findComposerRoot();
const composerRootText = clip(composerRoot?.innerText || "");
const hasPastedTextCard = Boolean(composerRoot)
  && (composerRootText.includes("已粘贴的文本")
    || composerRootText.includes("在文本字段中显示")
    || composerRootText.toLowerCase().includes("pasted text")
    || composerRootText.toLowerCase().includes("pasted content")
    || Boolean(composerRoot.querySelector("button[aria-label*='在文本字段中显示'], button[aria-label*='show in text field' i], button[aria-label*='display in text field' i]")));
const sendButton = composerRoot?.querySelector("#composer-submit-button, [data-testid='send-button'], button[aria-label*='Send'], button[aria-label*='发送']");
const sendReady = sendButton instanceof HTMLButtonElement
  ? !sendButton.disabled && sendButton.getAttribute("aria-disabled") !== "true"
  : sendButton instanceof HTMLElement;
const pastedTextCardReady = hasPastedTextCard && sendReady;
`;

export const buildVerifyPromptPastedScript = (input: {
  expectedLength: number;
  expectedPrefix: string;
  expectedSuffix: string;
}): string => `
${WEB_CHAT_SELECTOR_SCRIPT_PRELUDE}
const input = resolveComposerInput();
const actual = input instanceof HTMLElement ? readComposerVisibleText(input) : "";
const expectedLength = ${JSON.stringify(input.expectedLength)};
const expectedPrefix = ${JSON.stringify(input.expectedPrefix)};
const expectedSuffix = ${JSON.stringify(input.expectedSuffix)};
const promptPrefixVisible = expectedPrefix.length > 0 && actual.includes(expectedPrefix);
const promptSuffixVisible = expectedSuffix.length > 0 && actual.includes(expectedSuffix);
const promptLengthClose = expectedLength > 0 && Math.abs(actual.length - expectedLength) <= Math.max(8, Math.ceil(expectedLength * 0.02));
const inputFocused = Boolean(input instanceof HTMLElement && (document.activeElement === input || input.contains(document.activeElement)));
${CHATGPT_PASTED_TEXT_CARD_STATE_SCRIPT}
if (promptPrefixVisible || (promptSuffixVisible && promptLengthClose) || pastedTextCardReady) {
  return {
    status: "success",
    message: promptPrefixVisible
      ? "provider prompt prefix detected in composer"
      : promptSuffixVisible
        ? "provider prompt suffix and length detected in composer"
        : "chatgpt pasted text card ready for submit",
    pageUrl: location.href,
    composerText: actual,
    expectedLength,
    inputFocused,
    promptPrefixVisible,
    promptSuffixVisible,
    pastedTextCardReady,
    hasPastedTextCard,
    sendReady,
  };
}
return {
  status: "pending",
  message: hasPastedTextCard
    ? "chatgpt pasted text card is not ready for submit yet"
    : "provider prompt was not detected in composer after paste",
  pageUrl: location.href,
  composerText: actual,
  expectedLength,
  inputFocused,
  promptPrefixVisible,
  promptSuffixVisible,
  pastedTextCardReady,
  hasPastedTextCard,
  sendReady,
};
`;

export const buildVerifyPromptSubmittedScript = (
  expectedPrefix: string,
  previousAssistantCount: number,
  wasPromptVerifiedBeforeSubmit: boolean,
): string => `
${WEB_CHAT_SELECTOR_SCRIPT_PRELUDE}
const input = resolveComposerInput();
const actual = input instanceof HTMLElement ? readComposerVisibleText(input) : "";
const expectedPrefix = ${JSON.stringify(expectedPrefix)};
${WEB_CHAT_ASSISTANT_COUNT_SCRIPT}
${WEB_CHAT_GENERATION_STATE_SCRIPT}
const promptStillInComposer = expectedPrefix.length > 0 && actual.includes(expectedPrefix);
${CHATGPT_PASTED_TEXT_CARD_STATE_SCRIPT}
const composerClearedAfterVerifiedPaste = ${JSON.stringify(wasPromptVerifiedBeforeSubmit)}
  && !promptStillInComposer
  && !pastedTextCardReady
  && !location.hostname.includes("gemini.google.com");
const generationStartedAfterSubmit = generating && !promptStillInComposer && !pastedTextCardReady;
if (assistantCount > ${JSON.stringify(previousAssistantCount)} || generationStartedAfterSubmit || composerClearedAfterVerifiedPaste) {
  return {
    status: "success",
    message: assistantCount > ${JSON.stringify(previousAssistantCount)}
      ? "provider assistant count increased after submit"
      : generationStartedAfterSubmit
        ? "provider started generating after submit"
        : "provider composer cleared after verified submit",
    pageUrl: location.href,
    generating,
    assistantCount,
    composerText: actual,
    promptPrefixVisible: promptStillInComposer,
    pastedTextCardReady,
    hasPastedTextCard,
    sendReady,
  };
}
return {
  status: "pending",
  message: promptStillInComposer || pastedTextCardReady
    ? "provider prompt is still waiting in composer after submit click"
    : "provider submit did not produce verified generation or assistant progress",
  pageUrl: location.href,
  generating,
  assistantCount,
  composerText: actual,
  promptPrefixVisible: promptStillInComposer,
  pastedTextCardReady,
  hasPastedTextCard,
  sendReady,
};
`;

export const EXTRACT_LAST_RESPONSE_SCRIPT = `
${WEB_CHAT_SELECTOR_SCRIPT_PRELUDE}
const extractNodeText = (node) => {
  if (!(node instanceof HTMLElement)) return clip(node?.textContent || "");
  return clip(node.innerText || node.textContent || "");
};
const isAssistantNode = (node) => {
  if (!(node instanceof Element)) return false;
  const className = String(node.className || "").toLowerCase();
  if (/model|assistant|response|gemini/.test(className)) return true;
  return Boolean(node.closest("[class*='model'], [class*='assistant'], [class*='response'], [class*='gemini']"));
};
const isUserNode = (node) => {
  if (!(node instanceof Element)) return false;
  if (node.matches("[data-message-author-role='user']")) return true;
  const className = String(node.className || "").toLowerCase();
  const testId = String(node.getAttribute("data-testid") || "").toLowerCase();
  return /\\buser\\b|prompt|composer/.test(className + " " + testId);
};
const isVisibleAssistantRawIndexNode = (node) => {
  if (!(node instanceof Element)) return false;
  if (!isVisible(node)) return false;
  if (isUserNode(node)) return false;
  if (node.closest("form, footer, header, nav, aside, textarea, input, [role='textbox'], [contenteditable='true'], [data-message-author-role='user']")) {
    return false;
  }
  const className = String(node.className || "").toLowerCase();
  const testId = String(node.getAttribute("data-testid") || "").toLowerCase();
  const role = String(node.getAttribute("role") || "").toLowerCase();
  const signature = node.tagName.toLowerCase() + " " + className + " " + testId + " " + role;
  return /assistant|response|message|markdown|prose|conversation|turn|article|listitem/.test(signature);
};
const dedupeCandidates = (candidates) => {
  const seen = new Set();
  return candidates.filter((candidate) => {
    if (!candidate.text || seen.has(candidate.text)) return false;
    seen.add(candidate.text);
    return true;
  });
};
const extractLastJsonObject = (text) => {
  const markerIndex = Math.max(
    text.lastIndexOf('"predictionLabel"'),
    text.lastIndexOf('"promptPackageId"'),
    text.lastIndexOf('"imageId"'),
  );
  if (markerIndex < 0) return "";
  const startIndex = text.lastIndexOf("{", markerIndex);
  if (startIndex < 0) return "";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return clip(text.slice(startIndex, index + 1));
    }
  }
  return "";
};
const extractFirstJsonObject = (text) => {
  const startIndex = text.indexOf("{");
  if (startIndex < 0) return "";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        const candidate = clip(text.slice(startIndex, index + 1));
        return candidate.includes('"imageId"') && candidate.includes('"predictionLabel"') ? candidate : "";
      }
    }
  }
  return "";
};
const chatGptNodes = Array.from(document.querySelectorAll("[data-message-author-role='assistant']"));
const geminiNodes = Array.from(document.querySelectorAll("[class*='turn'],[class*='message'],[class*='model-response'],[class*='modelResponse'],article,[role='listitem']"))
  .filter(isAssistantNode);
const responseNodes = chatGptNodes.length > 0 ? chatGptNodes : geminiNodes;
const structuredCandidates = responseNodes
  .map((node) => ({
    text: extractNodeText(node),
    top: node instanceof Element ? node.getBoundingClientRect().top : 0,
  }))
  .filter((candidate) => candidate.text.length >= 5)
  .sort((a, b) => a.top - b.top)
  .map((candidate) => ({ ...candidate, source: "structured" }));
const rawIndexCandidates = dedupeCandidates(
  Array.from(document.querySelectorAll("main article, main [role='listitem'], main [data-testid*='conversation'], main [class*='message'], main [class*='response'], main [class*='markdown'], article, [role='listitem']"))
    .filter(isVisibleAssistantRawIndexNode)
    .map((node) => ({
      text: extractNodeText(node),
      top: node instanceof Element ? node.getBoundingClientRect().top : 0,
      source: "visible_raw_capture",
    }))
    .filter((candidate) => candidate.text.length >= 20)
    .sort((a, b) => a.top - b.top),
);
const candidates = structuredCandidates.length > 0 ? structuredCandidates : rawIndexCandidates;
const lastCandidate = candidates[candidates.length - 1] || null;
const geminiBodyText = document.body?.innerText || document.body?.textContent || "";
const geminiAnswerStartIndex = geminiBodyText.lastIndexOf("Gemini said");
const geminiBodyAnswer = location.hostname.includes("gemini.google.com") && geminiAnswerStartIndex >= 0
  ? extractFirstJsonObject(geminiBodyText.slice(geminiAnswerStartIndex))
  : "";
const answerText = geminiBodyAnswer || lastCandidate?.text || "";
const geminiStructuredJsonAnswer = location.hostname.includes("gemini.google.com") ? extractLastJsonObject(answerText) : "";
const normalizedAnswerText = geminiStructuredJsonAnswer || answerText;
const geminiPick3JsonMissing = location.hostname.includes("gemini.google.com")
  && !geminiBodyAnswer
  && !geminiStructuredJsonAnswer
  && (normalizedAnswerText.length < 80 || !normalizedAnswerText.includes('"imageId"') || !normalizedAnswerText.includes('"predictionLabel"'));
const promptTemplateAnswer = normalizedAnswerText.includes('"lower | upper | abstain"')
  || normalizedAnswerText.includes('"number or null"')
  || normalizedAnswerText.includes('"full visible-series analysis, not a short label"');
const assistantCount = structuredCandidates.length > 0
  ? structuredCandidates.length
  : answerText
    ? 1
    : 0;
${WEB_CHAT_GENERATION_STATE_SCRIPT}
const responseGenerating = geminiBodyAnswer || geminiStructuredJsonAnswer ? false : generating;
const quotaExhaustedText = Array.from(document.querySelectorAll("[role='dialog'], [data-radix-portal], [role='alert'], [aria-live], [role='status']"))
  .filter((node) => isVisible(node) && !node.closest("[data-message-author-role='assistant'], [data-message-author-role='user'], main article, form, footer, header, nav, aside"))
  .map((node) => clip(node.textContent || ""))
  .filter((text) => text.length > 0)
  .join(" ");
const quotaExhaustedVisible = /usage limit|message cap|limit reached|come back later|try again in|额度|上限|用完|已达到.*限制|稍后再回来/i.test(quotaExhaustedText)
  && !/请求过于频繁|请稍等几分钟后再重试|too many requests|request too frequent/i.test(quotaExhaustedText);
if (quotaExhaustedVisible) {
  return {status: "review_required", message: "pick3_quota_exhausted_wait_required", answerText: null, pageUrl: location.href, generating: false, assistantCount};
}
if (!normalizedAnswerText && responseGenerating) {
  return {status: "pending", message: "provider still generating response", answerText: null, pageUrl: location.href, generating: true, assistantCount};
}
if (!normalizedAnswerText) {
  // A visible ChatGPT rate-limit dialog is never escalated to review_required and never aborts
  // polling: the parallel beforePoll click-ack (acknowledgePick3RateLimitIfVisible) is the ONLY
  // action taken — click it away, then keep waiting in the same conversation for the same
  // in-flight response. No reopen, no resend, no restart, no attempt cap.
  return {status: "pending", message: "provider answer not found yet", answerText: null, pageUrl: location.href, generating: responseGenerating, assistantCount};
}
if (geminiPick3JsonMissing) {
  return {status: "pending", message: "gemini pick3 structured json answer not found yet", answerText: null, pageUrl: location.href, generating: responseGenerating, assistantCount};
}
if (promptTemplateAnswer) {
  return {status: "pending", message: "provider answer is still the prompt contract template", answerText: null, pageUrl: location.href, generating: true, assistantCount};
}
return {
  status: "success",
  message: geminiBodyAnswer
    ? "answer extracted from gemini body json"
    : geminiStructuredJsonAnswer
    ? "answer extracted from gemini structured json"
    : lastCandidate?.source === "visible_raw_capture"
    ? "answer extracted from visible assistant raw capture"
    : "answer extracted",
  answerText: normalizedAnswerText,
  pageUrl: location.href,
  generating: responseGenerating,
  assistantCount,
};
`;
