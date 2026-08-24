type PairingResponse = Readonly<{ ok: boolean; errorCode?: string; authenticated?: boolean }>;

declare const chrome: {
  runtime: Readonly<{
    sendMessage(message: unknown): Promise<PairingResponse>;
  }>;
};

const input = document.querySelector<HTMLInputElement>("#pairing-secret");
const pair = document.querySelector<HTMLButtonElement>("#pair");
const claim = document.querySelector<HTMLButtonElement>("#claim");

const show = (message: string): void => {
  const status = document.querySelector<HTMLElement>("#status");
  if (status) status.textContent = message;
};

const describeError = (code: string | undefined): string => ({
  BROWSER_AUTHENTICATION_INCOMPLETE: "浏览器认证尚未完成，请确认 Workbench 正在运行并使用当前密钥。",
  BROWSER_AUTH_TRANSCRIPT_INVALID: "配对密钥不匹配、已失效或认证报文无效。请回到 Workbench 重新复制当前密钥。",
  BROWSER_EXTENSION_CHANNEL_UNAVAILABLE: "无法连接本地 Workbench。请先运行 npm run grasseye:start。",
  BROWSER_LIVENESS_EXPIRED: "浏览器授权已失效，请重新配对。",
  BROWSER_PAIRING_IN_PROGRESS: "配对正在进行，请稍候。",
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

pair?.addEventListener("click", () => {
  const pairingSecret = input?.value.trim() ?? "";
  if (!/^[a-f0-9]{64}$/u.test(pairingSecret)) {
    show("BROWSER_PAIRING_SECRET_INVALID");
    return;
  }
  pair.disabled = true;
  show("正在认证固定扩展…");
  void send({ kind: "GRASSEYE_PAIRING_SECRET", pairingSecret }).then((result) => {
    pair.disabled = false;
    if (!result.ok) {
      show(describeError(result.errorCode));
      return;
    }
    if (claim) claim.disabled = false;
    show("认证完成。现在可以认领当前 HTTPS 标签页。");
    if (input) input.value = "";
  });
});

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
  show("请先在 GrassEye Workbench 点击“浏览器配对”复制当前一次性密钥。");
});
