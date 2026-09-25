import { requireCanonicalGptConversationUrl } from "./browser-site-policy-registry.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isHash = (value: unknown): value is `sha256:${string}` =>
  typeof value === "string" && /^sha256:[a-f0-9]{64}$/u.test(value);

const exactRecoveryRows = (value: unknown): Readonly<{
  observation: Record<string, unknown>;
  row: Record<string, unknown>;
  item: Record<string, unknown>;
}> => {
  if (!isRecord(value) || !isRecord(value.postconditionObservation)) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  const observation = value.postconditionObservation;
  const query = Array.isArray(observation.queries) ? observation.queries[0] : undefined;
  const matches = isRecord(query) ? query.matches : undefined;
  const match = Array.isArray(matches) ? matches[0] : undefined;
  if (!isRecord(query) || !isRecord(match)) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  return { observation, row: query, item: match };
};

const recoveryRowsValid = (
  observation: Record<string, unknown>,
  row: Record<string, unknown>,
  item: Record<string, unknown>,
): boolean => typeof observation.currentUrl === "string" && observation.currentUrl.length > 0
  && typeof item.turnKey === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(item.turnKey)
  && row.rawCount === 1 && row.eligibleCount === 1
  && isHash(item.exactGptUserPromptHash)
  && ["exactCallIdentityHash", "observationRevisionHash", "targetRefHash", "documentRefHash"]
    .every((key) => isHash(observation[key]));

export const submitRecoveryPayload = (value: unknown): Readonly<Record<string, unknown>> => {
  const { observation, row, item } = exactRecoveryRows(value);
  if (!recoveryRowsValid(observation, row, item)) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  const canonicalConversationUrl = requireCanonicalGptConversationUrl(observation.currentUrl as string);
  return Object.freeze({
    canonicalConversationUrl,
    promptHash: item.exactGptUserPromptHash,
    userTurnId: item.turnKey,
    exactCallIdentityHash: observation.exactCallIdentityHash,
    observationRevisionHash: observation.observationRevisionHash,
    targetRefHash: observation.targetRefHash,
    documentRefHash: observation.documentRefHash,
    rawCount: row.rawCount,
    eligibleCount: row.eligibleCount,
  });
};
