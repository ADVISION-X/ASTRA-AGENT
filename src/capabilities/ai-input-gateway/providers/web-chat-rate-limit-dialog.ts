import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";

const RATE_LIMIT_DIALOG_TEXT_SCRIPT = `
const visible = (node) => {
  if (!node || typeof node.getBoundingClientRect !== "function") return false;
  const rect = node.getBoundingClientRect();
  const style = window.getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity || "1") > 0;
};
const dialogs = Array.from(document.querySelectorAll('[role="dialog"], [data-radix-portal]'))
  .concat(Array.from(document.querySelectorAll('[role="alertdialog"], [aria-modal="true"]')))
  .filter(visible);
`;

export const isChatGptRateLimitDialogVisible = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
}): Promise<boolean> => input.browser.evaluateActiveTab<boolean>({
  description: "detect visible ChatGPT rate-limit dialog",
  script: `${RATE_LIMIT_DIALOG_TEXT_SCRIPT}
return dialogs.some((node) => {
  const text = String(node.innerText || node.textContent || "");
  const hasAcknowledgement = Array.from(node.querySelectorAll('button, [role="button"]')).some((button) => {
    const label = String((button.getAttribute("aria-label") || "") + " " + (button.textContent || "")).trim();
    return label.includes("明白") || label.includes("确定") || /got it|understand|okay|ok/i.test(label);
  });
  return hasAcknowledgement && ((text.includes("请求过于频繁") && text.includes("请稍等"))
    || /too many requests|request too frequent|try again later|temporarily limited|达到限制|使用限制|稍后再试/i.test(text)
    || text.trim().length > 0);
});
`,
  ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
});

export const acknowledgeChatGptRateLimitDialogIfVisible = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
}): Promise<string | null> => {
  const target = await input.browser.evaluateActiveTab<{ status: string; clickPoint?: { x: number; y: number } }>({
    description: "locate ChatGPT rate-limit acknowledgement button",
    script: `${RATE_LIMIT_DIALOG_TEXT_SCRIPT}
const scope = dialogs.find((node) => {
  const text = String(node.innerText || node.textContent || "");
  const hasAcknowledgement = Array.from(node.querySelectorAll('button, [role="button"]')).some((button) => {
    const label = String((button.getAttribute("aria-label") || "") + " " + (button.textContent || "")).trim();
    return label.includes("明白") || label.includes("确定") || /got it|understand|okay|ok/i.test(label);
  });
  return hasAcknowledgement && ((text.includes("请求过于频繁") && text.includes("请稍等"))
    || /too many requests|request too frequent|try again later|temporarily limited|达到限制|使用限制|稍后再试/i.test(text)
    || text.trim().length > 0);
}) || null;
if (!scope) return {status: "rate_limit_dialog_not_found"};
const buttons = Array.from(scope.querySelectorAll('button, [role="button"]')).filter(visible);
const button = buttons.find((node) => {
  const label = String((node.getAttribute("aria-label") || "") + " " + (node.innerText || node.textContent || "")).trim();
  return label.includes("明白") || label.includes("确定") || /ok|got it|understand/i.test(label);
}) || buttons[buttons.length - 1];
if (!button || typeof button.getBoundingClientRect !== "function") return {status: "rate_limit_ack_not_found"};
const rect = button.getBoundingClientRect();
return {status: "rate_limit_ack_located", clickPoint: {x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2)}};
`,
    ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
  });
  if (!target.clickPoint || target.status !== "rate_limit_ack_located") {
    return target.status === "rate_limit_dialog_not_found" ? null : target.status;
  }
  const clicked = await input.browser.click({
    targetLabel: "ChatGPT rate-limit acknowledgement",
    point: target.clickPoint,
    coordinateSpace: "browserViewport",
    button: "left",
    clickCount: 1,
  });
  if (!clicked.ok) return "rate_limit_ack_click_failed";
  await input.browser.wait(300);
  const stillVisible = await isChatGptRateLimitDialogVisible(input);
  return stillVisible ? "rate_limit_dialog_still_visible_after_ack" : "rate_limit_ack_clicked_and_dialog_closed";
};

type ChatGptAcknowledgementWatcher = { stop: () => Promise<void> };

/**
 * Keep the acknowledgement action alive across prompt submission and response
 * capture. ChatGPT may render the confirmation after either phase; a one-shot
 * check leaves the modal blocking the next browser action.
 */
export const startChatGptAcknowledgementWatcher = (input: {
  browser: BrowserController;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
}): ChatGptAcknowledgementWatcher | null => {
  if (input.request.providerKind !== "gpt-web-chat") return null;
  let stopped = false;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const tick = async (): Promise<void> => {
    if (stopped || running) return;
    running = true;
    try {
      if (await isChatGptRateLimitDialogVisible(input)) {
        const result = await acknowledgeChatGptRateLimitDialogIfVisible(input);
        process.stdout.write(`[GRASSEYE][AI-GATEWAY][WEB-CHAT] stage=acknowledgement_watcher status=${result === "rate_limit_ack_clicked_and_dialog_closed" ? "success" : "pending"} providerKind=gpt-web-chat ackStatus=${result ?? "not_found"}\n`);
      }
    } catch (error) {
      process.stdout.write(`[GRASSEYE][AI-GATEWAY][WEB-CHAT] stage=acknowledgement_watcher status=retryable_error providerKind=gpt-web-chat reason=${String(error).replaceAll("\n", " ").slice(0, 300)}\n`);
    } finally {
      running = false;
      if (!stopped) timer = setTimeout(() => void tick(), 500);
    }
  };
  timer = setTimeout(() => void tick(), 0);
  return {
    stop: async () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      for (let index = 0; running && index < 20; index += 1) await new Promise((resolve) => setTimeout(resolve, 25));
    },
  };
};
