import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";

const JSON_ARTIFACT_CAPTURE_TIMEOUT_MS = 600_000;
const JSON_DOWNLOAD_SETTLE_MS = 350;
const JSON_DOWNLOAD_LABEL_PATTERN = /下载.*json|download.*json|json.*download|json.*下载/iu;

type CapturedJsonArtifact = {
  jsonText: string;
  source: "chatgpt-json-download" | "chatgpt-inline-json";
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

const getDownloadsDir = (): string => path.join(os.homedir(), "Downloads");

const hashText = (value: string): string =>
  "sha256:" + createHash("sha256").update(value, "utf8").digest("hex");

const isJsonDocumentText = (value: string): boolean => {
  try {
    JSON.parse(value) as unknown;
    return true;
  } catch {
    return false;
  }
};

const findBalancedJsonEnd = (value: string, startIndex: number): number => {
  const opening = value[startIndex];
  const closing = opening === "{" ? "}" : opening === "[" ? "]" : "";
  if (!closing) return -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = startIndex; index < value.length; index += 1) {
    const char = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === opening) depth += 1;
    if (char === closing) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
};

const extractInlineJsonText = (value: string): string | null => {
  const trimmed = value.trim();
  if (isJsonDocumentText(trimmed)) return trimmed;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char !== "{" && char !== "[") continue;
    const endIndex = findBalancedJsonEnd(value, index);
    if (endIndex < 0) continue;
    const candidate = value.slice(index, endIndex + 1).trim();
    if (isJsonDocumentText(candidate)) return candidate;
    index = endIndex;
  }
  return null;
};

export const isJsonArtifactRequest = (request: AiFeedInput): boolean =>
  request.providerKind === "gpt-web-chat" && Boolean(request.expectedOutputSchemaRef);

export const captureInlineChatGptJsonArtifact = (input: {
  answerText: string;
  pageUrl: string | null;
}): CapturedJsonArtifact | null => {
  const jsonText = extractInlineJsonText(input.answerText);
  if (!jsonText) return null;
  return {
    jsonText,
    source: "chatgpt-inline-json",
    outputRef: input.pageUrl ?? "chatgpt-inline-json",
    sha256: hashText(jsonText),
    byteSize: Buffer.byteLength(jsonText, "utf8"),
  };
};

const listJsonDownloads = async (): Promise<DownloadCandidate[]> => {
  const entries = await readdir(getDownloadsDir(), { withFileTypes: true });
  const candidates: DownloadCandidate[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.toLowerCase().endsWith(".json")) continue;
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

const readSettledJsonDownload = async (candidate: DownloadCandidate): Promise<CapturedJsonArtifact | null> => {
  await new Promise((resolve) => setTimeout(resolve, JSON_DOWNLOAD_SETTLE_MS));
  const afterStat = await stat(candidate.filePath);
  if (afterStat.size !== candidate.size || afterStat.size === 0) {
    return null;
  }
  const jsonText = await readFile(candidate.filePath, "utf8");
  if (!isJsonDocumentText(jsonText)) {
    return null;
  }
  return {
    jsonText,
    source: "chatgpt-json-download",
    outputRef: candidate.filePath,
    sha256: hashText(jsonText),
    byteSize: Buffer.byteLength(jsonText, "utf8"),
  };
};

const waitForDownloadedJson = async (input: {
  startedAtMs: number;
  timeoutMs: number;
}): Promise<CapturedJsonArtifact | null> => {
  const deadline = Date.now() + input.timeoutMs;
  while (Date.now() < deadline) {
    const candidates = (await listJsonDownloads())
      .filter((entry) => entry.mtimeMs >= input.startedAtMs - 1_000);
    for (const candidate of candidates) {
      const settled = await readSettledJsonDownload(candidate);
      if (settled) return settled;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
};

const remainingMs = (deadlineMs: number, capMs: number): number =>
  Math.max(0, Math.min(capMs, deadlineMs - Date.now()));

const locateChatGptJsonDownloadControl = (
  browser: BrowserController,
  context: AiProviderAdapterContext,
): Promise<ClickEvaluation> =>
  browser.evaluateActiveTab<ClickEvaluation>({
    description: "locate ChatGPT JSON artifact download control",
    script: `
const clip = (value) => String(value || "").replace(/\\s+/g, " ").trim();
const labelPattern = ${JSON.stringify(JSON_DOWNLOAD_LABEL_PATTERN.source)};
const flags = ${JSON.stringify(JSON_DOWNLOAD_LABEL_PATTERN.flags)};
const pattern = new RegExp(labelPattern, flags);
const assistantNodes = Array.from(document.querySelectorAll("[data-message-author-role='assistant']"));
const scopes = assistantNodes.length > 0 ? [assistantNodes[assistantNodes.length - 1], document] : [document];
let target = null;
for (const scope of scopes) {
  target = Array.from(scope.querySelectorAll("button, a, [role='button']"))
    .find((node) => {
      const label = clip(node.getAttribute("aria-label") || node.getAttribute("title") || node.textContent || "");
      return pattern.test(label);
    });
  if (target) break;
}
if (!target) {
  return {status: "pending", message: "ChatGPT JSON artifact download control not present", pageUrl: location.href};
}
const rect = target.getBoundingClientRect();
if (rect.width <= 0 || rect.height <= 0) {
  return {status: "pending", message: "ChatGPT JSON artifact download control not visible", pageUrl: location.href};
}
return {
  status: "success",
  message: "ChatGPT JSON artifact download control located",
  pageUrl: location.href,
  point: {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2},
};
`,
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });

const clickChatGptJsonDownloadControl = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
}): Promise<ClickEvaluation> => {
  const located = await locateChatGptJsonDownloadControl(input.browser, input.context);
  if (located.status !== "success" || !located.point) return located;
  const clicked = await input.browser.click({
    targetLabel: "ChatGPT JSON artifact download",
    point: located.point,
    coordinateSpace: "browserViewport",
  });
  return {
    status: clicked.ok ? "success" : "failed",
    message: clicked.message,
    pageUrl: located.pageUrl,
  };
};

export const captureChatGptJsonArtifact = async (input: {
  browser: BrowserController;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  conversationUrl: string | null;
}): Promise<CapturedJsonArtifact | null> => {
  if (!isJsonArtifactRequest(input.request) || !input.conversationUrl) {
    return null;
  }
  const startedAtMs = Date.now();
  const deadlineMs = startedAtMs + Math.min(input.request.timeoutMs, JSON_ARTIFACT_CAPTURE_TIMEOUT_MS);
  const clicked = await clickChatGptJsonDownloadControl({
    browser: input.browser,
    context: input.context,
  });
  if (clicked.status !== "success") {
    return null;
  }
  return waitForDownloadedJson({
    startedAtMs,
    timeoutMs: remainingMs(deadlineMs, 30_000),
  });
};
