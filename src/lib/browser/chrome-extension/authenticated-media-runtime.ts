import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";
import type { AuthenticatedMediaValue } from "./authenticated-media-value.js";

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown> : null;

const sha256Text = async (value: string): Promise<`sha256:${string}`> => {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return `sha256:${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
};

const authenticatedMediaExpression = (canonicalConversationUrl: string, userTurnId: string): string => `
  (async () => {
    const observedUrl = new URL(location.href);
    const currentUrl = observedUrl.origin + observedUrl.pathname;
    if (currentUrl !== ${JSON.stringify(canonicalConversationUrl)}) {
      return { errorCode: "BROWSER_AUTHENTICATED_MEDIA_WRONG_DOCUMENT" };
    }
    const turns = [...document.querySelectorAll("[data-testid^='conversation-turn-']")];
    const users = turns.filter((turn) => turn.getAttribute("data-testid") === ${JSON.stringify(userTurnId)}
      && turn.querySelectorAll("[data-message-author-role='user']").length === 1);
    if (users.length === 0) return { errorCode: "BROWSER_AUTHENTICATED_MEDIA_USER_TURN_ABSENT" };
    if (users.length !== 1) return { errorCode: "BROWSER_AUTHENTICATED_MEDIA_USER_TURN_MULTIPLE" };
    const sourceOwners = new Map();
    for (const turn of turns.slice(turns.indexOf(users[0]) + 1)) {
      if (turn.querySelectorAll("[data-message-author-role='user']").length > 0) break;
      const assistantTurnId = turn.getAttribute("data-testid") || "";
      if (!/^conversation-turn-[1-9][0-9]*$/.test(assistantTurnId)) continue;
      for (const image of turn.querySelectorAll("img")) {
        const source = image.currentSrc || image.src || "";
        if (source && !sourceOwners.has(source)) sourceOwners.set(source, assistantTurnId);
      }
    }
    if (sourceOwners.size === 0) return { errorCode: "BROWSER_AUTHENTICATED_MEDIA_IMAGE_SOURCE_ABSENT" };
    const mediaByHash = new Map();
    try {
      for (const [source, assistantTurnId] of sourceOwners.entries()) {
        const response = await fetch(source, { credentials: "include", redirect: "follow" });
        if (!response.ok) return { errorCode: "BROWSER_AUTHENTICATED_MEDIA_FETCH_REJECTED" };
        const blob = await response.blob();
        if (!blob.type.startsWith("image/")) {
          return { errorCode: "BROWSER_AUTHENTICATED_MEDIA_TYPE_INVALID" };
        }
        if (blob.size < 1) return { errorCode: "BROWSER_AUTHENTICATED_MEDIA_BYTES_EMPTY" };
        if (blob.size > 25 * 1024 * 1024) {
          return { errorCode: "BROWSER_AUTHENTICATED_MEDIA_BYTES_TOO_LARGE" };
        }
        const buffer = await blob.arrayBuffer();
        const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", buffer))]
          .map((value) => value.toString(16).padStart(2, "0")).join("");
        if (!mediaByHash.has(digest)) {
          mediaByHash.set(digest, { buffer, mediaType: blob.type, assistantTurnId });
        }
      }
    } catch {
      return { errorCode: "BROWSER_AUTHENTICATED_MEDIA_FETCH_FAILED" };
    }
    if (mediaByHash.size !== 1) {
      return { errorCode: "BROWSER_AUTHENTICATED_MEDIA_CONTENT_MULTIPLE" };
    }
    const [digest, media] = [...mediaByHash.entries()][0];
    const bytes = new Uint8Array(media.buffer);
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
    }
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
  if (!/^conversation-turn-[1-9][0-9]*$/u.test(userTurnId)
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
  if (typeof media.authorityTargetHash !== "string" || typeof media.authorityDocumentHash !== "string"
    || typeof media.assistantTurnId !== "string" || typeof media.precedingUserTurnId !== "string"
    || typeof media.currentUrl !== "string" || typeof media.bytesBase64 !== "string"
    || typeof media.sha256 !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(media.sha256)
    || typeof media.sizeBytes !== "number" || !Number.isSafeInteger(media.sizeBytes)
    || media.sizeBytes < 1 || media.sizeBytes > 25 * 1024 * 1024
    || typeof media.mediaType !== "string" || !/^image\/[a-z0-9.+-]+$/u.test(media.mediaType)
    || !/^conversation-turn-[1-9][0-9]*$/u.test(media.assistantTurnId)
    || !/^conversation-turn-[1-9][0-9]*$/u.test(media.precedingUserTurnId)) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  return media as AuthenticatedMediaValue;
};
