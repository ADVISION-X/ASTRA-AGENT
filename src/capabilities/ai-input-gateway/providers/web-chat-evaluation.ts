import { WEB_CHAT_SELECTOR_SCRIPT_PRELUDE } from "./web-chat-selector-prelude.js";

const WEB_CHAT_STATUS_TEXT_SCRIPT = `
const visibleProgressNodes = Array.from(document.querySelectorAll("[role='status'], [aria-live], [data-testid*='status'], [class*='status'], [class*='thinking'], [class*='reasoning'], [class*='loading'], [class*='shimmer']"))
  .filter((node) => isVisible(node) && !node.closest("form, footer, header, nav, aside"));
const visibleStatusText = visibleProgressNodes
  .map((node) => clip(node.textContent || ""))
  .filter((text) => text.length > 0)
  .join(" ");
const visibleProgressClass = visibleProgressNodes.some((node) =>
  /thinking|reasoning|loading|shimmer/i.test(String(node.className || ""))
);
const processing = visibleProgressClass
  || /\\b(thinking|reasoning|analyzing|analysis|searching|processing|reading|browsing|uploading|working|checking|verifying|indexing)\\b|思考|推理|分析|搜索|处理中|生成中|读取中|工作中|核对|验证|检索/i.test(visibleStatusText);
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

export const buildVerifyPromptSubmittedScript = (expectedPrefix: string, previousUserMessageCount: number, wasPromptVerifiedBeforeSubmit: boolean): string => `
${WEB_CHAT_SELECTOR_SCRIPT_PRELUDE}
const input = resolveComposerInput();
const actual = input instanceof HTMLElement ? readComposerVisibleText(input) : "";
const expectedPrefix = ${JSON.stringify(expectedPrefix)};
${WEB_CHAT_ASSISTANT_COUNT_SCRIPT}
${WEB_CHAT_GENERATION_STATE_SCRIPT}
const chatGptUserMessages = Array.from(document.querySelectorAll("[data-message-author-role='user']"))
  .filter((node) => node instanceof HTMLElement && isVisible(node));
const geminiUserMessageCandidates = Array.from(document.querySelectorAll("user-query, user-query-content, .user-query-container"))
  .filter((node) => node instanceof HTMLElement && isVisible(node))
  .filter((node) => clip(node.innerText || node.textContent || "").length > 0);
const geminiUserMessages = geminiUserMessageCandidates
  .filter((node) => !geminiUserMessageCandidates.some((other) => other !== node && other.contains(node)));
const userMessages = chatGptUserMessages.length > 0 ? chatGptUserMessages : geminiUserMessages;
const userMessageCount = userMessages.length;
const previousUserMessageCount = ${JSON.stringify(previousUserMessageCount)};
const lastUserMessage = userMessages[userMessages.length - 1] || null;
const lastUserMessageText = lastUserMessage instanceof HTMLElement
  ? clip(lastUserMessage.innerText || lastUserMessage.textContent || "")
  : "";
const freshUserTurnCreated = userMessageCount === previousUserMessageCount + 1;
const promptBoundToFreshUserTurn = expectedPrefix.length > 0 && lastUserMessageText.includes(expectedPrefix);
const promptStillInComposer = expectedPrefix.length > 0 && actual.includes(expectedPrefix);
${CHATGPT_PASTED_TEXT_CARD_STATE_SCRIPT}
const composerClearedAfterVerifiedPaste = ${JSON.stringify(wasPromptVerifiedBeforeSubmit)}
  && !promptStillInComposer
  && !pastedTextCardReady;
if (userMessageCount > previousUserMessageCount + 1) {
  return {
    status: "failed",
    message: "WEB_CHAT_USER_TURN_DELTA_MISMATCH",
    pageUrl: location.href,
    generating,
    assistantCount,
    userMessageCount,
    lastUserMessageText,
    composerText: actual,
  };
}
if (freshUserTurnCreated && promptBoundToFreshUserTurn && composerClearedAfterVerifiedPaste) {
  return {
    status: "success",
    message: "provider created one fresh user turn containing the verified prompt",
    pageUrl: location.href,
    generating,
    assistantCount,
    userMessageCount,
    lastUserMessageText,
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
    : "provider submit did not produce one verified fresh user turn",
  pageUrl: location.href,
  generating,
  assistantCount,
  userMessageCount,
  lastUserMessageText,
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
const chatGptUserMessageCount = Array.from(document.querySelectorAll("[data-message-author-role='user']"))
  .filter((node) => node instanceof HTMLElement && isVisible(node))
  .length;
const geminiUserMessageCandidates = Array.from(document.querySelectorAll("user-query, user-query-content, .user-query-container"))
  .filter((node) => node instanceof HTMLElement && isVisible(node))
  .filter((node) => clip(node.innerText || node.textContent || "").length > 0);
const geminiUserMessageCount = geminiUserMessageCandidates
  .filter((node) => !geminiUserMessageCandidates.some((other) => other !== node && other.contains(node)))
  .length;
const userMessageCount = chatGptUserMessageCount > 0 ? chatGptUserMessageCount : geminiUserMessageCount;
const conversationTurnIds = Array.from(document.querySelectorAll("[data-testid^='conversation-turn-']"))
  .filter((node) => node instanceof HTMLElement && isVisible(node))
  .map((node) => node.getAttribute("data-testid"))
  .filter((value) => typeof value === "string" && value.length > 0);
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
  return {status: "review_required", message: "pick3_quota_exhausted_wait_required", answerText: null, pageUrl: location.href, generating: false, assistantCount, userMessageCount, conversationTurnIds};
}
if (!normalizedAnswerText && responseGenerating) {
  return {status: "pending", message: "provider still generating response", answerText: null, pageUrl: location.href, generating: true, assistantCount, userMessageCount, conversationTurnIds};
}
if (!normalizedAnswerText) {
  // A visible ChatGPT rate-limit dialog is never escalated to review_required and never aborts
  // polling: the parallel beforePoll click-ack (acknowledgePick3RateLimitIfVisible) is the ONLY
  // action taken — click it away, then keep waiting in the same conversation for the same
  // in-flight response. No reopen, no resend, no restart, no attempt cap.
  return {status: "pending", message: "provider answer not found yet", answerText: null, pageUrl: location.href, generating: responseGenerating, assistantCount, userMessageCount, conversationTurnIds};
}
if (geminiPick3JsonMissing) {
  return {status: "pending", message: "gemini pick3 structured json answer not found yet", answerText: null, pageUrl: location.href, generating: responseGenerating, assistantCount, userMessageCount, conversationTurnIds};
}
if (promptTemplateAnswer) {
  return {status: "pending", message: "provider answer is still the prompt contract template", answerText: null, pageUrl: location.href, generating: true, assistantCount, userMessageCount, conversationTurnIds};
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
  userMessageCount,
  conversationTurnIds,
};
`;

const MARKER_SCOPED_CHATGPT_RESPONSE_SCRIPT = `
const extractText = (node) => (node instanceof HTMLElement ? node.innerText : node?.textContent || "")
  .replace(/\\s+/gu, " ")
  .trim();
const turns = Array.from(document.querySelectorAll("[data-testid^='conversation-turn-']"));
const matchingUserTurns = turns.filter((turn) => {
  const user = turn.querySelector("[data-message-author-role='user']");
  return user instanceof Element && extractText(user).includes(marker);
});
const conversationTurnIds = turns
  .map((turn) => turn.getAttribute("data-testid"))
  .filter((value) => typeof value === "string" && value.length > 0);
if (matchingUserTurns.length > 1) {
  return {
    status: "review_required",
    message: "WEB_CHAT_TURN_MARKER_AMBIGUOUS",
    answerText: null,
    pageUrl: location.href,
    generating: false,
    assistantCount: 0,
    userMessageCount: matchingUserTurns.length,
    conversationTurnIds,
  };
}
if (matchingUserTurns.length === 0) {
  return {
    status: "pending",
    message: "waiting for the exact internally marked user turn",
    answerText: null,
    pageUrl: location.href,
    generating: true,
    assistantCount: 0,
    userMessageCount: 0,
    conversationTurnIds,
  };
}
const userTurnIndex = turns.indexOf(matchingUserTurns[0]);
const followingTurns = turns.slice(userTurnIndex + 1);
const assistantTurn = followingTurns.find((turn) =>
  turn.querySelector("[data-message-author-role='assistant']") instanceof Element
);
const assistantNode = assistantTurn?.querySelector("[data-message-author-role='assistant']") || null;
const answerText = assistantNode ? extractText(assistantNode) : "";
${WEB_CHAT_GENERATION_STATE_SCRIPT}
const completionAction = assistantTurn
  ? Array.from(assistantTurn.querySelectorAll("button")).find((button) => {
      const label = extractText(button.getAttribute("aria-label") || button.textContent || "");
      return button.getAttribute("data-testid") === "copy-turn-action-button"
        || /copy response|copy answer|复制回复|复制回答/i.test(label);
    })
  : null;
const exactTurnGenerating = generating || !(completionAction instanceof HTMLElement && isVisible(completionAction));
const assistantCount = assistantNode ? 1 : 0;
if (!answerText) {
  return {
    status: "pending",
    message: exactTurnGenerating
      ? "exact marked turn is still generating"
      : "assistant response after exact marked turn not found yet",
    answerText: null,
    pageUrl: location.href,
    generating: exactTurnGenerating,
    assistantCount,
    userMessageCount: 1,
    conversationTurnIds,
  };
}
return {
  status: "success",
  message: "answer extracted from assistant turn following exact internal marker",
  answerText,
  pageUrl: location.href,
  generating: exactTurnGenerating,
  assistantCount,
  userMessageCount: 1,
  conversationTurnIds,
};
`;

export const buildMarkerScopedChatGptResponseScript = (turnMarker: string): string => `
${WEB_CHAT_SELECTOR_SCRIPT_PRELUDE}
const marker = ${JSON.stringify(turnMarker)};
${MARKER_SCOPED_CHATGPT_RESPONSE_SCRIPT}
`;
