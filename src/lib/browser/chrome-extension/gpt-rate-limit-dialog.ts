import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";

export const KNOWN_GPT_RATE_LIMIT_FAILURE = "BROWSER_KNOWN_GPT_RATE_LIMIT";
export const KNOWN_GPT_RATE_LIMIT_DIALOG_SELECTOR = "[role='dialog']";
export const KNOWN_GPT_RATE_LIMIT_ACK_SELECTOR = "[role='dialog'] button";
export const KNOWN_GPT_RATE_LIMIT_TITLE = "请求过于频繁";
export const KNOWN_GPT_RATE_LIMIT_BODY = Object.freeze([
  "你的请求过于频繁。为保障数据安全，我们已暂时限制你访问对话记录。",
  "请稍等几分钟后再重试。",
]);
export const KNOWN_GPT_RATE_LIMIT_ACK = "明白了";

export const KNOWN_GPT_RATE_LIMIT_DIALOG_HASH =
  "sha256:084b621b91e3affcf2199269157febb07ded1b7a3287ac61104108317cddde15";

export type KnownGptRateLimitDialogFact = Readonly<{
  schemaVersion: "grasseye.browser.known-gpt-rate-limit-dialog.v1";
  state: "exact_present";
  dialogHash: `sha256:${string}`;
  targetRefHash: `sha256:${string}`;
  documentRefHash: `sha256:${string}`;
  observationHash: `sha256:${string}`;
  observedAt: string;
}>;

export type KnownGptRateLimitClearanceFact = Readonly<{
  schemaVersion: "grasseye.browser.known-gpt-rate-limit-clearance.v1";
  state: "confirmed_absent";
  dialogHash: `sha256:${string}`;
  targetRefHash: `sha256:${string}`;
  documentRefHash: `sha256:${string}`;
  observationHash: `sha256:${string}`;
  observedAt: string;
  candidateCount: 0;
  identityRevalidated: true;
  mutationCount: 0;
  postconditionVerified: true;
  zeroActionSatisfied: true;
}>;

const DETECTOR = `async function (expected) {
  const visible = (node) => {
    if (!(node instanceof Element) || !node.isConnected || node.hidden
      || node.getAttribute("aria-hidden") === "true" || node.closest("[inert]")) return false;
    const style = getComputedStyle(node);
    return style.display !== "none" && style.visibility !== "hidden"
      && Number(style.opacity || "1") > 0 && node.getClientRects().length > 0;
  };
  const canonical = (value) => String(value || "").normalize("NFC")
    .replace(/\\s+/gu, " ").trim();
  const dialogs = Array.from(document.querySelectorAll(expected.dialogSelector)).filter(visible);
  if (dialogs.length === 0) return { state: "absent" };
  const exact = dialogs.filter((dialog) => {
    const text = canonical(dialog.textContent);
    const buttons = Array.from(dialog.querySelectorAll("button")).filter(visible);
    return text === canonical([expected.title, ...expected.body, expected.ack].join(" "))
      && buttons.length === 1 && canonical(buttons[0].textContent) === expected.ack
      && !buttons[0].disabled && buttons[0].getAttribute("aria-disabled") !== "true";
  });
  if (exact.length !== 1 || dialogs.length !== 1) return { state: "unknown_present" };
  const observedAt = new Date().toISOString();
  return { state: "exact_present", observedAt };
}`;

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("BROWSER_DOM_READ_INVALID");
  }
  return value as Record<string, unknown>;
};

const sha256 = async (value: string): Promise<`sha256:${string}`> => {
  const result = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return `sha256:${Array.from(new Uint8Array(result))
    .map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
};

export const knownGptRateLimitTargetIdentity = async (
  target: ExtensionExactTarget,
): Promise<Readonly<{
  targetRefHash: `sha256:${string}`;
  documentRefHash: `sha256:${string}`;
}>> => Object.freeze({
  targetRefHash: await sha256(target.targetRef),
  documentRefHash: await sha256(target.documentRef),
});

export const observeKnownGptRateLimitDialog = async (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
): Promise<KnownGptRateLimitDialogFact | null> => {
  const document = record(await runtime.send(target.tabId, "DOM.getDocument", { depth: 0, pierce: true }));
  const root = record(document.root);
  if (!Number.isSafeInteger(root.nodeId)) throw new Error("BROWSER_DOM_READ_INVALID");
  const resolved = record(await runtime.send(target.tabId, "DOM.resolveNode", { nodeId: root.nodeId }));
  const objectId = record(resolved.object).objectId;
  if (typeof objectId !== "string" || !objectId) throw new Error("BROWSER_DOM_READ_INVALID");
  try {
    const call = record(await runtime.send(target.tabId, "Runtime.callFunctionOn", {
      objectId,
      functionDeclaration: DETECTOR,
      arguments: [{ value: {
        dialogSelector: KNOWN_GPT_RATE_LIMIT_DIALOG_SELECTOR,
        title: KNOWN_GPT_RATE_LIMIT_TITLE,
        body: KNOWN_GPT_RATE_LIMIT_BODY,
        ack: KNOWN_GPT_RATE_LIMIT_ACK,
        dialogHash: KNOWN_GPT_RATE_LIMIT_DIALOG_HASH,
      } }],
      returnByValue: true,
      awaitPromise: true,
      silent: true,
    }));
    const result = record(record(call.result).value);
    if (result.state === "absent") return null;
    if (result.state !== "exact_present") throw new Error("BROWSER_GPT_DIALOG_UNRECOGNIZED");
    if (typeof result.observedAt !== "string" || !Number.isFinite(Date.parse(result.observedAt))) {
      throw new Error("BROWSER_DOM_READ_INVALID");
    }
    const { targetRefHash, documentRefHash } = await knownGptRateLimitTargetIdentity(target);
    const observationHash = await sha256(JSON.stringify({
      dialogHash: KNOWN_GPT_RATE_LIMIT_DIALOG_HASH,
      targetRefHash,
      documentRefHash,
      observedAt: result.observedAt,
      title: KNOWN_GPT_RATE_LIMIT_TITLE,
      body: KNOWN_GPT_RATE_LIMIT_BODY,
      acknowledgement: KNOWN_GPT_RATE_LIMIT_ACK,
      dialogCount: 1,
      acknowledgementButtonCount: 1,
    }));
    return Object.freeze({
      schemaVersion: "grasseye.browser.known-gpt-rate-limit-dialog.v1",
      state: "exact_present",
      dialogHash: KNOWN_GPT_RATE_LIMIT_DIALOG_HASH,
      targetRefHash,
      documentRefHash,
      observationHash,
      observedAt: result.observedAt,
    });
  } finally {
    await runtime.send(target.tabId, "Runtime.releaseObject", { objectId }).catch(() => undefined);
  }
};

export const readKnownGptRateLimitClearance = async (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
): Promise<KnownGptRateLimitClearanceFact> => {
  if (await observeKnownGptRateLimitDialog(runtime, target)) {
    throw new Error("BROWSER_GPT_RATE_LIMIT_STILL_PRESENT");
  }
  const observedAt = new Date().toISOString();
  const { targetRefHash, documentRefHash } = await knownGptRateLimitTargetIdentity(target);
  const observationHash = await sha256(JSON.stringify({
    dialogHash: KNOWN_GPT_RATE_LIMIT_DIALOG_HASH,
    targetRefHash,
    documentRefHash,
    observedAt,
    state: "confirmed_absent",
    dialogCount: 0,
  }));
  return Object.freeze({
    schemaVersion: "grasseye.browser.known-gpt-rate-limit-clearance.v1",
    state: "confirmed_absent",
    dialogHash: KNOWN_GPT_RATE_LIMIT_DIALOG_HASH,
    targetRefHash,
    documentRefHash,
    observationHash,
    observedAt,
    candidateCount: 0,
    identityRevalidated: true,
    mutationCount: 0,
    postconditionVerified: true,
    zeroActionSatisfied: true,
  });
};

export const knownGptRateLimitBlockerReceipt = (
  fact: KnownGptRateLimitDialogFact,
): Readonly<Record<string, unknown>> => Object.freeze({
  schemaVersion: "grasseye.browser.known-gpt-rate-limit-blocker.v1",
  failureCode: KNOWN_GPT_RATE_LIMIT_FAILURE,
  nativeCauseCode: null,
  candidateCount: 1,
  identityRevalidated: true,
  mutationCount: 0,
  physicalInputCount: 0,
  postconditionVerified: false,
  qualificationRejected: true,
  qualificationStage: "candidate-set",
  knownGptRateLimitDialogFact: fact,
});
