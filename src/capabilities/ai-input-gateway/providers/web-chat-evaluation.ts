import { WEB_CHAT_SELECTOR_SCRIPT_PRELUDE } from "./web-chat-selector-prelude.js";

export type WebChatActionStatus = "success" | "review_required" | "failed" | "pending";

export type WebChatEvaluation = { status: WebChatActionStatus; message: string; answerText?: string | null; pageUrl?: string | null; selector?: string | null; generating?: boolean; target?: "composer-plus" | "upload-menu-item"; x?: number; y?: number; assistantCount?: number; composerText?: string | null };

export const buildFindUploadTargetScript = (): string => `
${WEB_CHAT_SELECTOR_SCRIPT_PRELUDE}
const findInput = () => {
  const inputs = Array.from(document.querySelectorAll("input[type='file']"));
  return inputs.find((candidate) => {
    const id = candidate.getAttribute("id") || "";
    const accept = candidate.getAttribute("accept") || "";
    return id === "upload-files" || accept.length === 0 || /video|mp4|\\*/i.test(accept);
  }) || inputs[0] || null;
};
let input = findInput();
if (!input) {
  const attachTrigger = Array.from(document.querySelectorAll("button, label, div[role='button'], span[role='button']")).find((node) => {
    const text = clip(node.getAttribute("aria-label") || node.getAttribute("id") || node.textContent || "");
    return /attach|upload|file|paperclip|plus|add files?|添加|上传|附件/i.test(text);
  });
  if (attachTrigger instanceof HTMLElement) {
    attachTrigger.click();
    input = findInput();
  }
}
if (!(input instanceof HTMLInputElement)) {
  return {status: "review_required", message: "provider file input not found", pageUrl: location.href, selector: null};
}
return {
  status: "success",
  message: "provider file input located",
  pageUrl: location.href,
  selector: selectorFor(input),
};
`;

export const buildWaitForUploadScript = (fileName: string): string => `
${WEB_CHAT_SELECTOR_SCRIPT_PRELUDE}
const targetFileName = ${JSON.stringify(fileName)};
const composer = resolveComposerInput();
let composerRoot = composer;
for (let depth = 0; depth < 8 && composerRoot?.parentElement; depth += 1) {
  const text = clip(composerRoot.textContent || "");
  if (text.includes(targetFileName) || composerRoot.querySelector?.("#composer-submit-button, #composer-plus-btn")) break;
  composerRoot = composerRoot.parentElement;
}
const composerText = clip(composerRoot?.textContent || "");
const composerLabels = Array.from((composerRoot || document).querySelectorAll?.("[aria-label]") || [])
  .map((node) => clip(node.getAttribute("aria-label") || ""))
  .join(" ");
const scopedText = composerText + " " + composerLabels;
const hasFileName = scopedText.includes(targetFileName);
const busy = Boolean(composerRoot?.querySelector?.("[aria-busy='true'], [role='progressbar']"));
const uploadText = /uploading|processing|analyzing|preparing|加载|上传中|处理中/i.test(scopedText);
if (hasFileName && !busy && !uploadText) {
  return {status: "success", message: "provider upload complete", pageUrl: location.href};
}
return {
  status: "pending",
  message: hasFileName ? "waiting for provider upload completion" : "waiting for provider file chip",
  pageUrl: location.href,
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
return {status: "success", message: "provider input box focused", pageUrl: location.href};
`;

export const buildSetComposerTextScript = (text: string): string => `
${WEB_CHAT_SELECTOR_SCRIPT_PRELUDE}
const input = resolveComposerInput();
if (!(input instanceof HTMLElement)) {
  return {status: "review_required", message: "provider input box not found", pageUrl: location.href, composerText: null};
}
input.focus();
const text = ${JSON.stringify(text)};
if (input.isContentEditable) {
  input.textContent = text;
  input.dispatchEvent(new InputEvent("input", {bubbles: true, inputType: "insertText", data: text}));
} else if ("value" in input) {
  const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value");
  if (descriptor && typeof descriptor.set === "function") descriptor.set.call(input, text);
  else input.value = text;
  input.dispatchEvent(new InputEvent("input", {bubbles: true, inputType: "insertText", data: text}));
}
return {status: "success", message: "provider composer text set", pageUrl: location.href, composerText: clip(input.textContent || input.value || "")};
`;

export const buildVerifyComposerTextScript = (expectedText: string): string => `
${WEB_CHAT_SELECTOR_SCRIPT_PRELUDE}
const input = resolveComposerInput();
const actual = input instanceof HTMLElement ? clip(input.textContent || input.value || "") : "";
const expected = ${JSON.stringify(expectedText)};
const expectedPrefix = clip(expected).slice(0, 80);
return {
  status: actual.includes(expectedPrefix) ? "success" : "pending",
  message: actual.includes(expectedPrefix) ? "provider composer contains prompt text" : "provider composer prompt text missing",
  pageUrl: location.href,
  composerText: actual,
};
`;

export const buildVerifyPromptSubmittedScript = (expectedText: string, previousAssistantCount: number): string => `
${WEB_CHAT_SELECTOR_SCRIPT_PRELUDE}
const input = resolveComposerInput();
const actual = input instanceof HTMLElement ? clip(input.textContent || input.value || "") : "";
const expectedPrefix = clip(${JSON.stringify(expectedText)}).slice(0, 80);
const assistantCount = Array.from(document.querySelectorAll("[data-message-author-role='assistant']"))
  .map((node) => clip(node.textContent || ""))
  .filter((text) => text.length > 0)
  .length;
const visibleButtonText = Array.from(document.querySelectorAll("button"))
  .filter((button) => isVisible(button))
  .map((button) => clip(button.getAttribute("aria-label") || button.textContent || ""))
  .join(" ");
const generating = /\\b(stop generating|stop responding)\\b|停止生成|停止回答/i.test(visibleButtonText)
  || (
    /generating|thinking|reasoning|回答中|生成中|思考中/i.test(bodyText)
    && !/已停止思考|stopped thinking/i.test(bodyText)
  );
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
const visibleButtonText = Array.from(document.querySelectorAll("button"))
  .filter((button) => isVisible(button))
  .map((button) => clip(button.getAttribute("aria-label") || button.textContent || ""))
  .join(" ");
const generating = /\\b(stop generating|stop responding)\\b|停止生成|停止回答/i.test(visibleButtonText)
  || (
    /generating|thinking|reasoning|回答中|生成中|思考中/i.test(bodyText)
    && !/已停止思考|stopped thinking/i.test(bodyText)
  );
if (!answerText && generating) {
  return {status: "pending", message: "provider still generating response", answerText: null, pageUrl: location.href, generating: true, assistantCount};
}
if (!answerText) {
  return {status: "pending", message: "provider answer not found yet", answerText: null, pageUrl: location.href, generating, assistantCount};
}
return {status: "success", message: "answer extracted", answerText, pageUrl: location.href, generating, assistantCount};
`;
