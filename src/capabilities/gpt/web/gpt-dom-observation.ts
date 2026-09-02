import type {
  BrowserDomObservationQuery,
  BrowserTargetLease,
} from "../../../lib/browser/browser-authority-api.js";
import { executionFailure } from "../../../lib/typed-failure.js";

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

const nonNegativeInteger = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

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
export const readCoherentObservation = async (
  browser: Pick<BrowserTargetLease, "executeDomIntent">,
  queries: readonly BrowserDomObservationQuery[],
): Promise<GptCoherentObservation> => {
  const packet = record(await browser.executeDomIntent({ kind: "observe", queries }));
  if (packet.schemaVersion !== "grasseye.browser.dom-observation.v1"
    || typeof packet.exactCallIdentityHash !== "string"
    || typeof packet.targetRefHash !== "string"
    || typeof packet.documentRefHash !== "string"
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
    observationRevisionHash: packet.observationRevisionHash as `sha256:${string}`,
    observedAt: packet.observedAt as string,
    rows,
  });
};

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
