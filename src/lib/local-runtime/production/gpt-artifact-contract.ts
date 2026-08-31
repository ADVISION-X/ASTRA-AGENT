export type GptSubmissionLocatorArtifact = Readonly<{
  canonicalConversationUrl: string;
  turnMarker: string;
  userTurnId: string;
  promptHash: `sha256:${string}`;
  conversationIdentityHash: `sha256:${string}`;
}>;

const isSha256 = (value: unknown): value is `sha256:${string}` =>
  typeof value === "string" && /^sha256:[a-f0-9]{64}$/u.test(value);

const isCanonicalConversationUrl = (value: unknown): value is string =>
  typeof value === "string" && /^https:\/\/chatgpt\.com\/c\/[A-Za-z0-9_-]+$/u.test(value);

export const gptSubmissionLocatorArtifact = (
  value: unknown,
  hash: (content: string) => `sha256:${string}`,
): GptSubmissionLocatorArtifact | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Readonly<Record<string, unknown>>;
  if (row.schemaVersion !== "agent-gpt-submission-locator.v1") return null;
  if (!isCanonicalConversationUrl(row.canonicalConversationUrl)) return null;
  if (typeof row.turnMarker !== "string" || !row.turnMarker) return null;
  if (typeof row.userTurnId !== "string" || !/^conversation-turn-[1-9][0-9]*$/u.test(row.userTurnId)) return null;
  if (!isSha256(row.promptHash) || !isSha256(row.conversationIdentityHash)) return null;
  const identity = hash(`${row.canonicalConversationUrl}\n${row.turnMarker}\n${row.userTurnId}\n${row.promptHash}`);
  if (identity !== row.conversationIdentityHash) return null;
  return Object.freeze({
    canonicalConversationUrl: row.canonicalConversationUrl,
    turnMarker: row.turnMarker,
    userTurnId: row.userTurnId,
    promptHash: row.promptHash,
    conversationIdentityHash: row.conversationIdentityHash,
  });
};
