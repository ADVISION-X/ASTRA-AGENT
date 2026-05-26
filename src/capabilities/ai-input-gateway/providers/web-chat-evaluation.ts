import { WEB_CHAT_SELECTOR_SCRIPT_PRELUDE } from "./web-chat-selector-prelude.js";

type WebChatActionStatus = "success" | "review_required" | "failed" | "pending";

export type WebChatEvaluation = { status: WebChatActionStatus; message: string; answerText?: string | null; pageUrl?: string | null; selector?: string | null; generating?: boolean; target?: "composer-plus" | "upload-menu-item"; x?: number; y?: number; assistantCount?: number; composerText?: string | null; attachmentCount?: number; attachmentScope?: "input" | "global" | "none"; inputFocused?: boolean };

const WEB_CHAT_STATUS_TEXT_SCRIPT = `
const visibleStatusText = Array.from(document.querySelectorAll("[role='status'], [aria-live], [data-testid*='status'], [class*='status'], [class*='thinking'], [class*='reasoning'], [class*='loading']"))
  .filter((node) => isVisible(node) && !node.closest("form, footer, header, nav, aside"))
  .map((node) => clip(node.textContent || ""))
  .filter((text) => text.length > 0)
  .join(" ");
const processing = /\\b(thinking|reasoning|analyzing|analysis|searching|processing|reading|browsing|uploading|working)\\b|思考|推理|分析|搜索|处理中|生成中|读取中|工作中/i.test(visibleStatusText);
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

export const buildVerifyPromptSubmittedScript = (expectedPrefix: string, previousAssistantCount: number): string => `
${WEB_CHAT_SELECTOR_SCRIPT_PRELUDE}
const input = resolveComposerInput();
const actual = input instanceof HTMLElement ? clip(input.textContent || "") : "";
const expectedPrefix = ${JSON.stringify(expectedPrefix)};
${WEB_CHAT_ASSISTANT_COUNT_SCRIPT}
${WEB_CHAT_GENERATION_STATE_SCRIPT}
const promptStillInComposer = actual.includes(expectedPrefix);
if (assistantCount > ${JSON.stringify(previousAssistantCount)} || generating || !promptStillInComposer) {
  return {
    status: "success",
    message: assistantCount > ${JSON.stringify(previousAssistantCount)}
      ? "provider assistant count increased after submit"
      : generating
        ? "provider started generating after submit"
        : "provider composer cleared after submit",
    pageUrl: location.href,
    generating,
    assistantCount,
    composerText: actual,
  };
}
return {
  status: "pending",
  message: "provider prompt is still waiting in composer after submit click",
  pageUrl: location.href,
  generating,
  assistantCount,
  composerText: actual,
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
const answerText = lastCandidate?.text || "";
const assistantCount = structuredCandidates.length > 0
  ? structuredCandidates.length
  : answerText
    ? 1
    : 0;
${WEB_CHAT_GENERATION_STATE_SCRIPT}
if (!answerText && generating) {
  return {status: "pending", message: "provider still generating response", answerText: null, pageUrl: location.href, generating: true, assistantCount};
}
if (!answerText) {
  return {status: "pending", message: "provider answer not found yet", answerText: null, pageUrl: location.href, generating, assistantCount};
}
return {
  status: "success",
  message: lastCandidate?.source === "visible_raw_capture"
    ? "answer extracted from visible assistant raw capture"
    : "answer extracted",
  answerText,
  pageUrl: location.href,
  generating,
  assistantCount,
};
`;
