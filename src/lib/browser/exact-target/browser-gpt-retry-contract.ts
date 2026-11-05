import type { BrowserMutationIdentity } from "./browser-mutation-types.js";

type Hash = `sha256:${string}`;
export const GPT_RETRY_CHILD = "retry_exact_gpt_response_once";
export const GPT_RETRY_LIMIT = 5;
export const GPT_RETRY_TRIGGER_SELECTOR = "button[aria-label='重新生成回复']";
export const gptRetryCallId = (root: Hash, ordinal: number): string =>
  `stopped-empty-retry:${root.slice(7)}:${ordinal}`;

export type GptStoppedEmptyRetryInput = Readonly<{
  originalEffectIdentityHash: Hash; previousEffectIdentityHash: Hash; retryOrdinal: number;
  promptHash: Hash; originalUserTurnId: string; profileHash: Hash; approvedModel: string;
  turnMarker: string; turnMarkerHash: Hash;
}>;
export type GptStoppedEmptyClick = GptStoppedEmptyRetryInput & Readonly<{
  action: "open-menu" | "regenerate"; canonicalConversationUrl: string;
}>;
export type GptRetryFact = Readonly<{
  preEmptyObservationRevisionHash: Hash; preEmptyObservedAt: string;
  observationRevisionHash: Hash; observedAt: string;
  generationStartedBy: "stop-present" | "generation-changed" | "completed-text" | null;
}>;
export type GptRetryTerminalPayload = Readonly<{
  schemaVersion: "grasseye.browser.confirmed-gpt-retry-proof.v1";
  originalEffectIdentityHash: Hash; previousEffectIdentityHash: Hash; retryOrdinal: number;
  promptHash: Hash; userTurnId: string; profileHash: Hash; approvedModel: string; turnMarkerHash: Hash;
  exactCallIdentityHash: Hash; targetRefHash: Hash; documentRefHash: Hash;
  rawCount: 1; eligibleCount: 1;
}> & GptRetryFact;

const HASH = /^sha256:[a-f0-9]{64}$/u;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const iso = (value: unknown): value is string => typeof value === "string"
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

export function assertGptStoppedEmptyClick(value: unknown): asserts value is GptStoppedEmptyClick {
  const fields = ["action", "canonicalConversationUrl", "originalEffectIdentityHash", "previousEffectIdentityHash",
    "retryOrdinal", "promptHash", "originalUserTurnId", "profileHash", "approvedModel", "turnMarker", "turnMarkerHash"];
  if (!record(value) || !exactKeys(value, fields)
    || !["open-menu", "regenerate"].includes(String(value.action))
    || !Number.isInteger(value.retryOrdinal) || Number(value.retryOrdinal) < 1 || Number(value.retryOrdinal) > GPT_RETRY_LIMIT
    || [value.originalEffectIdentityHash, value.previousEffectIdentityHash, value.promptHash, value.profileHash,
      value.turnMarkerHash].some(item => typeof item !== "string" || !HASH.test(item))
    || typeof value.originalUserTurnId !== "string" || !UUID.test(value.originalUserTurnId)
    || typeof value.approvedModel !== "string" || !value.approvedModel || value.approvedModel.length > 128
    || typeof value.turnMarker !== "string" || !/^\[GRASSEYE:[a-f0-9]{24}\]$/u.test(value.turnMarker)
    || typeof value.canonicalConversationUrl !== "string"
    || !/^https:\/\/chatgpt\.com\/c\/[^/?#\s]{1,256}$/u.test(value.canonicalConversationUrl)) {
    throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  }
}

export function assertGptStoppedEmptyIntent(value: Readonly<Record<string, unknown>>): void {
  if (!exactKeys(value, ["kind", "selector", "expectedMatches", "gptStoppedEmpty"])
    || value.kind !== "click" || value.selector !== GPT_RETRY_TRIGGER_SELECTOR || value.expectedMatches !== 1) {
    throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  }
  assertGptStoppedEmptyClick(value.gptStoppedEmpty);
}

/** The three closed outcomes are independently checked at both authenticated ends. */
export const gptRetryMutationReceipt = (request: GptStoppedEmptyClick, value: Record<string, unknown>) => {
  const input = value.mutationCount === 1;
  const changed = value.gptRetryState === "response-changed" && value.mutationCount === 0;
  const ready = value.gptRetryState === "menu-ready" && request.action === "open-menu";
  const started = value.gptRetryState === "generation-started" && request.action === "regenerate" && input;
  const keys = ["candidateCount", "identityRevalidated", "mutationCount", "postconditionVerified",
    "gptRetryState", "gptRetryFact", "gptRetryObservationRevisionHash", ...(input ? ["clicked"] : ["zeroActionSatisfied"])];
  if (!exactKeys(value, keys) || value.candidateCount !== 1 || value.identityRevalidated !== true
    || !HASH.test(String(value.gptRetryObservationRevisionHash)) || (!input && value.zeroActionSatisfied !== true)
    || (input && value.clicked !== true) || !(changed || ready || started || value.gptRetryState === "unproven")
    || ((ready || started) && !gptRetryFactValid(value.gptRetryFact, started))
    || (changed && value.gptRetryFact !== null)
    || value.postconditionVerified !== (changed || ready || started)) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  const confirmed = ready || started || changed && request.action === "open-menu";
  return Object.freeze({ terminal: confirmed ? "confirmed" as const : "rejected" as const,
    mutationOutcome: input ? "confirmed" as const : "no" as const,
    physicalInputCount: input ? 1 as const : 0 as const,
    failureCode: confirmed ? null : "BROWSER_POSTCONDITION_FAILED", nativeCauseCode: null });
};

/** Locator and current DOM identities cannot create another provider effect. */
export const gptRetryActionProjection = (input: Omit<GptStoppedEmptyRetryInput, "turnMarker">) => ({
  kind: GPT_RETRY_CHILD, originalEffectIdentityHash: input.originalEffectIdentityHash,
  previousEffectIdentityHash: input.previousEffectIdentityHash, retryOrdinal: input.retryOrdinal,
  promptHash: input.promptHash, originalUserTurnId: input.originalUserTurnId,
  profileHash: input.profileHash, approvedModel: input.approvedModel, turnMarkerHash: input.turnMarkerHash,
});

export const gptRetryFactValid = (value: unknown, generated: boolean): value is GptRetryFact => record(value)
  && exactKeys(value, ["preEmptyObservationRevisionHash", "preEmptyObservedAt", "observationRevisionHash",
    "observedAt", "generationStartedBy"])
  && HASH.test(String(value.preEmptyObservationRevisionHash)) && HASH.test(String(value.observationRevisionHash))
  && iso(value.preEmptyObservedAt) && iso(value.observedAt)
  && Date.parse(value.observedAt) >= Date.parse(value.preEmptyObservedAt)
  && (generated ? ["stop-present", "generation-changed", "completed-text"].includes(String(value.generationStartedBy))
    : value.generationStartedBy === null);

export const gptRetryTerminalPayload = (value: unknown, request: GptStoppedEmptyClick,
  binding: Readonly<{ exactCallIdentityHash: Hash; targetRefHash: Hash; documentRefHash: Hash }>,
): GptRetryTerminalPayload => {
  const fact = record(value) ? value.gptRetryFact : null;
  if (request.action !== "regenerate" || !gptRetryFactValid(fact, true)) {
    throw new Error("BROWSER_RECONCILIATION_RECEIPT_INVALID");
  }
  return Object.freeze({ schemaVersion: "grasseye.browser.confirmed-gpt-retry-proof.v1",
    originalEffectIdentityHash: request.originalEffectIdentityHash,
    previousEffectIdentityHash: request.previousEffectIdentityHash, retryOrdinal: request.retryOrdinal,
    promptHash: request.promptHash, userTurnId: request.originalUserTurnId,
    profileHash: request.profileHash, approvedModel: request.approvedModel, turnMarkerHash: request.turnMarkerHash,
    ...binding, rawCount: 1, eligibleCount: 1, ...fact });
};

export function assertGptRetryTerminalPayload(value: unknown,
  identity: Pick<BrowserMutationIdentity, "exactCallIdentityHash" | "childCapabilityId" | "callId">,
): asserts value is GptRetryTerminalPayload {
  const fields = ["schemaVersion", "originalEffectIdentityHash", "previousEffectIdentityHash", "retryOrdinal",
    "promptHash", "userTurnId", "profileHash", "approvedModel", "turnMarkerHash", "exactCallIdentityHash",
    "targetRefHash", "documentRefHash", "rawCount", "eligibleCount", "preEmptyObservationRevisionHash",
    "preEmptyObservedAt", "observationRevisionHash", "observedAt", "generationStartedBy"];
  if (!record(value) || !exactKeys(value, fields)
    || identity.childCapabilityId !== GPT_RETRY_CHILD || value.schemaVersion !== "grasseye.browser.confirmed-gpt-retry-proof.v1"
    || value.exactCallIdentityHash !== identity.exactCallIdentityHash
    || !Number.isInteger(value.retryOrdinal) || Number(value.retryOrdinal) < 1 || Number(value.retryOrdinal) > GPT_RETRY_LIMIT
    || identity.callId !== gptRetryCallId(value.originalEffectIdentityHash as Hash, Number(value.retryOrdinal))
    || [value.originalEffectIdentityHash, value.previousEffectIdentityHash, value.promptHash, value.profileHash,
      value.turnMarkerHash, value.targetRefHash, value.documentRefHash].some(item => !HASH.test(String(item)))
    || !UUID.test(String(value.userTurnId)) || typeof value.approvedModel !== "string" || !value.approvedModel
    || value.rawCount !== 1 || value.eligibleCount !== 1
    || !gptRetryFactValid(Object.fromEntries(["preEmptyObservationRevisionHash", "preEmptyObservedAt",
      "observationRevisionHash", "observedAt", "generationStartedBy"].map(key => [key, value[key]])), true)) {
    throw new Error("BROWSER_RECONCILIATION_RECEIPT_INVALID");
  }
}
