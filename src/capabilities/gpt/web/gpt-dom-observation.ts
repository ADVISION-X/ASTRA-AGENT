import { createHash } from "node:crypto";

import type {
  BrowserDomObservationQuery,
  BrowserTargetLease,
} from "../../../lib/browser/browser-authority-api.js";
import { executionFailure, failureCode } from "../../../lib/execution-failure.js";

export type GptDomObservationDisposition =
  | "STABLE_DONE" | "STABLE_ACT" | "TRANSIENT_DOM" | "HARD_FAIL";

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

const sameObservationIdentity = (
  baseline: GptCoherentObservation,
  current: GptCoherentObservation,
): boolean => baseline.exactCallIdentityHash === current.exactCallIdentityHash
  && baseline.targetRefHash === current.targetRefHash
  && baseline.documentRefHash === current.documentRefHash
  && baseline.currentUrl === current.currentUrl;

const transientObservationFailure = (error: unknown): boolean =>
  ["BROWSER_DOM_CANDIDATE_MISSING", "BROWSER_DOM_NODE_STALE", "NO_LAYOUT_BOX"]
    .includes(failureCode(error, ""));

const awaitConfirmationStage = async (
  browser: BrowserTargetLease,
  stage: 0 | 1 | 2,
  signal?: AbortSignal,
): Promise<void> => {
  if (signal?.aborted) throw executionFailure("failed", "GPT_EXECUTION_ABORTED");
  if (stage === 0) return;
  try {
    await browser.awaitTransientDomConfirmation({
      stage, ...(signal === undefined ? {} : { signal }),
    });
  } catch (error) {
    if (signal?.aborted) throw executionFailure(
      "failed", "GPT_EXECUTION_ABORTED", { cause: error },
    );
    throw error;
  }
};

type ConfirmationStageRead =
  | Readonly<{ kind: "observation"; observation: GptCoherentObservation }>
  | Readonly<{ kind: "transient-failure"; error: unknown }>;

const readConfirmationStage = async (
  browser: BrowserTargetLease,
  queries: readonly BrowserDomObservationQuery[],
  stage: 0 | 1 | 2,
): Promise<ConfirmationStageRead> => {
  try {
    return { kind: "observation", observation: await readCoherentObservation(browser, queries) };
  } catch (error) {
    if (!transientObservationFailure(error) || stage === 2) throw error;
    return { kind: "transient-failure", error };
  }
};

export const readConfirmedCoherentObservation = async (
  browser: BrowserTargetLease,
  queries: readonly BrowserDomObservationQuery[],
  classify: (observation: GptCoherentObservation) => GptDomObservationDisposition,
  signal?: AbortSignal,
): Promise<GptCoherentObservation> => {
  const targetRef = browser.target.targetRef;
  const documentRef = browser.document.documentRef;
  let baseline: GptCoherentObservation | null = null;
  let lastTransientFailure: unknown = null;
  for (const stage of [0, 1, 2] as const) {
    await awaitConfirmationStage(browser, stage, signal);
    if (browser.target.targetRef !== targetRef || browser.document.documentRef !== documentRef) {
      throw executionFailure("failed", "GPT_DOM_CONFIRMATION_IDENTITY_CHANGED");
    }
    const read = await readConfirmationStage(browser, queries, stage);
    if (read.kind === "transient-failure") {
      lastTransientFailure = read.error;
      continue;
    }
    const observation = read.observation;
    if (baseline !== null && !sameObservationIdentity(baseline, observation)) {
      throw executionFailure("failed", "GPT_DOM_CONFIRMATION_IDENTITY_CHANGED");
    }
    baseline ??= observation;
    if (classify(observation) !== "TRANSIENT_DOM" || stage === 2) return observation;
  }
  throw lastTransientFailure ?? executionFailure("failed", "GPT_DOM_CONFIRMATION_FAILED");
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

const exactAssistantIdentityValid = (
  value: Readonly<Record<string, unknown>>,
): boolean => value.schemaVersion === "grasseye.browser.exact-assistant-turn.v4"
  && typeof value.assistantTurnId === "string"
  && value.assistantTurnId.length > 0
  && typeof value.currentUrl === "string"
  && typeof value.precedingUserTurnId === "string"
  && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(value.precedingUserTurnId);

type ExactAssistantContent = Readonly<{
  rawDomHtml: string;
  semanticText: string;
  observedAt: string;
}>;

const validObservedAt = (value: unknown): value is string =>
  typeof value === "string" && !Number.isNaN(Date.parse(value));

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
    && validObservedAt(value.observedAt);
};

export const readExactAssistantTurn = async (
  browser: Pick<BrowserTargetLease, "executeDomIntent">,
  userTurnId: string,
  turnMarker: string,
  canonicalConversationUrl: string,
): Promise<GptExactAssistantTurnObservation> => {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(userTurnId)) {
    throw executionFailure("failed", "GPT_TURN_ID_INVALID");
  }
  const value = record(await browser.executeDomIntent({
    kind: "readExactAssistantTurn", turnMarker, canonicalConversationUrl,
  }));
  if (value.pendingCause === "exact-user-turn-unavailable"
    || value.pendingCause === "adjacent-assistant-missing") {
    if (value.schemaVersion !== "grasseye.browser.exact-assistant-turn.v4"
      || value.currentUrl !== canonicalConversationUrl
      || (value.pendingCause === "exact-user-turn-unavailable"
        ? value.precedingUserTurnId !== ""
        : !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(String(value.precedingUserTurnId)))
      || [value.rawDomHtml, value.semanticText].some((text) => text !== "")
      || !nonNegativeInteger(value.generatingRaw)
      || !validObservedAt(value.observedAt)
      || [value.targetRefHash, value.documentRefHash, value.observationRevisionHash]
        .some((hash) => typeof hash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(hash))) {
      throw executionFailure("failed", "GPT_EXACT_ASSISTANT_TURN_RESULT_INVALID");
    }
    throw executionFailure("failed", value.pendingCause === "exact-user-turn-unavailable"
      ? "BROWSER_EXACT_USER_TURN_UNAVAILABLE" : "BROWSER_ADJACENT_ASSISTANT_TURN_MISSING", {
      metadata: { exactReadbackNegativeObservation: Object.freeze({
        pendingCause: value.pendingCause,
        canonicalConversationUrl, userTurnId,
        targetRefHash: value.targetRefHash as `sha256:${string}`,
        documentRefHash: value.documentRefHash as `sha256:${string}`,
        observationRevisionHash: value.observationRevisionHash as `sha256:${string}`,
        observedAt: value.observedAt,
        generatingRaw: value.generatingRaw as number,
        firstObservedAt: value.observedAt,
        observationCount: 1,
      }) },
    });
  }
  if (!exactAssistantIdentityValid(value) || value.currentUrl !== canonicalConversationUrl
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
    precedingUserTurnId: value.precedingUserTurnId as string,
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
