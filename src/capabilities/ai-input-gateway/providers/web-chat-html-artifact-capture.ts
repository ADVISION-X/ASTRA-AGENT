import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";

const PRIMARY_ENTRY_WAIT_MS = 4_000;
const SECONDARY_ENTRY_WAIT_MS = 20_000;
const DOWNLOAD_SETTLE_MS = 350;
const HTML_ARTIFACT_NAME = "business-report.html";

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
};

const isBusinessHtmlReportRequest = (request: AiFeedInput): boolean =>
  request.providerKind === "gpt-web-chat"
  && request.promptContractId.includes("business-html-report");

const isHtmlDocumentText = (value: string): boolean => {
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  return trimmed.length > 0
    && (lower.includes("<!doctype html") || lower.includes("<html"))
    && lower.includes("<body")
    && (lower.includes("</html>") || lower.includes("</body>"));
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
    const candidate = (await listBusinessHtmlDownloads())
      .find((entry) => entry.mtimeMs >= input.startedAtMs - 1_000);
    if (candidate) {
      const settled = await readSettledDownload(candidate);
      if (settled) return settled;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
};

const clickPrimaryChatGptHtmlArtifactEntry = (
  browser: BrowserController,
  context: AiProviderAdapterContext,
): Promise<ClickEvaluation> =>
  browser.evaluateActiveTab<ClickEvaluation>({
    description: "click ChatGPT primary business-report.html file entry",
    script: `
const buttons = Array.from(document.querySelectorAll("button"));
const target = buttons.find((button) => (button.textContent || "").trim() === ${JSON.stringify(`下载 ${HTML_ARTIFACT_NAME}`)});
if (!target) {
  return {status: "pending", message: "primary business HTML file entry not present", pageUrl: location.href};
}
target.click();
return {status: "success", message: "primary business HTML file entry clicked", pageUrl: location.href};
`,
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });

const clickSecondaryChatGptPreviewDownload = (
  browser: BrowserController,
  context: AiProviderAdapterContext,
): Promise<ClickEvaluation> =>
  browser.evaluateActiveTab<ClickEvaluation>({
    description: "click ChatGPT preview business-report.html download",
    script: `
const target = Array.from(document.querySelectorAll("button"))
  .find((button) => button.getAttribute("aria-label") === "下载代码文件");
if (!target) {
  return {status: "pending", message: "preview business HTML download control not present", pageUrl: location.href};
}
target.click();
return {status: "success", message: "preview business HTML download clicked", pageUrl: location.href};
`,
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });

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
const htmlDocument = document.documentElement ? document.documentElement.outerHTML : null;
return {htmlDocument, pageUrl: location.href};
`,
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });
  if (!captured.htmlDocument || !isHtmlDocumentText(captured.htmlDocument)) {
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
}): Promise<CapturedHtmlArtifact | null> => {
  const startedAtMs = Date.now();
  const clicked = await clickPrimaryChatGptHtmlArtifactEntry(input.browser, input.context);
  if (clicked.status !== "success") {
    return null;
  }
  await input.browser.wait(1_000);
  const downloaded = await waitForDownloadedBusinessHtml({
    startedAtMs,
    timeoutMs: PRIMARY_ENTRY_WAIT_MS,
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
}): Promise<CapturedHtmlArtifact | null> => {
  const startedAtMs = Date.now();
  const clicked = await clickSecondaryChatGptPreviewDownload(input.browser, input.context);
  if (clicked.status !== "success") {
    return null;
  }
  return waitForDownloadedBusinessHtml({
    startedAtMs,
    timeoutMs: SECONDARY_ENTRY_WAIT_MS,
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
  const primary = await captureViaPrimaryEntry(input);
  if (primary) return primary;
  await reopenConversation({
    browser: input.browser,
    conversationUrl: input.conversationUrl,
  });
  return captureViaSecondaryDownload(input);
};
