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

const requireBrowser = (context: AiProviderAdapterContext): BrowserController => {
  if (!context.browser) {
    throw new Error("Web chat feed requires a governed BrowserController.");
  }
  return context.browser;
};

const openProviderPage = async (
  browser: BrowserController,
  providerUrl: string,
  runtimeName: string,
): Promise<void> => {
  const opened = await browser.open({ url: providerUrl, title: runtimeName });
  if (!opened.ok) {
    throw new Error(`Web chat provider page could not be opened: ${opened.message}`);
  }
};

const submitPrompt = (
  browser: BrowserController,
  request: AiFeedInput,
  context: AiProviderAdapterContext,
): Promise<WebChatEvaluation> =>
  browser.evaluateActiveTab<WebChatEvaluation>({
    description: "submit governed prompt to AI web chat",
    script: buildSubmitPromptScript(request.textPrompt),
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });

const extractAnswer = (
  browser: BrowserController,
  context: AiProviderAdapterContext,
): Promise<WebChatEvaluation> =>
  browser.evaluateActiveTab<WebChatEvaluation>({
    description: "extract last AI web chat response",
    script: EXTRACT_LAST_RESPONSE_SCRIPT,
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });

const assertSubmitted = async (input: {
  submitted: WebChatEvaluation;
  browser: BrowserController;
  sourceUrl: string | null;
}): Promise<void> => {
  if (input.submitted.status === "success") return;
  const restoredSourcePage = await restoreSourcePage(input.browser, input.sourceUrl);
  throw new Error(`${input.submitted.status}: ${input.submitted.message}; restoredSourcePage=${String(restoredSourcePage)}`);
};

const assertExtracted = (input: {
  extracted: WebChatEvaluation;
  restoredSourcePage: boolean | null;
}): string => {
  if (input.extracted.status === "success" && input.extracted.answerText) {
    return input.extracted.answerText;
  }
  throw new Error(`${input.extracted.status}: ${input.extracted.message}; restoredSourcePage=${String(input.restoredSourcePage)}`);
};

export const runWebChatAdapter = async (input: {
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  providerUrl: string;
  runtimeName: string;
}): Promise<AiProviderRawResponse> => {
  const browser = requireBrowser(input.context);
  const sourcePageUrlBeforeFeed = browser.getSessionState().currentUrl || null;
  await openProviderPage(browser, input.providerUrl, input.runtimeName);
  await assertSubmitted({
    submitted: await submitPrompt(browser, input.request, input.context),
    browser,
    sourceUrl: sourcePageUrlBeforeFeed,
  });
  await browser.wait(500);
  const extracted = await extractAnswer(browser, input.context);
  const restoredSourcePage = await restoreSourcePage(browser, sourcePageUrlBeforeFeed);
  const answerText = assertExtracted({ extracted, restoredSourcePage });
  return {
    rawText: answerText,
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
