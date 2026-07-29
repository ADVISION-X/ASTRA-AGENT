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

export const WEB_CHAT_GENERATION_STATE_SCRIPT = `
const visibleButtonText = Array.from(document.querySelectorAll("button"))
  .filter((button) => isVisible(button))
  .map((button) => clip(button.getAttribute("aria-label") || button.textContent || ""))
  .join(" ");
${WEB_CHAT_STATUS_TEXT_SCRIPT}
const visibleConversationBusy = Array.from(document.querySelectorAll("main [aria-busy='true'], [role='main'] [aria-busy='true']"))
  .some((node) =>
    isVisible(node)
    && !node.closest("form, footer, header, nav, aside, [role='textbox'], [contenteditable='true']")
  );
const generating = /\\b(stop generating|stop responding|stop)\\b|停止生成|停止回答/i.test(visibleButtonText)
  || visibleConversationBusy
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

const WEB_CHAT_SUBMITTED_TURN_STATE_SCRIPT = `
const chatGptUserMessages = Array.from(document.querySelectorAll("[data-message-author-role='user']"))
  .filter((node) => node instanceof HTMLElement && isVisible(node));
const geminiUserMessageCandidates = Array.from(document.querySelectorAll("user-query, user-query-content, .user-query-container"))
  .filter((node) => node instanceof HTMLElement && isVisible(node))
  .filter((node) => clip(node.innerText || node.textContent || "").length > 0);
const geminiUserMessages = geminiUserMessageCandidates
  .filter((node) => !geminiUserMessageCandidates.some((other) => other !== node && other.contains(node)));
const userMessages = chatGptUserMessages.length > 0 ? chatGptUserMessages : geminiUserMessages;
const userMessageCount = userMessages.length;
const lastUserMessage = userMessages[userMessages.length - 1] || null;
const lastUserMessageText = lastUserMessage instanceof HTMLElement
  ? clip(lastUserMessage.innerText || lastUserMessage.textContent || "")
  : "";
const foreignTransportMarker = lastUserMessageText.match(/INTERNAL_TRANSPORT_MARKER:GRASSEYE_TURN_[A-Za-z0-9_-]+/u)?.[0] || null;
const expectedTransportMarker = expectedSuffix.match(/INTERNAL_TRANSPORT_MARKER:GRASSEYE_TURN_[A-Za-z0-9_-]+/u)?.[0] || null;
const matchingExpectedTurns = expectedTransportMarker
  ? userMessages.filter((message) => clip(message.innerText || message.textContent || "").includes(expectedTransportMarker))
  : [];
const expectedUserMessage = matchingExpectedTurns.length === 1 ? matchingExpectedTurns[0] : null;
const expectedUserMessageText = expectedUserMessage instanceof HTMLElement
  ? clip(expectedUserMessage.innerText || expectedUserMessage.textContent || "")
  : "";
const promptBoundToExpectedTurn = expectedPrefix.length > 0 && expectedUserMessageText.includes(expectedPrefix);
const promptSuffixBoundToExpectedTurn = expectedSuffix.length > 0 && expectedUserMessageText.includes(expectedSuffix);
const expectedTurnIsLast = expectedUserMessage !== null && expectedUserMessage === lastUserMessage;
const promptStillInComposer = expectedPrefix.length > 0 && actual.includes(expectedPrefix);
`;

const WEB_CHAT_SUBMITTED_VERDICT_SCRIPT = `
if (matchingExpectedTurns.length > 1) {
  return {
    status: "failed",
    message: "WEB_CHAT_TURN_MARKER_AMBIGUOUS",
    pageUrl: location.href,
    generating,
    assistantCount,
    userMessageCount,
    matchingExpectedTurnCount: matchingExpectedTurns.length,
    composerText: actual,
  };
}
if (
  expectedUserMessage
  && !expectedTurnIsLast
  && foreignTransportMarker
  && expectedTransportMarker
  && foreignTransportMarker !== expectedTransportMarker
) {
  return {
    status: "failed",
    message: "WEB_CHAT_FOREIGN_TURN_REBOUND",
    pageUrl: location.href,
    generating,
    assistantCount,
    userMessageCount,
    lastUserMessageText,
    composerText: actual,
    foreignTransportMarker,
    expectedTransportMarker,
  };
}
if (
  expectedTurnIsLast
  && promptBoundToExpectedTurn
  && promptSuffixBoundToExpectedTurn
  && composerClearedAfterVerifiedPaste
) {
  return {
    status: "success",
    message: "provider contains exactly one latest user turn with the exact verified transport marker and prompt identity",
    pageUrl: location.href,
    generating,
    assistantCount,
    userMessageCount,
    previousUserMessageCount,
    lastUserMessageText: expectedUserMessageText,
    composerText: actual,
    promptPrefixVisible: promptStillInComposer,
    promptSuffixVisible: promptSuffixBoundToExpectedTurn,
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

export const buildVerifyPromptSubmittedScript = (input: {
  expectedPrefix: string;
  expectedSuffix: string;
  previousUserMessageCount: number;
  wasPromptVerifiedBeforeSubmit: boolean;
}): string => `
${WEB_CHAT_SELECTOR_SCRIPT_PRELUDE}
const input = resolveComposerInput();
const actual = input instanceof HTMLElement ? readComposerVisibleText(input) : "";
const expectedPrefix = ${JSON.stringify(input.expectedPrefix)};
const expectedSuffix = ${JSON.stringify(input.expectedSuffix)};
${WEB_CHAT_ASSISTANT_COUNT_SCRIPT}
${WEB_CHAT_GENERATION_STATE_SCRIPT}
${WEB_CHAT_SUBMITTED_TURN_STATE_SCRIPT}
const previousUserMessageCount = ${JSON.stringify(input.previousUserMessageCount)};
${CHATGPT_PASTED_TEXT_CARD_STATE_SCRIPT}
const composerClearedAfterVerifiedPaste = ${JSON.stringify(input.wasPromptVerifiedBeforeSubmit)}
  && !promptStillInComposer
  && !pastedTextCardReady;
${WEB_CHAT_SUBMITTED_VERDICT_SCRIPT}
`;
