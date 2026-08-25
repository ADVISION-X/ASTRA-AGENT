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
const claim = document.querySelector<HTMLButtonElement>("#claim");

const show = (message: string): void => {
  if (status) status.textContent = message;
};

const describeError = (code: string | undefined): string => ({
  BROWSER_AUTHENTICATION_INCOMPLETE: "浏览器认证尚未完成，请确认 AGENT 正在运行。",
  BROWSER_AUTH_TRANSCRIPT_INVALID: "当前一次性密钥已经失效，请重新自动连接。",
  BROWSER_PAIRING_ORIGIN_REJECTED: "AGENT 拒绝了扩展来源，请检查固定扩展身份或本地网络权限。",
  BROWSER_PAIRING_RESPONSE_INVALID: "AGENT 返回了无效的配对或插件版本状态。",
  BROWSER_EXTENSION_CHANNEL_UNAVAILABLE: "无法连接本机 AGENT。请先运行 npm run grasseye:start。",
  BROWSER_LIVENESS_EXPIRED: "浏览器授权已失效，请重新连接。",
  BROWSER_PAIRING_IN_PROGRESS: "连接正在进行，请稍候。",
  BROWSER_PAIRING_ALREADY_AUTHENTICATED: "扩展已经完成认证。",
  BROWSER_TARGET_INVALID: "请先切换到需要控制的 HTTPS 标签页。",
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
    show("正在从本机 AGENT 获取一次性密钥…");
    const pairing = await readWorkbenchPairingState();
    if (pairing.authority === "present") {
      if (claim) claim.disabled = false;
      show("扩展已认证，可以认领当前 HTTPS 标签页。");
      return;
    }
    pairingSecret = pairing.pairingSecret;
    const result = await send({ kind: "GRASSEYE_AUTOMATIC_PAIRING_SECRET", pairingSecret });
    if (!result.ok) throw new Error(result.errorCode ?? "BROWSER_AUTHENTICATION_INCOMPLETE");
    if (claim) claim.disabled = false;
    show("认证完成。现在可以认领当前 HTTPS 标签页。");
  } catch (error) {
    show(describeError(error instanceof Error ? error.message : undefined));
  } finally {
    pairingSecret = null;
    if (reconnect) reconnect.disabled = false;
  }
};

reconnect?.addEventListener("click", () => { void reconnectAutomatically(); });

claim?.addEventListener("click", () => {
  void send({ kind: "GRASSEYE_CLAIM_ACTIVE_TARGET" }).then((result) => {
    show(result.ok ? "当前 HTTPS 标签页已认领。" : describeError(result.errorCode));
  });
});

void send({ kind: "GRASSEYE_BROWSER_STATUS" }).then((result) => {
  if (result.ok && result.authenticated) {
    if (claim) claim.disabled = false;
    show("扩展已认证，可以认领当前 HTTPS 标签页。");
    return;
  }
  if (result.automaticPairingErrorCode) {
    show(describeError(result.automaticPairingErrorCode));
    return;
  }
  show("扩展会自动连接 AGENT；首次被 Chrome 阻止时，请点击“自动连接”并允许本地网络访问。");
});
