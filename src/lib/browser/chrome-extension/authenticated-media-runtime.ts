import type { BrowserMutationProgress } from "../exact-target/browser-mutation-store.js";
import { parseAuthenticatedMediaValue, type AuthenticatedMediaValue } from "./authenticated-media-value.js";
import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import { executeRegisteredDomIntent } from "./dom-intent-runtime.js";
import { executeRequiredCompoundClick } from "./dom-pointer-intent-runtime.js";
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
        const alt = node.alt;
        return alt.length > 0 && alt.trim() === alt && alt.normalize("NFC") === alt
          && node.naturalWidth > 0 && node.naturalHeight > 0
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
          const existing = mediaByHash.get(digest);
          if (existing) existing.images.push(image);
          else mediaByHash.set(digest, {
            buffer, mediaType: blob.type, width: image.naturalWidth, height: image.naturalHeight,
            images: [image],
          });
        }
      } catch {
        return { errorCode: "BROWSER_AUTHENTICATED_MEDIA_FETCH_FAILED" };
      }
      if (mediaByHash.size !== 1) return { errorCode: "BROWSER_AUTHENTICATED_MEDIA_MULTIPLE" };
      const [digest, media] = [...mediaByHash.entries()][0];
      const controls = new Set(media.images.map((image) => typeof image.closest === "function"
        ? image.closest("div[role='button']") : null).filter((node) => node
          && (typeof turn.contains !== "function" || turn.contains(node))));
      const control = controls.size === 1 ? [...controls][0] : null;
      const semanticAlts = new Set(media.images.filter((image) => control
        && (typeof control.contains !== "function" || control.contains(image)))
        .map((image) => image.alt).filter((alt) => alt.length > 0 && alt.length <= 512
          && !/[\\u0000-\\u001f]/u.test(alt)));
      const bytes = new Uint8Array(media.buffer);
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
      }
      return {
        bytesBase64: btoa(binary), sha256: "sha256:" + digest, sizeBytes: bytes.byteLength,
        mediaType: media.mediaType, width: media.width, height: media.height,
        interactiveControlCount: controls.size > 1 ? 2 : controls.size,
        semanticAlt: semanticAlts.size === 1 ? [...semanticAlts][0] : null,
      };
    })()
  `;

type LocatedMedia = Readonly<{
  media: AuthenticatedMediaValue;
  interactiveControlCount: 0 | 1 | 2;
  semanticAlt: string | null;
}>;

const readLocatedMedia = async (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  assistantTurnId: string,
  semanticMediaId: "gpt-generated-image-main",
): Promise<LocatedMedia> => {
  const evaluated = record(await runtime.send(target.tabId, "Runtime.evaluate", {
    expression: authenticatedMediaExpression(assistantTurnId),
    awaitPromise: true, returnByValue: true, userGesture: false,
  }));
  if (evaluated?.exceptionDetails) throw new Error("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
  const value = record(record(evaluated?.result)?.value);
  const errorCode = value?.errorCode;
  if (typeof errorCode === "string" && /^BROWSER_AUTHENTICATED_MEDIA_[A-Z_]+$/u.test(errorCode)) {
    throw new Error(errorCode);
  }
  const interactiveControlCount = value?.interactiveControlCount;
  const semanticAlt = value?.semanticAlt;
  if ((interactiveControlCount !== 0 && interactiveControlCount !== 1 && interactiveControlCount !== 2)
    || (semanticAlt !== null && typeof semanticAlt !== "string")) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  return Object.freeze({
    media: parseAuthenticatedMediaValue({ ...value,
      authorityTargetHash: await sha256Text(target.targetRef),
      authorityDocumentHash: await sha256Text(target.documentRef),
      assistantTurnId, semanticMediaId,
    }),
    interactiveControlCount, semanticAlt,
  });
};

const cssAttributeString = (value: string): string =>
  `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;

export const generatedImageViewerLabel = (semanticAlt: string): string | null => {
  const prefix = "已生成图片：";
  if (!semanticAlt.startsWith(prefix) || semanticAlt !== semanticAlt.normalize("NFC")) return null;
  const label = semanticAlt.slice(prefix.length);
  return label.length > 0 && label.trim() === label ? label : null;
};

const zeroMutationFailure = (count: number, code: string): Readonly<Record<string, unknown>> =>
  Object.freeze({
    candidateCount: count, qualificationStage: "candidate-set", identityRevalidated: false,
    mutationCount: 0, postconditionVerified: false, qualificationRejected: true,
    failureCode: code, nativeCauseCode: null,
  });

const dispatchedFailure = (
  mutationCount: 1 | 2,
  code: string,
  downloadGuidHash: `sha256:${string}` | null = null,
): Readonly<Record<string, unknown>> => Object.freeze({
  imageOpened: true, saveClicked: mutationCount === 2, candidateCount: 1,
  identityRevalidated: false, mutationCount, postconditionVerified: false,
  downloadGuidHash, downloadCompleted: false, downloadedSizeBytes: 0,
  failureCode: "BROWSER_POSTCONDITION_FAILED", nativeCauseCode: code,
});

const requireSuccessfulClick = (value: unknown): void => {
  const result = record(value);
  if (result?.clicked === true && result.mutationCount === 1) return;
  const code = typeof result?.failureCode === "string"
    ? result.failureCode : "BROWSER_DOM_READ_INVALID";
  throw new Error(code);
};

const executeVisibleDownload = async (input: Readonly<{
  runtime: ExtensionDebuggerRuntime;
  target: ExtensionExactTarget;
  located: LocatedMedia;
  assistantTurnId: string;
  assertCurrent: () => void;
  onProgress: (progress: BrowserMutationProgress) => Promise<void>;
}>): Promise<AuthenticatedMediaValue | Readonly<Record<string, unknown>>> => {
  const { runtime, target, located, assistantTurnId, assertCurrent, onProgress } = input;
  if (located.interactiveControlCount !== 1 || located.semanticAlt === null) {
    return zeroMutationFailure(located.interactiveControlCount,
      located.interactiveControlCount > 1
        ? "BROWSER_AUTHENTICATED_MEDIA_CONTROL_MULTIPLE"
        : "BROWSER_AUTHENTICATED_MEDIA_CONTROL_MISSING");
  }
  const viewerLabel = generatedImageViewerLabel(located.semanticAlt);
  if (viewerLabel === null) {
    return Object.freeze({
      candidateCount: 1, qualificationStage: "candidate-set", identityRevalidated: false,
      mutationCount: 0, postconditionVerified: false, qualificationRejected: true,
      failureCode: "BROWSER_AUTHENTICATED_MEDIA_ALT_INVALID", nativeCauseCode: null,
    });
  }
  const turnSelector = `[data-testid='${assistantTurnId}']:not(:has([data-message-author-role='user']))`;
  const alt = cssAttributeString(located.semanticAlt);
  const imageClick = await executeRequiredCompoundClick(runtime, target, {
    kind: "click", selector: `div[role='button']:has(img[alt=${alt}])`, scope: { selector: turnSelector },
  }, assertCurrent);
  if (record(imageClick)?.clicked !== true) return zeroMutationFailure(
    Number(record(imageClick)?.candidateCount ?? 0),
    String(record(imageClick)?.failureCode ?? "BROWSER_DOM_CANDIDATE_MISSING"),
  );
  await onProgress({ physicalInputCount: 1, downloadGuidHash: null,
    downloadCompleted: false, identityRevalidated: false });
  const viewerSelector = `[role='dialog'][aria-label=${cssAttributeString(viewerLabel)}]`;
  const viewer = record(await executeRegisteredDomIntent(runtime, target, {
    kind: "find", selector: viewerSelector, maxMatches: 1,
    waitFor: { minimumMatches: 1, timeoutMs: 10_000 }, fields: ["ariaLabel"],
  }, assertCurrent));
  if (viewer?.count !== 1) return dispatchedFailure(1, "BROWSER_AUTHENTICATED_MEDIA_VIEWER_MISMATCH");
  let downloadGuidHash: `sha256:${string}` | null = null;
  const completed = await runtime.captureCompletedDownload(
    target.tabId, located.media.sizeBytes, 20_000,
    async () => {
      requireSuccessfulClick(await executeRequiredCompoundClick(runtime, target, {
        kind: "click", selector: "button[aria-label='保存']", scope: { selector: viewerSelector },
      }, assertCurrent));
      await onProgress({ physicalInputCount: 2, downloadGuidHash: null,
        downloadCompleted: false, identityRevalidated: false });
    },
    async ({ guid }) => {
      downloadGuidHash = await sha256Text(guid);
      await onProgress({ physicalInputCount: 2, downloadGuidHash,
        downloadCompleted: false, identityRevalidated: false });
    },
  );
  if (downloadGuidHash === null) throw new Error("BROWSER_DOWNLOAD_IDENTITY_MISMATCH");
  await onProgress({ physicalInputCount: 2, downloadGuidHash,
    downloadCompleted: true, identityRevalidated: false });
  assertCurrent();
  const after = await readLocatedMedia(runtime, target, assistantTurnId, "gpt-generated-image-main");
  if (after.media.sha256 !== located.media.sha256 || after.media.sizeBytes !== completed.totalBytes) {
    return dispatchedFailure(2, "BROWSER_AUTHENTICATED_MEDIA_IDENTITY_DRIFT", downloadGuidHash);
  }
  await onProgress({ physicalInputCount: 2, downloadGuidHash,
    downloadCompleted: true, identityRevalidated: true });
  return Object.freeze({ ...after.media,
    imageOpened: true, saveClicked: true, candidateCount: 1, identityRevalidated: true,
    mutationCount: 2, postconditionVerified: true, downloadGuidHash,
    downloadCompleted: true, downloadedSizeBytes: completed.totalBytes,
  });
};

export const executeAuthenticatedMedia = async (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  assistantTurnId: string,
  semanticMediaId: "gpt-generated-image-main",
  delivery: "probe" | "visible-download",
  assertCurrent: () => void,
  onProgress: (progress: BrowserMutationProgress) => Promise<void>,
): Promise<AuthenticatedMediaValue | Readonly<Record<string, unknown>>> => {
  if (!/^conversation-turn-[1-9][0-9]*$/u.test(assistantTurnId)
    || semanticMediaId !== "gpt-generated-image-main"
    || (delivery !== "probe" && delivery !== "visible-download")) throw new Error("BROWSER_TARGET_INVALID");
  let located: LocatedMedia;
  try { located = await readLocatedMedia(runtime, target, assistantTurnId, semanticMediaId); }
  catch (error) {
    const code = error instanceof Error ? error.message : "BROWSER_AUTHENTICATED_MEDIA_FETCH_FAILED";
    if (!/^BROWSER_AUTHENTICATED_MEDIA_[A-Z_]+$/u.test(code)) throw error;
    return delivery === "probe" ? Promise.reject(error)
      : zeroMutationFailure(code.endsWith("_MULTIPLE") ? 2 : 0, code);
  }
  return delivery === "probe" ? located.media : executeVisibleDownload({
    runtime, target, located, assistantTurnId, assertCurrent, onProgress,
  });
};
