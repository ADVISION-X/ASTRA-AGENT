import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type {
  AiProviderAdapterContext,
  AiProviderRawResponse,
} from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";

type WebChatEvaluation = {
  status: "success" | "review_required" | "failed";
  message: string;
  answerText?: string | null;
  pageUrl?: string | null;
};

const buildSubmitPromptScript = (prompt: string): string => `
const promptText = ${JSON.stringify(prompt)};
const bodyText = document.body?.innerText || "";
if (/captcha|verify|verification|2fa|two-factor|login|sign in/i.test(bodyText)) {
  return {status: "review_required", message: "provider requires login or security verification", pageUrl: location.href};
}
const input = document.querySelector("textarea, [contenteditable='true'], input[type='text']");
if (!input) return {status: "review_required", message: "provider input box not found", pageUrl: location.href};
input.focus();
if (input.isContentEditable) {
  input.textContent = promptText;
  input.dispatchEvent(new InputEvent("input", {bubbles: true, inputType: "insertText", data: promptText}));
} else {
  const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value");
  if (descriptor && typeof descriptor.set === "function") descriptor.set.call(input, promptText);
  else input.value = promptText;
  input.dispatchEvent(new InputEvent("input", {bubbles: true, inputType: "insertText", data: promptText}));
}
const buttons = Array.from(document.querySelectorAll("button"));
const submit = buttons.find((button) => /send|submit|run|arrow|发送|提交/i.test(button.getAttribute("aria-label") || button.textContent || ""));
if (submit instanceof HTMLElement) submit.click();
return {status: "success", message: "prompt submitted", pageUrl: location.href};
`;

const EXTRACT_LAST_RESPONSE_SCRIPT = `
const candidates = Array.from(document.querySelectorAll("[data-message-author-role='assistant'], .assistant, article, main p, main div"))
  .map((node) => (node.textContent || "").trim())
  .filter((text) => text.length > 0);
const answerText = candidates[candidates.length - 1] || "";
return answerText
  ? {status: "success", message: "answer extracted", answerText, pageUrl: location.href}
  : {status: "review_required", message: "provider answer was not found", answerText: null, pageUrl: location.href};
`;

const restoreSourcePage = async (
  browser: BrowserController,
  sourceUrl: string | null,
): Promise<boolean | null> => {
  if (!sourceUrl || sourceUrl === "about:blank") return null;
  const restored = await browser.open({ url: sourceUrl, title: "Restore source page after AI feed" });
  return restored.ok;
};

export const runWebChatAdapter = async (input: {
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  providerUrl: string;
  runtimeName: string;
}): Promise<AiProviderRawResponse> => {
  const browser = input.context.browser;
  if (!browser) {
    throw new Error("Web chat feed requires a governed BrowserController.");
  }
  const sourcePageUrlBeforeFeed = browser.getSessionState().currentUrl || null;
  const opened = await browser.open({ url: input.providerUrl, title: input.runtimeName });
  if (!opened.ok) {
    throw new Error(`Web chat provider page could not be opened: ${opened.message}`);
  }
  const submitted = await browser.evaluateActiveTab<WebChatEvaluation>({
    description: "submit governed prompt to AI web chat",
    script: buildSubmitPromptScript(input.request.textPrompt),
    ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
  });
  if (submitted.status !== "success") {
    const restoredSourcePage = await restoreSourcePage(browser, sourcePageUrlBeforeFeed);
    throw new Error(`${submitted.status}: ${submitted.message}; restoredSourcePage=${String(restoredSourcePage)}`);
  }
  await browser.wait(500);
  const extracted = await browser.evaluateActiveTab<WebChatEvaluation>({
    description: "extract last AI web chat response",
    script: EXTRACT_LAST_RESPONSE_SCRIPT,
    ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
  });
  const restoredSourcePage = await restoreSourcePage(browser, sourcePageUrlBeforeFeed);
  if (extracted.status !== "success" || !extracted.answerText) {
    throw new Error(`${extracted.status}: ${extracted.message}; restoredSourcePage=${String(restoredSourcePage)}`);
  }
  return {
    rawText: extracted.answerText,
    modelName: input.request.modelName,
    runtimeName: input.runtimeName,
    transport: "web-chat",
    webChatUrl: extracted.pageUrl ?? input.providerUrl,
    sourcePageUrlBeforeFeed,
    restoredSourcePage,
    estimatedInputTokens: null,
    estimatedOutputTokens: null,
    tokenEstimateUnavailableReason: "web chat token estimates are unavailable.",
  };
};
