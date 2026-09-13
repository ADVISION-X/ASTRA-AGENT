import { createHash } from "node:crypto";

import type {
  BrowserDomObservationQuery,
  BrowserTargetLease,
} from "../../../lib/browser/browser-authority-api.js";
import { executionFailure } from "../../../lib/execution-failure.js";

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw executionFailure("failed", "GPT_DOM_RESULT_INVALID");
  }
  return value as Record<string, unknown>;
};

export type GptCoherentObservationRow = Readonly<{
  queryId: string;
  scopeRawCount: number;
  scopeEligibleCount: number;
  rawCount: number;
  eligibleCount: number;
  matches: readonly Readonly<Record<string, unknown>>[];
  scopeRejections: readonly Readonly<{ index: number; reasons: readonly string[] }>[];
  rejections: readonly Readonly<{ index: number; reasons: readonly string[] }>[];
  nativeCauseCode: "NO_LAYOUT_BOX" | null;
  nativeCauseCount: number;
  nativeStage: "runtime-call-function-on";
}>;

export type GptCoherentObservation = Readonly<{
  exactCallIdentityHash: `sha256:${string}`;
  targetRefHash: `sha256:${string}`;
  documentRefHash: `sha256:${string}`;
  currentUrl: string;
  observationRevisionHash: `sha256:${string}`;
  observedAt: string;
  rows: readonly GptCoherentObservationRow[];
}>;

export type GptCoherentFactProjection = Readonly<{
  factResultIds: readonly string[];
  candidateCardinality: Readonly<{ raw: number; eligible: number }>;
  authorityRefHashes: readonly `sha256:${string}`[];
  observationRevisionHash: `sha256:${string}`;
}>;

export type GptExactAssistantTurnObservation = Readonly<{
  exactCallIdentityHash: `sha256:${string}`;
  targetRefHash: `sha256:${string}`;
  documentRefHash: `sha256:${string}`;
  observationRevisionHash: `sha256:${string}`;
  assistantTurnId: string;
  currentUrl: string;
  precedingUserTurnId: string;
  generatingRaw: number;
  rawDomHtml: string;
  rawDomHash: `sha256:${string}`;
  semanticText: string;
  semanticTextHash: `sha256:${string}`;
  observedAt: string;
}>;

const nonNegativeInteger = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

const hashText = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const decodeRejections = (value: unknown): readonly Readonly<{
  index: number;
  reasons: readonly string[];
}>[] => {
  if (!Array.isArray(value)) throw executionFailure("failed", "GPT_DOM_COHERENT_PACKET_INVALID");
  return Object.freeze(value.map((rejection) => {
    const item = record(rejection);
    if (!nonNegativeInteger(item.index) || !Array.isArray(item.reasons)
      || !item.reasons.every((reason) => typeof reason === "string")) {
      throw executionFailure("failed", "GPT_DOM_COHERENT_PACKET_INVALID");
    }
    return Object.freeze({
      index: item.index as number,
      reasons: Object.freeze([...item.reasons]) as readonly string[],
    });
  }));
};

const decodeObservationRow = (
  value: unknown,
  spec: BrowserDomObservationQuery,
): GptCoherentObservationRow => {
  const row = record(value);
  if (row.queryId !== spec.queryId
    || !nonNegativeInteger(row.scopeRawCount) || !nonNegativeInteger(row.scopeEligibleCount)
    || !nonNegativeInteger(row.rawCount) || !nonNegativeInteger(row.eligibleCount)
    || !nonNegativeInteger(row.nativeCauseCount)
    || (row.scopeEligibleCount as number) > (row.scopeRawCount as number)
    || (row.eligibleCount as number) > (row.rawCount as number)
    || (row.nativeCauseCount as number) > (row.rawCount as number)
    || !Array.isArray(row.matches)
    || row.nativeStage !== "runtime-call-function-on"
    || !(row.nativeCauseCode === null || row.nativeCauseCode === "NO_LAYOUT_BOX")) {
    throw executionFailure("failed", "GPT_DOM_COHERENT_PACKET_INVALID");
  }
  return Object.freeze({
    queryId: row.queryId as string,
    scopeRawCount: row.scopeRawCount as number,
    scopeEligibleCount: row.scopeEligibleCount as number,
    rawCount: row.rawCount as number,
    eligibleCount: row.eligibleCount as number,
    matches: Object.freeze(row.matches.map((match) => Object.freeze({ ...record(match) }))),
    scopeRejections: decodeRejections(row.scopeRejections),
    rejections: decodeRejections(row.rejections),
    nativeCauseCode: row.nativeCauseCode as "NO_LAYOUT_BOX" | null,
    nativeCauseCount: row.nativeCauseCount as number,
    nativeStage: "runtime-call-function-on",
  });
};

/**
 * Reads one Browser-owned coherent packet. The returned rows all describe the
 * same exact call, Target, Document and observation revision.
 */
export const decodeCoherentObservationPacket = (
  value: unknown,
  queries: readonly BrowserDomObservationQuery[],
): GptCoherentObservation => {
  const packet = record(value);
  if (packet.schemaVersion !== "grasseye.browser.dom-observation.v2"
    || typeof packet.exactCallIdentityHash !== "string"
    || typeof packet.targetRefHash !== "string"
    || typeof packet.documentRefHash !== "string"
    || typeof packet.currentUrl !== "string" || packet.currentUrl.length === 0
    || typeof packet.observationRevisionHash !== "string"
    || ![packet.exactCallIdentityHash, packet.targetRefHash, packet.documentRefHash,
      packet.observationRevisionHash].every((value) => /^sha256:[a-f0-9]{64}$/u.test(value as string))
    || typeof packet.observedAt !== "string"
    || Number.isNaN(Date.parse(packet.observedAt))
    || !Array.isArray(packet.queries)
    || packet.queries.length !== queries.length) {
    throw executionFailure("failed", "GPT_DOM_COHERENT_PACKET_INVALID");
  }
  const rows = Object.freeze(packet.queries.map((value, index) =>
    decodeObservationRow(value, queries[index]!)));
  return Object.freeze({
    exactCallIdentityHash: packet.exactCallIdentityHash as `sha256:${string}`,
    targetRefHash: packet.targetRefHash as `sha256:${string}`,
    documentRefHash: packet.documentRefHash as `sha256:${string}`,
    currentUrl: packet.currentUrl as string,
    observationRevisionHash: packet.observationRevisionHash as `sha256:${string}`,
    observedAt: packet.observedAt as string,
    rows,
  });
};

export const readCoherentObservation = async (
  browser: Pick<BrowserTargetLease, "executeDomIntent">,
  queries: readonly BrowserDomObservationQuery[],
): Promise<GptCoherentObservation> => decodeCoherentObservationPacket(
  await browser.executeDomIntent({ kind: "observe", queries }), queries,
);

export const projectCoherentObservation = (
  observation: GptCoherentObservation,
  primaryQueryId: string,
): GptCoherentFactProjection => {
  const primary = observation.rows.find((row) => row.queryId === primaryQueryId);
  if (!primary) throw executionFailure("failed", "GPT_DOM_COHERENT_PACKET_INVALID");
  return Object.freeze({
    factResultIds: Object.freeze([
      `gpt-dom-fact:${observation.exactCallIdentityHash.slice(7)}:${observation.observationRevisionHash.slice(7)}`,
    ]),
    candidateCardinality: Object.freeze({ raw: primary.rawCount, eligible: primary.eligibleCount }),
    authorityRefHashes: Object.freeze([observation.targetRefHash, observation.documentRefHash]),
    observationRevisionHash: observation.observationRevisionHash,
  });
};

const exactAssistantIdentityValid = (
  value: Readonly<Record<string, unknown>>,
  userTurnId: string,
): boolean => value.schemaVersion === "grasseye.browser.exact-assistant-turn.v3"
  && typeof value.assistantTurnId === "string"
  && /^conversation-turn-[1-9][0-9]*$/u.test(value.assistantTurnId)
  && typeof value.currentUrl === "string"
  && value.precedingUserTurnId === userTurnId;

type ExactAssistantContent = Readonly<{
  rawDomHtml: string;
  semanticText: string;
  observedAt: string;
}>;

const exactAssistantContentValid = (
  value: Readonly<Record<string, unknown>>,
): value is Readonly<Record<string, unknown>> & ExactAssistantContent => {
  const hashes = [value.exactCallIdentityHash, value.targetRefHash, value.documentRefHash,
    value.observationRevisionHash, value.rawDomHash, value.semanticTextHash];
  return hashes.every((candidate) => typeof candidate === "string" && /^sha256:[a-f0-9]{64}$/u.test(candidate))
    && typeof value.rawDomHtml === "string" && value.rawDomHtml.length > 0
    && typeof value.semanticText === "string"
    && nonNegativeInteger(value.generatingRaw)
    && hashText(value.rawDomHtml) === value.rawDomHash
    && hashText(value.semanticText) === value.semanticTextHash
    && typeof value.observedAt === "string" && !Number.isNaN(Date.parse(value.observedAt));
};

export const readExactAssistantTurn = async (
  browser: Pick<BrowserTargetLease, "executeDomIntent">,
  userTurnId: string,
  canonicalConversationUrl: string,
): Promise<GptExactAssistantTurnObservation> => {
  if (!/^conversation-turn-[1-9][0-9]*$/u.test(userTurnId)) {
    throw executionFailure("failed", "GPT_TURN_ID_INVALID");
  }
  const value = record(await browser.executeDomIntent({
    kind: "readExactAssistantTurn", userTurnId, canonicalConversationUrl,
  }));
  if (!exactAssistantIdentityValid(value, userTurnId)
    || !exactAssistantContentValid(value)) {
    throw executionFailure("failed", "GPT_EXACT_ASSISTANT_TURN_RESULT_INVALID");
  }
  return Object.freeze({
    exactCallIdentityHash: value.exactCallIdentityHash as `sha256:${string}`,
    targetRefHash: value.targetRefHash as `sha256:${string}`,
    documentRefHash: value.documentRefHash as `sha256:${string}`,
    observationRevisionHash: value.observationRevisionHash as `sha256:${string}`,
    assistantTurnId: value.assistantTurnId as string,
    currentUrl: value.currentUrl as string,
    precedingUserTurnId: userTurnId,
    generatingRaw: value.generatingRaw as number,
    rawDomHtml: value.rawDomHtml,
    rawDomHash: value.rawDomHash as `sha256:${string}`,
    semanticText: value.semanticText,
    semanticTextHash: value.semanticTextHash as `sha256:${string}`,
    observedAt: value.observedAt,
  });
};

export const projectExactAssistantTurn = (
  assistant: GptExactAssistantTurnObservation,
): GptCoherentFactProjection => Object.freeze({
  factResultIds: Object.freeze([
    `gpt-assistant-turn-fact:${assistant.exactCallIdentityHash.slice(7)}`,
  ]),
  candidateCardinality: Object.freeze({ raw: 1, eligible: 1 }),
  authorityRefHashes: Object.freeze([assistant.targetRefHash, assistant.documentRefHash]),
  observationRevisionHash: assistant.observationRevisionHash,
});
