import {
  createVideoDownloadAbilityGroupFromFilesystem,
  type BrowserMediaSourcePort,
} from "../../capabilities/video-download/index.js";
import type { BrowserController, BrowserTargetSession } from "../browser/browser-controller.js";
import type { RuntimeLogger } from "../runtime-logs/index.js";

const allowedSourcePageProbeDescriptions = new Set([
  "collect Telegram Web visible media list",
  "collect Telegram Web cached video media bytes",
]);

const assertAllowedProbe = (description: string, script: string): void => {
  if (!allowedSourcePageProbeDescriptions.has(description) || !script.trim()) {
    throw new Error(`Video download page evaluation "${description}" is not an approved source-page probe.`);
  }
};

const bindSourceTarget = async (
  browser: BrowserTargetSession,
  sourcePageUrl: string,
  abortSignal?: AbortSignal,
): Promise<void> => {
  const current = browser.getTarget?.();
  if (current?.url === sourcePageUrl) return;
  await browser.open({
    url: sourcePageUrl,
    title: "Video download governed source page",
    reusePolicy: "reuse-exact-url",
    ...(abortSignal ? { abortSignal } : {}),
  });
};

export const createWorkbenchBrowserMediaSourcePort = (
  browser: BrowserTargetSession,
): BrowserMediaSourcePort => ({
  evaluate: (input) => browser.evaluate(input),
  async evaluateSourcePage<T>(input: {
    sourcePageUrl: string;
    script: string;
    description: string;
    abortSignal?: AbortSignal;
  }): Promise<T> {
    assertAllowedProbe(input.description, input.script);
    await bindSourceTarget(browser, input.sourcePageUrl, input.abortSignal);
    return browser.evaluate<T>({
      script: input.script,
      description: input.description,
      timeoutMs: 120_000,
      ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
    });
  },
});

export function createWorkbenchVideoDownload(
  dataDir: string,
  browserController: BrowserController,
  runtimeLogger?: RuntimeLogger,
) {
  const browser = browserController.createTargetSession("video-download:source-page");
  return createVideoDownloadAbilityGroupFromFilesystem({
    browserMediaSourcePort: createWorkbenchBrowserMediaSourcePort(browser),
    dataDir,
    ...(runtimeLogger ? { runtimeLogger } : {}),
  });
}
