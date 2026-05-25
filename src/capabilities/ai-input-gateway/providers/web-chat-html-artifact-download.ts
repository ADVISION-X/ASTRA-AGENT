import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import type { WebChatArtifactCandidate } from "./web-chat-artifact-types.js";
import { calculateFileSha256 } from "./web-chat-download-support.js";

const WEB_CHAT_HTML_MIME_TYPE = "text/html";

export type WebChatHtmlDownloadSuccess = {
  ok: true;
  artifactName: string;
  artifactMimeType: string;
  filePath: string;
  fileHash: string;
  fileSizeBytes: number;
  downloadedAt: string;
};

export type WebChatHtmlDownloadFailure = {
  ok: false;
  status:
    | "business_html_artifact_missing"
    | "business_html_invalid_file"
    | "business_html_persist_failed";
  failureReason: string;
};

export type WebChatHtmlDownloadResult =
  | WebChatHtmlDownloadSuccess
  | WebChatHtmlDownloadFailure;

const isHtmlFileName = (fileName: string): boolean => {
  const extension = path.extname(fileName).toLowerCase();
  return extension === ".html" || extension === ".htm";
};

const isHtmlDocumentText = (value: string): boolean => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return false;
  }
  if (!/(?:<!DOCTYPE html\b|<html\b)/iu.test(trimmed)) {
    return false;
  }
  return /<body\b/iu.test(trimmed);
};

const resolveDownloadedHtmlArtifactPath = (candidate: WebChatArtifactCandidate): string | null => {
  if (path.isAbsolute(candidate.sourcePath) && existsSync(candidate.sourcePath)) {
    return candidate.sourcePath;
  }
  const downloadsPath = path.join(homedir(), "Downloads");
  const artifactName = path.basename(candidate.artifactName || candidate.sourcePath);
  const exactDownloadsPath = path.join(downloadsPath, artifactName);
  if (existsSync(exactDownloadsPath)) {
    return exactDownloadsPath;
  }
  const matchingDownloadsPath = readdirSync(downloadsPath)
    .filter((fileName) => fileName === artifactName && isHtmlFileName(fileName))
    .map((fileName) => path.join(downloadsPath, fileName))
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs)[0];
  return matchingDownloadsPath ?? null;
};

export const downloadWebChatHtmlArtifact = (input: {
  candidate: WebChatArtifactCandidate | null;
  outputPath: string;
}): WebChatHtmlDownloadResult => {
  if (!input.candidate) {
    return {
      ok: false,
      status: "business_html_artifact_missing",
      failureReason: "business_html_artifact_missing",
    };
  }
  if (!isHtmlFileName(input.candidate.artifactName) || !isHtmlFileName(input.candidate.sourcePath)) {
    return {
      ok: false,
      status: "business_html_invalid_file",
      failureReason: "business_html_invalid_file",
    };
  }
  try {
    const sourcePath = resolveDownloadedHtmlArtifactPath(input.candidate);
    if (!sourcePath) {
      return {
        ok: false,
        status: "business_html_persist_failed",
        failureReason: `HTML artifact file was not found in provider path or Downloads: ${input.candidate.sourcePath}`,
      };
    }
    mkdirSync(path.dirname(input.outputPath), { recursive: true });
    copyFileSync(sourcePath, input.outputPath);
    const bytes = readFileSync(input.outputPath);
    const htmlText = readFileSync(input.outputPath, "utf8");
    const stat = statSync(input.outputPath);
    if (stat.size <= 0 || !isHtmlDocumentText(htmlText)) {
      return {
        ok: false,
        status: "business_html_invalid_file",
        failureReason: "business_html_invalid_file",
      };
    }
    return {
      ok: true,
      artifactName: input.candidate.artifactName,
      artifactMimeType: input.candidate.artifactMimeType || WEB_CHAT_HTML_MIME_TYPE,
      filePath: input.outputPath,
      fileHash: calculateFileSha256(bytes),
      fileSizeBytes: stat.size,
      downloadedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      ok: false,
      status: "business_html_persist_failed",
      failureReason: error instanceof Error ? error.message : "business_html_persist_failed",
    };
  }
};
