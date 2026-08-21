import { createHash } from "node:crypto";

import type { AiFeedInput } from "../schema.js";

type CapturedJsonArtifact = Readonly<{
  jsonText: string;
  source: "chatgpt-inline-json";
  outputRef: string;
  sha256: string;
  byteSize: number;
}>;

const isJsonDocumentText = (value: string): boolean => {
  try { JSON.parse(value); return true; } catch { return false; }
};

const findBalancedJsonEnd = (value: string, start: number): number => {
  const opening = value[start];
  const closing = opening === "{" ? "}" : opening === "[" ? "]" : null;
  if (!closing) return -1;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < value.length; index += 1) {
    const char = value[index]!;
    if (escaped) { escaped = false; continue; }
    if (char === "\\") { escaped = true; continue; }
    if (char === "\"") { quoted = !quoted; continue; }
    if (quoted) continue;
    if (char === opening) depth += 1;
    if (char === closing && --depth === 0) return index;
  }
  return -1;
};

const extractInlineJsonText = (value: string): string | null => {
  const trimmed = value.trim();
  if (isJsonDocumentText(trimmed)) return trimmed;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== "{" && value[index] !== "[") continue;
    const end = findBalancedJsonEnd(value, index);
    if (end < 0) continue;
    const candidate = value.slice(index, end + 1).trim();
    if (isJsonDocumentText(candidate)) return candidate;
    index = end;
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
    sha256: `sha256:${createHash("sha256").update(jsonText, "utf8").digest("hex")}`,
    byteSize: Buffer.byteLength(jsonText, "utf8"),
  };
};

export const captureChatGptJsonArtifact = async (input: {
  request: AiFeedInput;
  conversationUrl: string | null;
}): Promise<CapturedJsonArtifact | null> => {
  if (!isJsonArtifactRequest(input.request) || !input.conversationUrl) return null;
  throw new Error("review_required: NOT_PRODUCTION_VERIFIED: ChatGPT JSON download control and artifact identity are not observed");
};
