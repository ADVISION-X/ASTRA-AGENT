import { readWorkbenchPairingState } from "./pairing-auto-bootstrap.js";

type PairingResponse = Readonly<{
  ok: boolean;
  errorCode?: string;
  authenticated?: boolean;
  automaticPairingErrorCode?: string | null;
}>;

declare const chrome: {
  runtime: Readonly<{
    sendMessage(message: unknown): Promise<PairingResponse>;
  }>;
};

const status = document.querySelector<HTMLElement>("#status");
const reconnect = document.querySelector<HTMLButtonElement>("#reconnect");

const show = (message: string): void => {
  if (status) status.textContent = message;
};

const describeError = (code: string | undefined): string => ({
  BROWSER_AUTHENTICATION_INCOMPLETE: "浏览器认证尚未完成，请确认 AGENT 正在运行。",
  BROWSER_AUTH_TRANSCRIPT_INVALID: "当前一次性密钥已经失效，请重新自动连接。",
  BROWSER_PAIRING_ORIGIN_REJECTED: "AGENT 拒绝了扩展来源，请检查固定扩展身份或本地网络权限。",
  BROWSER_PAIRING_RESPONSE_INVALID: "AGENT 返回了无效的配对或插件版本状态。",
  BROWSER_EXTENSION_CHANNEL_UNAVAILABLE: "无法连接本机 ASTRA-AGENT。请先运行 npm run grasseye:start。",
  BROWSER_LIVENESS_EXPIRED: "浏览器授权已失效，请重新连接。",
  BROWSER_PAIRING_IN_PROGRESS: "连接正在进行，请稍候。",
  BROWSER_PAIRING_ALREADY_AUTHENTICATED: "扩展已经完成认证。",
  BROWSER_TARGET_INVALID: "必须只有一个可认领的 ChatGPT 页面；请关闭多余页面后重新连接。",
  BROWSER_DEVTOOLS_CONFLICT: "ChatGPT 页面已被 DevTools 或其他调试器占用。",
}[code ?? ""] ?? (code ? `操作失败（${code}）` : "操作失败。"));

const send = async (message: unknown): Promise<PairingResponse> => {
  try {
    return await chrome.runtime.sendMessage(message);
  } catch {
    return { ok: false, errorCode: "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE" };
  }
};

const reconnectAutomatically = async (): Promise<void> => {
  let pairingSecret: string | null = null;
  try {
    if (reconnect) reconnect.disabled = true;
    show("正在从本机 ASTRA-AGENT 获取一次性密钥…");
    const pairing = await readWorkbenchPairingState();
    if (pairing.authority === "present") {
      show("扩展已认证；ChatGPT Target 由固定扩展自动认领。");
      return;
    }
    pairingSecret = pairing.pairingSecret;
    const result = await send({ kind: "GRASSEYE_AUTOMATIC_PAIRING_SECRET", pairingSecret });
    if (!result.ok) throw new Error(result.errorCode ?? "BROWSER_AUTHENTICATION_INCOMPLETE");
    show("认证完成；正在自动认领唯一 ChatGPT Target。");
  } catch (error) {
    show(describeError(error instanceof Error ? error.message : undefined));
  } finally {
    pairingSecret = null;
    if (reconnect) reconnect.disabled = false;
  }
};

reconnect?.addEventListener("click", () => { void reconnectAutomatically(); });

void send({ kind: "GRASSEYE_BROWSER_STATUS" }).then((result) => {
  if (result.ok && result.authenticated) {
    show("扩展已认证；ChatGPT Target 由固定扩展自动认领。");
    return;
  }
  if (result.automaticPairingErrorCode) {
    show(describeError(result.automaticPairingErrorCode));
    return;
  }
  show("扩展会自动连接 ASTRA-AGENT；首次被 Chrome 阻止时，请点击“自动连接”并允许本地网络访问。");
});
