import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";

const PRIMARY_ENTRY_WAIT_MS = 8_000;
const SECONDARY_ENTRY_WAIT_MS = 30_000;
const HTML_ARTIFACT_CAPTURE_TIMEOUT_MS = 600_000;
const HTML_ARTIFACT_CAPTURE_RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000] as const;
const DOWNLOAD_SETTLE_MS = 350;
const HTML_ARTIFACT_NAME = "business-report.html";
const PRIMARY_CHATGPT_FILE_ENTRY_LABEL = "下载 business-report.html";
const PRIMARY_CHATGPT_FILE_DOWNLOAD_LABEL = "下载 HTML 报告";
const SECONDARY_CHATGPT_DOWNLOAD_LABEL = "下载代码文件";

type CapturedHtmlArtifact = {
  htmlDocument: string;
  source: "chatgpt-primary-file-entry" | "chatgpt-preview-download";
  outputRef: string;
  sha256: string;
  byteSize: number;
};

type DownloadCandidate = {
  filePath: string;
  mtimeMs: number;
  size: number;
};

type ClickEvaluation = {
  status: "success" | "pending" | "failed";
  message: string;
  pageUrl: string;
  point?: { x: number; y: number } | undefined;
};

const remainingMs = (deadlineMs: number, capMs: number): number =>
  Math.max(0, Math.min(capMs, deadlineMs - Date.now()));

export const isBusinessHtmlReportRequest = (request: AiFeedInput): boolean =>
  request.providerKind === "gpt-web-chat"
  && request.promptContractId.includes("business-html-report");

const isHtmlDocumentText = (value: string): boolean => {
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  const isChatGptShellHtmlDocument = lower.includes('property="og:title" content="chatgpt"')
    || lower.includes("window.__reactroutercontext")
    || lower.includes("/cdn/assets/")
    || lower.includes("data-message-author-role")
    || lower.includes("prompt-textarea")
    || lower.includes("composer-submit-button")
    || lower.includes("chatgpt 是一款")
    || lower.includes("历史聊天记录");
  return trimmed.length > 0
    && (lower.includes("<!doctype html") || lower.includes("<html"))
    && lower.includes("<body")
    && (lower.includes("</html>") || lower.includes("</body>"))
    && !isChatGptShellHtmlDocument;
};

const getDownloadsDir = (): string => path.join(os.homedir(), "Downloads");

const hashText = (value: string): string =>
  "sha256:" + createHash("sha256").update(value, "utf8").digest("hex");

const listBusinessHtmlDownloads = async (): Promise<DownloadCandidate[]> => {
  const entries = await readdir(getDownloadsDir(), { withFileTypes: true });
  const candidates: DownloadCandidate[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.startsWith("business-report") || !entry.name.endsWith(".html")) continue;
    const filePath = path.join(getDownloadsDir(), entry.name);
    const fileStat = await stat(filePath);
    candidates.push({
      filePath,
      mtimeMs: fileStat.mtimeMs,
      size: fileStat.size,
    });
  }
  return candidates.sort((left, right) => right.mtimeMs - left.mtimeMs);
};

const readSettledDownload = async (candidate: DownloadCandidate): Promise<CapturedHtmlArtifact | null> => {
  await new Promise((resolve) => setTimeout(resolve, DOWNLOAD_SETTLE_MS));
  const afterStat = await stat(candidate.filePath);
  if (afterStat.size !== candidate.size || afterStat.size === 0) {
    return null;
  }
  const htmlDocument = await readFile(candidate.filePath, "utf8");
  if (!isHtmlDocumentText(htmlDocument)) {
    return null;
  }
  return {
    htmlDocument,
    source: "chatgpt-preview-download",
    outputRef: candidate.filePath,
    sha256: hashText(htmlDocument),
    byteSize: Buffer.byteLength(htmlDocument, "utf8"),
  };
};

const waitForDownloadedBusinessHtml = async (input: {
  startedAtMs: number;
  timeoutMs: number;
}): Promise<CapturedHtmlArtifact | null> => {
  const deadline = Date.now() + input.timeoutMs;
  while (Date.now() < deadline) {
    const candidates = (await listBusinessHtmlDownloads())
      .filter((entry) => entry.mtimeMs >= input.startedAtMs - 1_000);
    for (const candidate of candidates) {
      const settled = await readSettledDownload(candidate);
      if (settled) return settled;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
};

const waitBeforeHtmlArtifactRetry = async (
  browser: BrowserController,
  attempt: number,
): Promise<void> => {
  const delayMs = HTML_ARTIFACT_CAPTURE_RETRY_DELAYS_MS[
    Math.min(attempt, HTML_ARTIFACT_CAPTURE_RETRY_DELAYS_MS.length - 1)
  ] ?? 30_000;
  await browser.wait(delayMs);
};

const clickLocatedChatGptHtmlArtifactControl = async (
  browser: BrowserController,
  located: ClickEvaluation,
  targetLabel: string,
): Promise<ClickEvaluation> => {
  if (located.status !== "success" || !located.point) return located;
  const clicked = await browser.click({
    targetLabel,
    point: located.point,
    coordinateSpace: "browserViewport",
  });
  return {
    status: clicked.ok ? "success" : "failed",
    message: clicked.message,
    pageUrl: located.pageUrl,
  };
};

const locatePrimaryChatGptHtmlArtifactEntry = (
  browser: BrowserController,
  context: AiProviderAdapterContext,
): Promise<ClickEvaluation> =>
  browser.evaluateActiveTab<ClickEvaluation>({
    description: `locate ChatGPT primary ${HTML_ARTIFACT_NAME} file entry`,
    script: `
const buttons = Array.from(document.querySelectorAll("button"));
const primaryLabels = ${JSON.stringify([PRIMARY_CHATGPT_FILE_ENTRY_LABEL, PRIMARY_CHATGPT_FILE_DOWNLOAD_LABEL])};
const target = buttons.find((button) => primaryLabels.includes((button.textContent || "").trim()))
  || buttons.find((button) => {
    const label = button.getAttribute("aria-label") || "";
    const scopeText = button.closest("article, [data-message-author-role], main")?.textContent || "";
    return label.includes("下载") && scopeText.includes(${JSON.stringify(HTML_ARTIFACT_NAME)});
  });
if (!target) {
  return {status: "pending", message: "primary business HTML file entry not present", pageUrl: location.href};
}
const rect = target.getBoundingClientRect();
if (rect.width <= 0 || rect.height <= 0) {
  return {status: "pending", message: "primary business HTML file entry not visible", pageUrl: location.href};
}
return {
  status: "success",
  message: "primary business HTML file entry located",
  pageUrl: location.href,
  point: {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2},
};
`,
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });

const clickPrimaryChatGptHtmlArtifactEntry = async (
  browser: BrowserController,
  context: AiProviderAdapterContext,
): Promise<ClickEvaluation> =>
  clickLocatedChatGptHtmlArtifactControl(
    browser,
    await locatePrimaryChatGptHtmlArtifactEntry(browser, context),
    `ChatGPT primary ${HTML_ARTIFACT_NAME} file entry`,
  );

const locateSecondaryChatGptPreviewDownload = (
  browser: BrowserController,
  context: AiProviderAdapterContext,
): Promise<ClickEvaluation> =>
  browser.evaluateActiveTab<ClickEvaluation>({
    description: `locate ChatGPT preview ${HTML_ARTIFACT_NAME} download`,
    script: `
const target = Array.from(document.querySelectorAll("button"))
  .find((button) => button.getAttribute("aria-label") === ${JSON.stringify(SECONDARY_CHATGPT_DOWNLOAD_LABEL)});
if (!target) {
  return {status: "pending", message: "preview business HTML download control not present", pageUrl: location.href};
}
const rect = target.getBoundingClientRect();
if (rect.width <= 0 || rect.height <= 0) {
  return {status: "pending", message: "preview business HTML download control not visible", pageUrl: location.href};
}
return {
  status: "success",
  message: "preview business HTML download control located",
  pageUrl: location.href,
  point: {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2},
};
`,
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });

const clickSecondaryChatGptPreviewDownload = async (
  browser: BrowserController,
  context: AiProviderAdapterContext,
): Promise<ClickEvaluation> =>
  clickLocatedChatGptHtmlArtifactControl(
    browser,
    await locateSecondaryChatGptPreviewDownload(browser, context),
    `ChatGPT preview ${HTML_ARTIFACT_NAME} download`,
  );

const readActiveHtmlDocument = async (
  browser: BrowserController,
  context: AiProviderAdapterContext,
): Promise<CapturedHtmlArtifact | null> => {
  const captured = await browser.evaluateActiveTab<{
    htmlDocument: string | null;
    pageUrl: string;
  }>({
    description: "read opened ChatGPT business HTML artifact document",
    script: `
const htmlDocument = document.documentElement ? new XMLSerializer().serializeToString(document) : null;
return {htmlDocument, pageUrl: location.href};
`,
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });
  if (!captured.htmlDocument || !isHtmlDocumentText(captured.htmlDocument)) {
    return null;
  }
  if (captured.pageUrl.startsWith("https://chatgpt.com/")) {
    return null;
  }
  return {
    htmlDocument: captured.htmlDocument,
    source: "chatgpt-primary-file-entry",
    outputRef: captured.pageUrl,
    sha256: hashText(captured.htmlDocument),
    byteSize: Buffer.byteLength(captured.htmlDocument, "utf8"),
  };
};

const reopenConversation = async (input: {
  browser: BrowserController;
  conversationUrl: string;
}): Promise<void> => {
  await input.browser.open({
    url: input.conversationUrl,
    title: "gpt-web-chat html artifact conversation",
    reusePolicy: "reuse-exact-url",
  });
  await input.browser.wait(1_500);
};

const captureViaPrimaryEntry = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
  startedAtMs: number;
  deadlineMs: number;
}): Promise<CapturedHtmlArtifact | null> => {
  const clicked = await clickPrimaryChatGptHtmlArtifactEntry(input.browser, input.context);
  if (clicked.status !== "success") {
    return null;
  }
  await input.browser.wait(1_000);
  const downloaded = await waitForDownloadedBusinessHtml({
    startedAtMs: input.startedAtMs,
    timeoutMs: remainingMs(input.deadlineMs, PRIMARY_ENTRY_WAIT_MS),
  });
  if (downloaded) {
    return {
      ...downloaded,
      source: "chatgpt-primary-file-entry",
    };
  }
  return readActiveHtmlDocument(input.browser, input.context);
};

const captureViaSecondaryDownload = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
  startedAtMs: number;
  deadlineMs: number;
}): Promise<CapturedHtmlArtifact | null> => {
  const clicked = await clickSecondaryChatGptPreviewDownload(input.browser, input.context);
  if (clicked.status !== "success") {
    return null;
  }
  return waitForDownloadedBusinessHtml({
    startedAtMs: input.startedAtMs,
    timeoutMs: remainingMs(input.deadlineMs, SECONDARY_ENTRY_WAIT_MS),
  });
};

export const captureChatGptBusinessHtmlArtifact = async (input: {
  browser: BrowserController;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  conversationUrl: string | null;
}): Promise<CapturedHtmlArtifact | null> => {
  if (!isBusinessHtmlReportRequest(input.request) || !input.conversationUrl) {
    return null;
  }
  const startedAtMs = Date.now();
  const deadlineMs = startedAtMs + Math.min(input.request.timeoutMs, HTML_ARTIFACT_CAPTURE_TIMEOUT_MS);
  let attempt = 0;
  while (Date.now() < deadlineMs) {
    const downloaded = await waitForDownloadedBusinessHtml({
      startedAtMs,
      timeoutMs: remainingMs(deadlineMs, 1_000),
    });
    if (downloaded) return downloaded;
    const primary = await captureViaPrimaryEntry({ ...input, startedAtMs, deadlineMs });
    if (primary) return primary;
    await reopenConversation({
      browser: input.browser,
      conversationUrl: input.conversationUrl,
    });
    const secondary = await captureViaSecondaryDownload({ ...input, startedAtMs, deadlineMs });
    if (secondary) return secondary;
    await waitBeforeHtmlArtifactRetry(input.browser, attempt);
    attempt += 1;
    await reopenConversation({
      browser: input.browser,
      conversationUrl: input.conversationUrl,
    });
  }
  return null;
};
