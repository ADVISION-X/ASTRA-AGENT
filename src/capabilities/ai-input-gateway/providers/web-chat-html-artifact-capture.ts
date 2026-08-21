import { createHash } from "node:crypto";

import type { AiFeedInput } from "../schema.js";

type CapturedHtmlArtifact = Readonly<{
  htmlDocument: string;
  source: "chatgpt-inline-assistant-message";
  outputRef: string;
  sha256: string;
  byteSize: number;
}>;

export const isBusinessHtmlReportRequest = (request: AiFeedInput): boolean =>
  request.providerKind === "gpt-web-chat" && request.promptContractId.includes("business-html-report");

const isHtmlDocumentText = (value: string): boolean => {
  const lower = value.trim().toLowerCase();
  return (lower.includes("<!doctype html") || lower.includes("<html"))
    && lower.includes("<body")
    && (lower.includes("</html>") || lower.includes("</body>"));
};

const extractInlineHtmlDocument = (value: string): string | null => {
  const lower = value.toLowerCase();
  const start = Math.max(lower.indexOf("<!doctype html"), lower.indexOf("<html"));
  const end = lower.lastIndexOf("</html>");
  if (start < 0 || end < start) return null;
  const candidate = value.slice(start, end + "</html>".length).trim();
  return isHtmlDocumentText(candidate) ? candidate : null;
};

export const captureInlineChatGptBusinessHtmlArtifact = (input: {
  answerText: string;
  pageUrl: string | null;
}): CapturedHtmlArtifact | null => {
  const htmlDocument = extractInlineHtmlDocument(input.answerText);
  if (!htmlDocument) return null;
  return {
    htmlDocument,
    source: "chatgpt-inline-assistant-message",
    outputRef: input.pageUrl ?? "chatgpt-inline-assistant-message",
    sha256: `sha256:${createHash("sha256").update(htmlDocument, "utf8").digest("hex")}`,
    byteSize: Buffer.byteLength(htmlDocument, "utf8"),
  };
};

export const captureChatGptBusinessHtmlArtifact = async (input: {
  request: AiFeedInput;
  conversationUrl: string | null;
}): Promise<CapturedHtmlArtifact | null> => {
  if (!isBusinessHtmlReportRequest(input.request) || !input.conversationUrl) return null;
  throw new Error("review_required: NOT_PRODUCTION_VERIFIED: ChatGPT business HTML download controls and downloaded-artifact identity are not observed");
};
