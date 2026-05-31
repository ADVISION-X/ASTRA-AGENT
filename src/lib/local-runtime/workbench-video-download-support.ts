import {
  createVideoDownloadAbilityGroupFromFilesystem,
  probeTelegramWebVisibleMediaSourcePage,
  type BrowserMediaSourcePort,
  type TelegramWebVisibleMediaProbeResult,
  type TelegramWebVisibleVideoCandidate,
} from "../../capabilities/video-download/index.js";
import type { BrowserController } from "../browser/browser-controller.js";
import type { RuntimeLogger } from "../runtime-logs/index.js";
import { runAppleScript } from "../browser/current-chrome-window-control.js";

export type VideoDownloadSourcePagePlatform = "telegram-web";

export type VideoDownloadSourcePage = {
  platformId: VideoDownloadSourcePagePlatform;
  sourcePageUrl: string;
  pageTitle: string;
  videoCandidates: TelegramWebVisibleVideoCandidate[];
};

const allowedSourcePageProbeDescriptions = new Set([
  "collect Telegram Web visible media list",
  "collect Telegram Web cached video media bytes",
]);

const escapeAppleScriptText = (value: string): string =>
  value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');

const buildAsyncProbeScript = (script: string, description: string): { runId: string; script: string } => {
  const runId = `grasseye_video_download_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return {
    runId,
    script: `
(() => {
  const runId = ${JSON.stringify(runId)};
  window.__grasseyeVideoDownloadProbeResults = window.__grasseyeVideoDownloadProbeResults || {};
  window.__grasseyeVideoDownloadProbeResults[runId] = { status: "running", description: ${JSON.stringify(description)} };
  Promise.resolve()
    .then(() => eval(${JSON.stringify(script)}))
    .then((value) => {
      window.__grasseyeVideoDownloadProbeResults[runId] = { status: "done", value };
    })
    .catch((error) => {
      window.__grasseyeVideoDownloadProbeResults[runId] = { status: "error", error: String(error && error.stack || error) };
    });
  return runId;
})()
`,
  };
};

const ensureScriptAllowed = (description: string, script: string): void => {
  if (!allowedSourcePageProbeDescriptions.has(description) || script.length === 0) {
    throw new Error(`Video download page evaluation "${description}" is not an approved video-download source-page probe.`);
  }
};

const runChromeTabJavaScript = async (input: {
  windowSelector: string;
  tabSelector: string;
  script: string;
  abortSignal?: AbortSignal;
}): Promise<string> => runAppleScript(
    `tell application "Google Chrome"
  set targetWindow to ${input.windowSelector}
  execute ${input.tabSelector} of targetWindow javascript "${escapeAppleScriptText(input.script)}"
end tell`,
    input.abortSignal ? { signal: input.abortSignal } : undefined,
  );

const resolveChromeTabSelector = async (
  sourcePageUrl: string,
  abortSignal?: AbortSignal,
): Promise<{ windowSelector: string; tabSelector: string }> => {
  const source = new URL(sourcePageUrl);
  const result = await runAppleScript(
    `tell application "Google Chrome"
  repeat with wIndex from 1 to count of windows
    set w to window wIndex
    repeat with tIndex from 1 to count of tabs of w
      set u to URL of tab tIndex of w
      if u is ${JSON.stringify(sourcePageUrl)} then
        return (id of w as string) & "|" & (tIndex as string)
      end if
    end repeat
  end repeat
  repeat with wIndex from 1 to count of windows
    set w to window wIndex
    repeat with tIndex from 1 to count of tabs of w
      set u to URL of tab tIndex of w
      if u starts with ${JSON.stringify(`${source.origin}/`)} then
        return (id of w as string) & "|" & (tIndex as string)
      end if
    end repeat
  end repeat
end tell
return ""`,
    abortSignal ? { signal: abortSignal } : undefined,
  );
  const [windowId, tabIndex] = result.trim().split("|");
  if (!windowId || !tabIndex) {
    throw new Error(`No authorized Chrome tab matches ${source.origin}.`);
  }
  return {
    windowSelector: `first window whose id is ${windowId}`,
    tabSelector: `tab ${tabIndex}`,
  };
};

const waitForProbeResult = async <T>(input: {
  runId: string;
  windowSelector: string;
  tabSelector: string;
  timeoutMs: number;
  abortSignal?: AbortSignal;
}): Promise<T> => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < input.timeoutMs) {
    if (input.abortSignal?.aborted) {
      throw new Error("Video download page probe aborted.");
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    const raw = await runChromeTabJavaScript({
      windowSelector: input.windowSelector,
      tabSelector: input.tabSelector,
      script: `JSON.stringify((window.__grasseyeVideoDownloadProbeResults || {})[${JSON.stringify(input.runId)}] || { status: "missing" })`,
      ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
    });
    if (!raw.trim()) {
      continue;
    }
    const result = JSON.parse(raw) as {
      status: "done" | "error" | "missing" | "running";
      value?: T;
      error?: string;
    };
    if (result.status === "done") {
      return result.value as T;
    }
    if (result.status === "error") {
      throw new Error(result.error ?? "Video download page probe failed.");
    }
  }
  throw new Error("Timed out waiting for video download page probe.");
};

const evaluateChromePage = async <T>(input: {
  script: string;
  description: string;
  windowSelector: string;
  tabSelector: string;
  abortSignal?: AbortSignal;
}): Promise<T> => {
  ensureScriptAllowed(input.description, input.script);
  const probe = buildAsyncProbeScript(input.script, input.description);
  const started = await runChromeTabJavaScript({
    windowSelector: input.windowSelector,
    tabSelector: input.tabSelector,
    script: probe.script,
    ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
  });
  if (started.split(probe.runId).length < 2) {
    throw new Error(`Video download page probe did not start: ${started}`);
  }
  return waitForProbeResult<T>({
    runId: probe.runId,
    windowSelector: input.windowSelector,
    tabSelector: input.tabSelector,
    timeoutMs: 120_000,
    ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
  });
};

const createWorkbenchBrowserMediaSourcePort = (
  browserController: BrowserController,
): BrowserMediaSourcePort => ({
    evaluateActiveTab(input) {
      return browserController.evaluateActiveTab(input);
    },
    async evaluateSourcePage(input) {
      const target = await resolveChromeTabSelector(input.sourcePageUrl, input.abortSignal);
      return evaluateChromePage({
        script: input.script,
        description: input.description,
        windowSelector: target.windowSelector,
        tabSelector: target.tabSelector,
        ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
      });
    },
  });

export function createWorkbenchVideoDownload(
  dataDir: string,
  browserController: BrowserController,
  runtimeLogger?: RuntimeLogger,
) {
  return createVideoDownloadAbilityGroupFromFilesystem({
    browserMediaSourcePort: createWorkbenchBrowserMediaSourcePort(browserController),
    dataDir,
    ...(runtimeLogger ? { runtimeLogger } : {}),
  });
}

const resolveVideoDownloadSourceHost = (
  platformId: VideoDownloadSourcePagePlatform,
): string | null => platformId === "telegram-web" ? "web.telegram.org" : null;

const validatePreferredVideoDownloadSourceUrl = (
  host: string,
  preferredSourcePageUrl?: string,
): string | null | undefined => {
  if (!preferredSourcePageUrl) {
    return undefined;
  }
  try {
    const preferredUrl = new URL(preferredSourcePageUrl);
    return preferredUrl.hostname.toLowerCase() === host ? preferredSourcePageUrl : null;
  } catch {
    return null;
  }
};

const findChromeVideoDownloadSourcePage = async (input: {
  host: string;
  preferredSourcePageUrl?: string;
}): Promise<{ sourcePageUrl: string; pageTitle: string } | null> => {
  const raw = await runAppleScript(
    `tell application "Google Chrome"
  ${input.preferredSourcePageUrl ? `repeat with wIndex from 1 to count of windows
    set w to window wIndex
    repeat with tIndex from 1 to count of tabs of w
      set u to URL of tab tIndex of w
      if u is ${JSON.stringify(input.preferredSourcePageUrl)} then
        return u & linefeed & title of tab tIndex of w
      end if
    end repeat
  end repeat` : ""}
  ${input.preferredSourcePageUrl ? "return \"\"" : ""}
  repeat with wIndex from 1 to count of windows
    set w to window wIndex
    repeat with tIndex from 1 to count of tabs of w
      set u to URL of tab tIndex of w
      if u starts with "https://${input.host}/" then
        return u & linefeed & title of tab tIndex of w
      end if
    end repeat
  end repeat
end tell
return ""`,
  );
  const [sourcePageUrl, ...titleParts] = raw.trim().split("\n");
  if (!sourcePageUrl) {
    return null;
  }
  return {
    sourcePageUrl,
    pageTitle: titleParts.join("\n").trim(),
  };
};

const createSourcePageProbePort = (): BrowserMediaSourcePort => ({
  async evaluateActiveTab() {
    throw new Error("Video download source-page probe requires evaluateSourcePage.");
  },
  async evaluateSourcePage<T>(input: {
    sourcePageUrl: string;
    script: string;
    description: string;
    abortSignal?: AbortSignal;
  }): Promise<T> {
    const target = await resolveChromeTabSelector(input.sourcePageUrl, input.abortSignal);
    return evaluateChromePage<T>({
      script: input.script,
      description: input.description,
      windowSelector: target.windowSelector,
      tabSelector: target.tabSelector,
      ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
    });
  },
});

const probeVideoDownloadSourcePage = (
  sourcePageUrl: string,
): Promise<TelegramWebVisibleMediaProbeResult> =>
  probeTelegramWebVisibleMediaSourcePage({
    browserMediaSourcePort: createSourcePageProbePort(),
    sourcePageUrl,
  });

export const findOpenVideoDownloadSourcePage = async (
  platformId: VideoDownloadSourcePagePlatform,
  preferredSourcePageUrl?: string,
): Promise<VideoDownloadSourcePage | null> => {
  const host = resolveVideoDownloadSourceHost(platformId);
  if (!host) {
    return null;
  }
  const validatedPreferredUrl = validatePreferredVideoDownloadSourceUrl(host, preferredSourcePageUrl);
  if (validatedPreferredUrl === null) {
    return null;
  }
  const page = await findChromeVideoDownloadSourcePage({
    host,
    ...(validatedPreferredUrl ? { preferredSourcePageUrl: validatedPreferredUrl } : {}),
  });
  if (!page) {
    return null;
  }
  const probeResult = await probeVideoDownloadSourcePage(page.sourcePageUrl);
  return {
    platformId,
    sourcePageUrl: page.sourcePageUrl,
    pageTitle: page.pageTitle,
    videoCandidates: probeResult.ok ? probeResult.candidates ?? [] : [],
  };
};
