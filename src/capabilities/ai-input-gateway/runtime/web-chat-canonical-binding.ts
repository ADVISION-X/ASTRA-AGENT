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

export type SubmittedDraftOwnerResolution = {
  matchCount: number;
  owner: {
    executionId: string;
    canonicalConversationUrl: string;
  } | null;
};

export const resolveSubmittedDraftOwnerByTurnMarker = async (input: {
  dataDir: string;
  providerKind: "gpt-web-chat";
  turnMarker: string;
}): Promise<SubmittedDraftOwnerResolution> => {
  if (!/^GRASSEYE_TURN_[a-f0-9]{32}$/u.test(input.turnMarker)) {
    return { matchCount: 0, owner: null };
  }
  const matches: Array<NonNullable<SubmittedDraftOwnerResolution["owner"]>> = [];
  for (const entry of await listExecutionStateFiles(input.dataDir)) {
    if (!entry.endsWith(".json")) continue;
    const candidate = await readExecutionState(input.dataDir, entry);
    if (
      candidate.schemaVersion !== "web-chat-execution-v2"
      || candidate.providerKind !== input.providerKind
      || candidate.turnMarker !== input.turnMarker
      || typeof candidate.executionId !== "string"
      || !candidate.submission?.canonicalConversationUrl
      || !candidate.submission.userTurnId
      || !candidate.submission.submittedAt
    ) continue;
    matches.push({
      executionId: candidate.executionId,
      canonicalConversationUrl: normalizedCanonicalConversationUrl(
        input.providerKind,
        candidate.submission.canonicalConversationUrl,
      ),
    });
  }
  return {
    matchCount: matches.length,
    owner: matches.length === 1 ? matches[0]! : null,
  };
};

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
