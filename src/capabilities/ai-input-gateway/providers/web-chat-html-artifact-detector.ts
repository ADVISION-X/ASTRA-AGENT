import type { WebChatArtifactCandidate } from "./web-chat-artifact-detector.js";

const WEB_CHAT_HTML_MIME_TYPE = "text/html";

const stripWrapper = (value: string): string =>
  value.trim().replace(/^["'<(]+|[.,;"')>]+$/gu, "");

const isHtmlPath = (value: string): boolean => /\.html?$/iu.test(value.trim());

const buildHtmlArtifactCandidate = (sourcePath: string): WebChatArtifactCandidate => {
  const normalizedSourcePath = stripWrapper(sourcePath.replace(/^file:\/\//u, ""));
  return {
    artifactName: normalizedSourcePath.split(/[\\/]/u).pop() ?? "business-report.html",
    artifactMimeType: WEB_CHAT_HTML_MIME_TYPE,
    sourcePath: normalizedSourcePath,
  };
};

const readJsonCandidate = (rawText: string): WebChatArtifactCandidate | null => {
  try {
    const parsed = JSON.parse(rawText) as {
      htmlArtifactPath?: unknown;
      htmlFilePath?: unknown;
      htmlPath?: unknown;
      artifactPath?: unknown;
      filePath?: unknown;
    };
    const source = [
      parsed.htmlArtifactPath,
      parsed.htmlFilePath,
      parsed.htmlPath,
      parsed.artifactPath,
      parsed.filePath,
    ].find((value): value is string => typeof value === "string" && isHtmlPath(value));
    return source ? buildHtmlArtifactCandidate(source) : null;
  } catch {
    return null;
  }
};

export const detectHtmlArtifactInWebChatResponse = (
  rawText: string,
): WebChatArtifactCandidate | null => {
  const jsonCandidate = readJsonCandidate(rawText);
  if (jsonCandidate) {
    return jsonCandidate;
  }
  const markerMatch = rawText.match(
    /(?:HTML_ARTIFACT_PATH|htmlArtifactPath|htmlFilePath|htmlPath|artifactPath)\s*[:=]\s*([^\n\r]+)/iu,
  );
  if (markerMatch?.[1] && isHtmlPath(markerMatch[1])) {
    return buildHtmlArtifactCandidate(markerMatch[1]);
  }
  const pathMatch = rawText.match(/(?:file:\/\/)?(?:[A-Za-z]:)?[^\s"'<>]+\.html?\b/iu);
  return pathMatch?.[0] ? buildHtmlArtifactCandidate(pathMatch[0]) : null;
};

const trimMarkdownFence = (rawText: string): string => {
  const trimmed = rawText.trim();
  const fenceMatch = trimmed.match(/^```(?:html)?\s*([\s\S]*?)\s*```$/iu);
  return fenceMatch?.[1]?.trim() ?? trimmed;
};

const sliceHtmlDocument = (rawText: string): string | null => {
  const doctypeIndex = rawText.search(/<!DOCTYPE html\b/iu);
  if (doctypeIndex >= 0) {
    return rawText.slice(doctypeIndex).trim();
  }
  const htmlIndex = rawText.search(/<html\b/iu);
  return htmlIndex >= 0 ? rawText.slice(htmlIndex).trim() : null;
};

export const extractRawHtmlDocumentFromWebChatResponse = (
  rawText: string,
): string | null => {
  const trimmed = trimMarkdownFence(rawText);
  const htmlDocument = sliceHtmlDocument(trimmed);
  if (!htmlDocument) {
    return null;
  }
  if (!/(?:<!DOCTYPE html\b|<html\b)/iu.test(htmlDocument)) {
    return null;
  }
  if (!/<body\b/iu.test(htmlDocument) || !/<\/html>\s*$/iu.test(htmlDocument)) {
    return null;
  }
  return htmlDocument;
};