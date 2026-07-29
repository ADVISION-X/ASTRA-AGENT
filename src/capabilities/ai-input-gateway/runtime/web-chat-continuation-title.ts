import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import type {
  WebChatExecutionRecord,
} from "./web-chat-execution-state.js";

const executionStateDirectory = (dataDir: string): string =>
  path.join(
    dataDir,
    "runtime-data",
    "ai-input-gateway",
    "web-chat-executions",
  );

interface ContinuationTitleCandidate {
  createdAt: string;
  recordTitle: string | null;
  verifiedSubmissionTitle: string | null;
  verifiedAt: string | null;
}

const normalizedCanonicalConversationUrl = (
  providerKind: "gpt-web-chat" | "gemini-web-chat",
  rawUrl: string,
): string => {
  const parsed = new URL(rawUrl);
  if (
    providerKind === "gpt-web-chat"
    && (
      parsed.protocol !== "https:"
      || parsed.host !== "chatgpt.com"
      || !/^\/c\/(?!WEB:)[^/]+$/u.test(parsed.pathname)
    )
  ) {
    throw new Error(
      "WEB_CHAT_CANONICAL_CONVERSATION_INVALID: "
      + `provider=${providerKind}; url=${rawUrl}`,
    );
  }
  if (
    providerKind === "gemini-web-chat"
    && (
      parsed.protocol !== "https:"
      || parsed.host !== "gemini.google.com"
      || !parsed.pathname.startsWith("/app/")
    )
  ) {
    throw new Error(
      "WEB_CHAT_CANONICAL_CONVERSATION_INVALID: "
      + `provider=${providerKind}; url=${rawUrl}`,
    );
  }
  return `${parsed.origin}${parsed.pathname}`;
};

const listExecutionStateFiles = async (dataDir: string): Promise<string[]> => {
  try {
    return await readdir(executionStateDirectory(dataDir));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
};

const readExecutionState = async (
  dataDir: string,
  entry: string,
): Promise<Partial<WebChatExecutionRecord>> =>
  JSON.parse(
    await readFile(path.join(executionStateDirectory(dataDir), entry), "utf8"),
  ) as Partial<WebChatExecutionRecord>;

export const assertWebChatCanonicalConversationBinding = async (input: {
  dataDir: string;
  executionId: string;
  providerKind: "gpt-web-chat" | "gemini-web-chat";
  canonicalConversationUrl: string | null;
  continuationConversationUrl: string | null;
}): Promise<void> => {
  if (!input.canonicalConversationUrl) return;
  const observed = normalizedCanonicalConversationUrl(
    input.providerKind,
    input.canonicalConversationUrl,
  );
  if (input.continuationConversationUrl) {
    const expected = normalizedCanonicalConversationUrl(
      input.providerKind,
      input.continuationConversationUrl,
    );
    if (observed !== expected) {
      throw new Error(
        "WEB_CHAT_CONTINUATION_CONVERSATION_DRIFT: "
        + `expected=${expected}; actual=${observed}`,
      );
    }
    return;
  }
  for (const entry of await listExecutionStateFiles(input.dataDir)) {
    if (!entry.endsWith(".json")) continue;
    const candidate = await readExecutionState(input.dataDir, entry);
    if (
      candidate.schemaVersion !== "web-chat-execution-v2"
      || candidate.executionId === input.executionId
      || candidate.providerKind !== input.providerKind
      || !candidate.submission?.canonicalConversationUrl
    ) continue;
    const occupied = normalizedCanonicalConversationUrl(
      input.providerKind,
      candidate.submission.canonicalConversationUrl,
    );
    if (occupied === observed) {
      throw new Error(
        "WEB_CHAT_CANONICAL_CONVERSATION_ALREADY_BOUND: "
        + `url=${observed}; owner=${candidate.executionId}`,
      );
    }
  }
};

const continuationTitleCandidate = (
  candidate: Partial<WebChatExecutionRecord>,
): ContinuationTitleCandidate => ({
  createdAt: candidate.createdAt ?? "",
  recordTitle: candidate.systemChatTitle?.trim() || null,
  verifiedSubmissionTitle:
    candidate.submission?.chatTitleVerifiedAt
    && candidate.submission.systemChatTitle?.trim()
      ? candidate.submission.systemChatTitle.trim()
      : null,
  verifiedAt: candidate.submission?.chatTitleVerifiedAt ?? null,
});

const selectContinuationTitle = (
  candidates: readonly ContinuationTitleCandidate[],
): string | null => {
  const earliestVerifiedTitle = [...candidates]
    .filter((candidate) => Boolean(candidate.verifiedSubmissionTitle))
    .sort((left, right) =>
      (left.verifiedAt ?? left.createdAt).localeCompare(
        right.verifiedAt ?? right.createdAt,
      ))
    .map((candidate) => candidate.verifiedSubmissionTitle)
    .find((title): title is string => Boolean(title));
  if (earliestVerifiedTitle) return earliestVerifiedTitle;
  return [...candidates]
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .map((candidate) => candidate.recordTitle)
    .find((title): title is string => Boolean(title))
    ?? null;
};

export const resolveContinuationWebChatSystemTitle = async (input: {
  dataDir: string;
  providerKind: "gpt-web-chat" | "gemini-web-chat";
  canonicalConversationUrl: string;
}): Promise<string | null> => {
  if (input.providerKind !== "gpt-web-chat") return null;
  const expected = normalizedCanonicalConversationUrl(
    input.providerKind,
    input.canonicalConversationUrl,
  );
  const candidates: ContinuationTitleCandidate[] = [];
  for (const entry of await listExecutionStateFiles(input.dataDir)) {
    if (!entry.endsWith(".json")) continue;
    const candidate = await readExecutionState(input.dataDir, entry);
    if (
      candidate.schemaVersion !== "web-chat-execution-v2"
      || candidate.providerKind !== input.providerKind
      || !candidate.submission?.canonicalConversationUrl
      || normalizedCanonicalConversationUrl(
        input.providerKind,
        candidate.submission.canonicalConversationUrl,
      ) !== expected
    ) continue;
    candidates.push(continuationTitleCandidate(candidate));
  }
  return selectContinuationTitle(candidates);
};
