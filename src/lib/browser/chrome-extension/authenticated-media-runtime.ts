import { parseAuthenticatedMediaValue, type AuthenticatedMediaValue } from "./authenticated-media-value.js";
import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown> : null;

const sha256Text = async (value: string): Promise<`sha256:${string}`> => {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return `sha256:${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
};

const authenticatedMediaExpression = (assistantTurnId: string): string => `
    (async () => {
      const turns = [...document.querySelectorAll(${JSON.stringify(`[data-testid=${JSON.stringify(assistantTurnId)}]:not(:has([data-message-author-role='user']))`)})];
      if (turns.length === 0) return { errorCode: "BROWSER_AUTHENTICATED_MEDIA_ABSENT" };
      if (turns.length !== 1) return { errorCode: "BROWSER_AUTHENTICATED_MEDIA_MULTIPLE" };
      const turn = turns[0];
      if (!(turn instanceof HTMLElement) || !turn.isConnected) {
        return { errorCode: "BROWSER_AUTHENTICATED_MEDIA_ABSENT" };
      }
      const candidates = [...turn.querySelectorAll("img[alt]")].filter((node) => {
        if (!(node instanceof HTMLImageElement) || !node.isConnected || !node.complete) return false;
        const bounds = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return node.alt.trim().length > 0 && node.naturalWidth > 0 && node.naturalHeight > 0
          && bounds.width > 0 && bounds.height > 0 && style.display !== "none"
          && style.visibility !== "hidden" && style.visibility !== "collapse"
          && Number.parseFloat(style.opacity || "1") > 0;
      });
      const sources = new Map();
      for (const candidate of candidates) {
        const source = candidate.currentSrc || candidate.src;
        if (source && !sources.has(source)) sources.set(source, candidate);
      }
      if (sources.size === 0) return { errorCode: "BROWSER_AUTHENTICATED_MEDIA_ABSENT" };
      const mediaByHash = new Map();
      try {
        for (const [source, image] of sources) {
          const response = await fetch(source, { credentials: "include", redirect: "follow" });
          if (!response.ok) return { errorCode: "BROWSER_AUTHENTICATED_MEDIA_FETCH_FAILED" };
          const blob = await response.blob();
          if (!blob.type.startsWith("image/") || blob.size < 1 || blob.size > 25 * 1024 * 1024) {
            return { errorCode: "BROWSER_AUTHENTICATED_MEDIA_BYTES_INVALID" };
          }
          const buffer = await blob.arrayBuffer();
          const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", buffer))]
            .map((value) => value.toString(16).padStart(2, "0")).join("");
          if (!mediaByHash.has(digest)) mediaByHash.set(digest, {
            buffer, mediaType: blob.type, width: image.naturalWidth, height: image.naturalHeight,
          });
        }
      } catch {
        return { errorCode: "BROWSER_AUTHENTICATED_MEDIA_FETCH_FAILED" };
      }
      if (mediaByHash.size !== 1) return { errorCode: "BROWSER_AUTHENTICATED_MEDIA_MULTIPLE" };
      const [digest, media] = [...mediaByHash.entries()][0];
      const bytes = new Uint8Array(media.buffer);
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
      }
      return {
        bytesBase64: btoa(binary), sha256: "sha256:" + digest, sizeBytes: bytes.byteLength,
        mediaType: media.mediaType, width: media.width, height: media.height,
      };
    })()
  `;

export const executeAuthenticatedMedia = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  assistantTurnId: string,
  semanticMediaId: "gpt-generated-image-main",
): Promise<AuthenticatedMediaValue> => {
  if (!/^conversation-turn-[1-9][0-9]*$/u.test(assistantTurnId)
    || semanticMediaId !== "gpt-generated-image-main") {
    throw new Error("BROWSER_TARGET_INVALID");
  }
  const expression = authenticatedMediaExpression(assistantTurnId);
  const evaluated = record(await debuggerRuntime.send(target.tabId, "Runtime.evaluate", {
    expression, awaitPromise: true, returnByValue: true, userGesture: false,
  }));
  if (evaluated?.exceptionDetails) throw new Error("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
  const result = record(evaluated?.result);
  const value = record(result?.value);
  const errorCode = value?.errorCode;
  if (typeof errorCode === "string" && /^BROWSER_AUTHENTICATED_MEDIA_[A-Z_]+$/u.test(errorCode)) {
    throw new Error(errorCode);
  }
  return parseAuthenticatedMediaValue({
    ...value,
    authorityTargetHash: await sha256Text(target.targetRef),
    authorityDocumentHash: await sha256Text(target.documentRef),
    assistantTurnId,
    semanticMediaId,
  });
};
