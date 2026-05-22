import { WEB_CHAT_SELECTOR_SCRIPT_PRELUDE } from "./web-chat-selector-prelude.js";

type WebChatActionStatus = "success" | "review_required" | "failed" | "pending";

export type WebChatEvaluation = { status: WebChatActionStatus; message: string; answerText?: string | null; pageUrl?: string | null; selector?: string | null; generating?: boolean; target?: "composer-plus" | "upload-menu-item"; x?: number; y?: number; assistantCount?: number; composerText?: string | null; attachmentCount?: number; attachmentScope?: "input" | "global" | "none"; inputFocused?: boolean };

const WEB_CHAT_GENERATION_STATE_SCRIPT = `
const visibleButtonText = Array.from(document.querySelectorAll("button"))
  .filter((button) => isVisible(button))
  .map((button) => clip(button.getAttribute("aria-label") || button.textContent || ""))
  .join(" ");
const generating = /\\b(stop generating|stop responding)\\b|停止生成|停止回答/i.test(visibleButtonText)
  || (
    /generating|thinking|reasoning|回答中|生成中|思考中/i.test(bodyText)
    && !/已停止思考|stopped thinking/i.test(bodyText)
  );
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
const assistantNodes = Array.from(document.querySelectorAll("[data-message-author-role='assistant']"));
const responseNodes = assistantNodes.length > 0
  ? assistantNodes
  : [
      ...document.querySelectorAll("main article"),
      ...document.querySelectorAll("main [data-testid*='conversation']"),
      ...document.querySelectorAll("main [role='presentation']"),
    ];
const candidates = responseNodes
  .map((node) => clip(node.textContent || ""))
  .filter((text) => text.length > 0);
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
