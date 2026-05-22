import { WEB_CHAT_SELECTOR_SCRIPT_PRELUDE } from "./web-chat-selector-prelude.js";

type WebChatActionStatus = "success" | "review_required" | "failed" | "pending";

export type WebChatEvaluation = { status: WebChatActionStatus; message: string; answerText?: string | null; pageUrl?: string | null; selector?: string | null; generating?: boolean; target?: "composer-plus" | "upload-menu-item"; x?: number; y?: number; assistantCount?: number; composerText?: string | null; attachmentCount?: number; attachmentScope?: "input" | "global" | "none"; inputFocused?: boolean };

const WEB_CHAT_GENERATION_STATE_SCRIPT = `
const visibleButtonText = Array.from(document.querySelectorAll("button"))
  .filter((button) => isVisible(button))
  .map((button) => clip(button.getAttribute("aria-label") || button.textContent || ""))
  .join(" ");
const generating = /\\b(stop generating|stop responding|stop)\\b|停止生成|停止回答/i.test(visibleButtonText)
  || Boolean(document.querySelector('[aria-busy="true"]'));
`;

const WEB_CHAT_ASSISTANT_COUNT_SCRIPT = `
const assistantCount = Array.from(document.querySelectorAll("[data-message-author-role='assistant']"))
  .map((node) => clip(node.textContent || ""))
  .filter((text) => text.length > 0)
  .length;
`;

export const buildVerifyPromptSubmittedScript = (expectedText: string, previousAssistantCount: number): string => `
${WEB_CHAT_SELECTOR_SCRIPT_PRELUDE}
const input = resolveComposerInput();
const actual = input instanceof HTMLElement ? clip(input.textContent || "") : "";
const expectedPrefix = clip(${JSON.stringify(expectedText)}).slice(0, 80);
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
const isAssistantNode = (node) => {
  if (!(node instanceof Element)) return false;
  const className = String(node.className || "").toLowerCase();
  if (/model|assistant|response|gemini/.test(className)) return true;
  return Boolean(node.closest("[class*='model'], [class*='assistant'], [class*='response'], [class*='gemini']"));
};
const chatGptNodes = Array.from(document.querySelectorAll("[data-message-author-role='assistant']"));
const geminiNodes = Array.from(document.querySelectorAll("[class*='turn'],[class*='message'],[class*='model-response'],[class*='modelResponse'],article,[role='listitem']"))
  .filter(isAssistantNode);
const responseNodes = chatGptNodes.length > 0 ? chatGptNodes : geminiNodes;
const candidates = responseNodes
  .map((node) => ({
    text: clip(node.textContent || ""),
    top: node instanceof Element ? node.getBoundingClientRect().top : 0,
  }))
  .filter((candidate) => candidate.text.length >= 5)
  .sort((a, b) => a.top - b.top)
  .map((candidate) => candidate.text);
const answerText = candidates[candidates.length - 1] || "";
const assistantCount = candidates.length;
${WEB_CHAT_GENERATION_STATE_SCRIPT}
if (!answerText && generating) {
  return {status: "pending", message: "provider still generating response", answerText: null, pageUrl: location.href, generating: true, assistantCount};
}
if (!answerText) {
  return {status: "pending", message: "provider answer not found yet", answerText: null, pageUrl: location.href, generating, assistantCount};
}
return {status: "success", message: "answer extracted", answerText, pageUrl: location.href, generating, assistantCount};
`;
