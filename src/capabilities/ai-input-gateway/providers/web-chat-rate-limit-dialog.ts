import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";

const RATE_LIMIT_TEXT = /请求过于频繁|请稍等(?:几分钟)?后再试|稍后再试|达到(?:了)?(?:使用|请求|频率)限制|使用限制|too many requests|request too frequent|try again later|temporarily limited|rate limit/iu;
const UPLOAD_BLOCKER_TEXT = /文件上传.{0,24}(?:失败|限制|上限|稍后|重试)|上传.{0,24}(?:失败|限制|上限|稍后|重试)|(?:file )?upload.{0,32}(?:failed|limit|maximum|later|again)|(?:can(?:not|'t)|unable to).{0,16}upload|maximum number of files/iu;
const RECENT_DIALOG_MAX_AGE_MS = 30_000;

export type ChatGptBlockingDialogKind = "rate_limit" | "upload_rejected";
export type ChatGptBlockingDialogObservation = Readonly<{
  kind: ChatGptBlockingDialogKind;
  observedAt: number;
  text: string;
}>;

let recentBlockingDialog: ChatGptBlockingDialogObservation | null = null;

const remember = (kind: ChatGptBlockingDialogKind, text: string): void => {
  recentBlockingDialog = { kind, observedAt: Date.now(), text: text.replace(/\s+/gu, " ").trim().slice(0, 300) };
};

export const clearRecentChatGptBlockingDialog = (): void => { recentBlockingDialog = null; };

export const getRecentChatGptBlockingDialog = (): ChatGptBlockingDialogObservation | null => {
  if (recentBlockingDialog && Date.now() - recentBlockingDialog.observedAt > RECENT_DIALOG_MAX_AGE_MS) {
    recentBlockingDialog = null;
  }
  return recentBlockingDialog;
};

const detectBlockingDialog = async (browser: BrowserTargetLease): Promise<ChatGptBlockingDialogObservation | null> => {
  const found = await browser.executeDomIntent({ kind: "find", locator: { role: "dialog" }, maxMatches: 1 });
  if (typeof found !== "object" || found === null || Array.isArray(found)
    || typeof (found as { count?: unknown }).count !== "number") throw new Error("BROWSER_TARGET_INVALID");
  if ((found as { count: number }).count === 0) return null;
  const inspection = await browser.executeDomIntent({
    kind: "inspect",
    selector: "[role='dialog']",
    fields: ["visible", "text"],
  });
  if (typeof inspection !== "object" || inspection === null || Array.isArray(inspection)) throw new Error("BROWSER_TARGET_INVALID");
  const value = inspection as Record<string, unknown>;
  if (value.visible !== true || typeof value.text !== "string") return null;
  const kind = RATE_LIMIT_TEXT.test(value.text)
    ? "rate_limit"
    : UPLOAD_BLOCKER_TEXT.test(value.text) ? "upload_rejected" : null;
  if (!kind) return null;
  remember(kind, value.text);
  return recentBlockingDialog;
};

export const isChatGptRateLimitDialogVisible = async (input: {
  browser: BrowserTargetLease;
  context: AiProviderAdapterContext;
}): Promise<boolean> => {
  void input.context;
  return (await detectBlockingDialog(input.browser)) !== null;
};

/** The acknowledgement button has not been observed; never guess a click. */
export const acknowledgeChatGptRateLimitDialogIfVisible = async (input: {
  browser: BrowserTargetLease;
  context: AiProviderAdapterContext;
}): Promise<string | null> => {
  void input.context;
  const dialog = await detectBlockingDialog(input.browser);
  if (!dialog) return null;
  return "rate_limit_ack_not_production_verified";
};

type ChatGptAcknowledgementWatcher = Readonly<{ stop: () => Promise<void> }>;

/** No background clicker exists until the acknowledgement control is witnessed. */
export const startChatGptAcknowledgementWatcher = (
  input: { browser: BrowserTargetLease; request: AiFeedInput; context: AiProviderAdapterContext },
): ChatGptAcknowledgementWatcher | null => {
  void input.browser;
  void input.context;
  if (input.request.providerKind !== "gpt-web-chat") return null;
  return { stop: async () => undefined };
};
