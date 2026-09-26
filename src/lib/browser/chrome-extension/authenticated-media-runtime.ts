import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";
import type { AuthenticatedMediaValue } from "./authenticated-media-value.js";

const AUTHENTICATED_MEDIA_SOURCE_WAIT_MS = 5_000;

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown> : null;

const sha256Text = async (value: string): Promise<`sha256:${string}`> => {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return `sha256:${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
};

const mediaSourceDiscoveryExpression = (canonicalConversationUrl: string, userTurnId: string): string => `
    const inspectSources = () => {
      const observedUrl = new URL(location.href);
      const currentUrl = observedUrl.origin + observedUrl.pathname;
      if (currentUrl !== ${JSON.stringify(canonicalConversationUrl)})
        return { errorCode: "BROWSER_AUTHENTICATED_MEDIA_WRONG_DOCUMENT" };
      const turns = [...document.querySelectorAll("[data-turn-key]")];
      const users = turns.filter((turn) => turn.getAttribute("data-turn-key") === ${JSON.stringify(userTurnId)});
      if (users.length === 0) return { pendingCode: "BROWSER_AUTHENTICATED_MEDIA_USER_TURN_ABSENT" };
      if (users.length !== 1) return { errorCode: "BROWSER_AUTHENTICATED_MEDIA_USER_TURN_MULTIPLE" };
      const userUnits = users[0].querySelectorAll("[data-chatgpt-search-unit-key$=':user']");
      if (userUnits.length !== 1
        || userUnits[0].getAttribute("data-chatgpt-search-message-ids") !== ${JSON.stringify(userTurnId)})
        return { errorCode: "BROWSER_AUTHENTICATED_MEDIA_USER_TURN_MULTIPLE" };
      const sourceOwners = new Map();
      for (const turn of turns.slice(turns.indexOf(users[0]))) {
        if (turn !== users[0] && turn.querySelectorAll("[data-chatgpt-search-unit-key$=':user']").length > 0) break;
        for (const image of turn.querySelectorAll("img")) {
          if (image.closest("[data-chatgpt-search-unit-key$=':user']")) continue;
          const assistantTurnId = image.closest("[data-chatgpt-search-message-ids]")
            ?.getAttribute("data-chatgpt-search-message-ids") || "";
          if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(assistantTurnId)) continue;
          const source = image.currentSrc || image.src || "";
          if (source && !sourceOwners.has(source)) sourceOwners.set(source, assistantTurnId);
        }
      }
      return sourceOwners.size > 0 ? { currentUrl, sourceOwners }
        : { pendingCode: "BROWSER_AUTHENTICATED_MEDIA_IMAGE_SOURCE_ABSENT" };
    };
    const terminal = (value) => value.errorCode || value.sourceOwners;
    let discovered = inspectSources();
    if (!terminal(discovered)) discovered = await new Promise((resolve) => {
      let settled = false, timeout = 0, observer;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        observer.disconnect(); clearTimeout(timeout); resolve(value);
      };
      observer = new MutationObserver(() => {
        const value = inspectSources();
        if (terminal(value)) finish(value);
      });
      observer.observe(document.documentElement, {
        attributes: true, attributeFilter: ["src", "srcset"], childList: true, subtree: true,
      });
      const value = inspectSources();
      if (terminal(value)) finish(value);
      else timeout = setTimeout(() => finish(inspectSources()), ${AUTHENTICATED_MEDIA_SOURCE_WAIT_MS});
    });
`;

const authenticatedMediaExpression = (canonicalConversationUrl: string, userTurnId: string): string => `
  (async () => {
    ${mediaSourceDiscoveryExpression(canonicalConversationUrl, userTurnId)}
    if (discovered.errorCode) return { errorCode: discovered.errorCode };
    if (!discovered.sourceOwners) return { errorCode: discovered.pendingCode };
    const { currentUrl, sourceOwners } = discovered;
    const mediaByHash = new Map();
    try {
      for (const [source, assistantTurnId] of sourceOwners.entries()) {
        const response = await fetch(source, { credentials: "include", redirect: "follow" });
        if (!response.ok) return { errorCode: "BROWSER_AUTHENTICATED_MEDIA_FETCH_REJECTED" };
        const blob = await response.blob();
        if (!blob.type.startsWith("image/")) return { errorCode: "BROWSER_AUTHENTICATED_MEDIA_TYPE_INVALID" };
        if (blob.size < 1) return { errorCode: "BROWSER_AUTHENTICATED_MEDIA_BYTES_EMPTY" };
        if (blob.size > 25 * 1024 * 1024)
          return { errorCode: "BROWSER_AUTHENTICATED_MEDIA_BYTES_TOO_LARGE" };
        const buffer = await blob.arrayBuffer();
        const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", buffer))]
          .map((value) => value.toString(16).padStart(2, "0")).join("");
        if (!mediaByHash.has(digest)) mediaByHash.set(digest, { buffer, mediaType: blob.type, assistantTurnId });
      }
    } catch { return { errorCode: "BROWSER_AUTHENTICATED_MEDIA_FETCH_FAILED" }; }
    if (mediaByHash.size !== 1) return { errorCode: "BROWSER_AUTHENTICATED_MEDIA_CONTENT_MULTIPLE" };
    const [digest, media] = [...mediaByHash.entries()][0];
    const bytes = new Uint8Array(media.buffer); let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
    return {
      bytesBase64: btoa(binary), sha256: "sha256:" + digest, sizeBytes: bytes.byteLength,
      mediaType: media.mediaType, assistantTurnId: media.assistantTurnId,
      precedingUserTurnId: ${JSON.stringify(userTurnId)}, currentUrl,
    };
  })()
`;

export const executeAuthenticatedMedia = async (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  canonicalConversationUrl: string,
  userTurnId: string,
  semanticMediaId: "gpt-generated-image-main",
  assertCurrent: () => void,
): Promise<AuthenticatedMediaValue> => {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(userTurnId)
    || semanticMediaId !== "gpt-generated-image-main") throw new Error("BROWSER_TARGET_INVALID");
  assertCurrent();
  const evaluated = record(await runtime.send(target.tabId, "Runtime.evaluate", {
    expression: authenticatedMediaExpression(canonicalConversationUrl, userTurnId),
    awaitPromise: true, returnByValue: true, userGesture: false,
  }));
  assertCurrent();
  if (evaluated?.exceptionDetails) throw new Error("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
  const value = record(record(evaluated?.result)?.value);
  const errorCode = value?.errorCode;
  if (typeof errorCode === "string" && /^BROWSER_AUTHENTICATED_MEDIA_[A-Z_]+$/u.test(errorCode)) {
    throw new Error(errorCode);
  }
  const media: Record<string, unknown> = {
    ...(value ?? {}),
    authorityTargetHash: await sha256Text(target.targetRef),
    authorityDocumentHash: await sha256Text(target.documentRef),
    semanticMediaId,
  };
  if (!validMediaAuthority(media) || !validMediaPayload(media) || !validMediaTurns(media)) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  return media as AuthenticatedMediaValue;
};

const validMediaAuthority = (media: Record<string, unknown>): boolean =>
  typeof media.authorityTargetHash === "string"
  && typeof media.authorityDocumentHash === "string"
  && typeof media.currentUrl === "string";

const validMediaPayload = (media: Record<string, unknown>): boolean =>
  typeof media.bytesBase64 === "string"
  && typeof media.sha256 === "string" && /^sha256:[a-f0-9]{64}$/u.test(media.sha256)
  && typeof media.sizeBytes === "number" && Number.isSafeInteger(media.sizeBytes)
  && media.sizeBytes >= 1 && media.sizeBytes <= 25 * 1024 * 1024
  && typeof media.mediaType === "string" && /^image\/[a-z0-9.+-]+$/u.test(media.mediaType);

const validMediaTurns = (media: Record<string, unknown>): boolean =>
  typeof media.assistantTurnId === "string"
  && typeof media.precedingUserTurnId === "string"
  && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(media.assistantTurnId)
  && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(media.precedingUserTurnId);
