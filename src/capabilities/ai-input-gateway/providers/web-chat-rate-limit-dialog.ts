import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";

const RATE_LIMIT_TEXT_PATTERN_SOURCE = "请求过于频繁|请稍等(?:几分钟)?后再试|稍后再试|达到(?:了)?(?:使用|请求|频率)限制|使用限制|too many requests|request too frequent|try again later|temporarily limited|rate limit";
const UPLOAD_BLOCKER_TEXT_PATTERN_SOURCE = "文件上传.{0,24}(?:失败|限制|上限|稍后|重试)|上传.{0,24}(?:失败|限制|上限|稍后|重试)|(?:file )?upload.{0,32}(?:failed|limit|maximum|later|again)|(?:can(?:not|'t)|unable to).{0,16}upload|maximum number of files";
const RECENT_DIALOG_MAX_AGE_MS = 30_000;

export type ChatGptBlockingDialogKind = "rate_limit" | "upload_rejected";

export type ChatGptBlockingDialogObservation = {
  kind: ChatGptBlockingDialogKind;
  observedAt: number;
  text: string;
};

let recentBlockingDialog: ChatGptBlockingDialogObservation | null = null;

const normalizeDialogText = (text: string): string => text.replace(/\s+/gu, " ").trim().slice(0, 300);

const rememberBlockingDialog = (input: { kind?: string; text?: string } | null): void => {
  if (!input?.text || (input.kind !== "rate_limit" && input.kind !== "upload_rejected")) return;
  recentBlockingDialog = {
    kind: input.kind,
    observedAt: Date.now(),
    text: normalizeDialogText(input.text),
  };
};

export const clearRecentChatGptBlockingDialog = (): void => {
  recentBlockingDialog = null;
};

export const getRecentChatGptBlockingDialog = (): ChatGptBlockingDialogObservation | null => {
  if (!recentBlockingDialog) return null;
  if (Date.now() - recentBlockingDialog.observedAt > RECENT_DIALOG_MAX_AGE_MS) {
    recentBlockingDialog = null;
    return null;
  }
  return recentBlockingDialog;
};

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
const classifyBlockingDialog = (text) => {
  if (new RegExp(${JSON.stringify(RATE_LIMIT_TEXT_PATTERN_SOURCE)}, "iu").test(text)) return "rate_limit";
  if (new RegExp(${JSON.stringify(UPLOAD_BLOCKER_TEXT_PATTERN_SOURCE)}, "iu").test(text)) return "upload_rejected";
  return null;
};
`;

export const isChatGptRateLimitDialogVisible = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
}): Promise<boolean> => {
  const detected = await input.browser.evaluateActiveTab<{ kind: string; text: string } | null>({
    description: "detect visible ChatGPT rate-limit dialog",
    script: `${RATE_LIMIT_DIALOG_TEXT_SCRIPT}
const match = dialogs.map((node) => {
  const text = String(node.innerText || node.textContent || "");
  const hasAcknowledgement = Array.from(node.querySelectorAll('button, [role="button"]')).some((button) => {
    const label = String((button.getAttribute("aria-label") || "") + " " + (button.textContent || "")).trim();
    return label.includes("明白") || label.includes("确定") || /got it|understand|okay|ok/i.test(label);
  });
  const kind = classifyBlockingDialog(text);
  return hasAcknowledgement && kind ? {kind, text} : null;
}).find(Boolean) || null;
return match;
`,
    ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
  });
  rememberBlockingDialog(detected);
  return detected !== null;
};

export const acknowledgeChatGptRateLimitDialogIfVisible = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
}): Promise<string | null> => {
  const target = await input.browser.evaluateActiveTab<{
    status: string;
    pageUrl: string;
    clickPoint?: { x: number; y: number };
    kind?: string;
    text?: string;
  }>({
    description: "locate ChatGPT rate-limit acknowledgement button",
    script: `${RATE_LIMIT_DIALOG_TEXT_SCRIPT}
const scope = dialogs.find((node) => {
  const text = String(node.innerText || node.textContent || "");
  const hasAcknowledgement = Array.from(node.querySelectorAll('button, [role="button"]')).some((button) => {
    const label = String((button.getAttribute("aria-label") || "") + " " + (button.textContent || "")).trim();
    return label.includes("明白") || label.includes("确定") || /got it|understand|okay|ok/i.test(label);
  });
  return hasAcknowledgement && classifyBlockingDialog(text) !== null;
}) || null;
if (!scope) return {status: "rate_limit_dialog_not_found", pageUrl: location.href};
const text = String(scope.innerText || scope.textContent || "");
const kind = classifyBlockingDialog(text);
const buttons = Array.from(scope.querySelectorAll('button, [role="button"]')).filter(visible);
const button = buttons.find((node) => {
  const label = String((node.getAttribute("aria-label") || "") + " " + (node.innerText || node.textContent || "")).trim();
  return label.includes("明白") || label.includes("确定") || /ok|got it|understand/i.test(label);
}) || buttons[buttons.length - 1];
if (!button || typeof button.getBoundingClientRect !== "function") return {status: "rate_limit_ack_not_found", pageUrl: location.href, kind, text};
const rect = button.getBoundingClientRect();
return {status: "rate_limit_ack_located", pageUrl: location.href, kind, text, clickPoint: {x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2)}};
`,
    ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
  });
  rememberBlockingDialog(target);
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
  clearRecentChatGptBlockingDialog();
  await input.browser.wait(300);
  return "rate_limit_ack_clicked_in_place";
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
        process.stdout.write(`[GRASSEYE][AI-GATEWAY][WEB-CHAT] stage=acknowledgement_watcher status=${result === "rate_limit_ack_clicked_in_place" ? "success" : "pending"} providerKind=gpt-web-chat ackStatus=${result ?? "not_found"}\n`);
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
