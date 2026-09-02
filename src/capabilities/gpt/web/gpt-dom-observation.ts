import type {
  BrowserDomObservationQuery,
  BrowserTargetLease,
} from "../../../lib/browser/browser-authority-api.js";
import { executionFailure } from "../../../lib/typed-failure.js";

import { assertGptUrl } from "./contracts/target-document.contract.js";

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
  nativeCauseCode: "NO_LAYOUT_BOX" | null;
  nativeCauseCount: number;
  nativeStage: "runtime-call-function-on";
}>;

const nonNegativeInteger = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

/**
 * Reads one Browser-owned coherent packet. The returned rows all describe the
 * same exact call, Target, Document and observation revision.
 */
export const readCoherentObservation = async (
  browser: Pick<BrowserTargetLease, "executeDomIntent">,
  queries: readonly BrowserDomObservationQuery[],
): Promise<readonly GptCoherentObservationRow[]> => {
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
  return Object.freeze(packet.queries.map((value, index): GptCoherentObservationRow => {
    const row = record(value);
    const spec = queries[index]!;
    if (row.queryId !== spec.queryId
      || !nonNegativeInteger(row.scopeRawCount)
      || !nonNegativeInteger(row.scopeEligibleCount)
      || !nonNegativeInteger(row.rawCount)
      || !nonNegativeInteger(row.eligibleCount)
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
      nativeCauseCode: row.nativeCauseCode as "NO_LAYOUT_BOX" | null,
      nativeCauseCount: row.nativeCauseCount as number,
      nativeStage: "runtime-call-function-on",
    });
  }));
};

export const readGptDocument = async (
  browser: Pick<BrowserTargetLease, "executeDomIntent">,
): Promise<Readonly<{ url: string; title: string }>> => {
  const value = record(await browser.executeDomIntent({ kind: "document" }));
  if (typeof value.url !== "string" || typeof value.title !== "string") {
    throw executionFailure("failed", "GPT_DOCUMENT_RESULT_INVALID");
  }
  assertGptUrl(value.url);
  return Object.freeze({ url: value.url, title: value.title });
};

export const findCount = async (
  browser: Pick<BrowserTargetLease, "executeDomIntent">,
  input: Readonly<{
    selector: string;
    maxMatches?: number;
    textContains?: string;
    textEquals?: string;
    scopeSelector?: string;
    waitFor?: Readonly<{ minimumMatches: number; timeoutMs: number }>;
  }>,
): Promise<number> => {
  const value = record(await browser.executeDomIntent({
    kind: "find",
    selector: input.selector,
    maxMatches: input.maxMatches ?? 20,
    ...(input.textContains === undefined ? {} : { textContains: input.textContains }),
    ...(input.textEquals === undefined ? {} : { textEquals: input.textEquals }),
    ...(input.scopeSelector === undefined ? {} : { scope: { selector: input.scopeSelector } }),
    ...(input.waitFor === undefined ? {} : { waitFor: input.waitFor }),
  }));
  if (!Number.isInteger(value.count) || (value.count as number) < 0) {
    throw executionFailure("failed", "GPT_DOM_RESULT_INVALID");
  }
  return value.count as number;
};

export const requireOneCandidate = async (
  browser: Pick<BrowserTargetLease, "executeDomIntent">,
  input: Parameters<typeof findCount>[1],
): Promise<1> => {
  const count = await findCount(browser, input);
  if (count !== 1) throw executionFailure("failed", `GPT_PAGE_CANDIDATE_COUNT_${count}`);
  return 1;
};

export const readExactText = async (
  browser: Pick<BrowserTargetLease, "executeDomIntent">,
  selector: string,
  maxChars = 65_536,
): Promise<string> => {
  const value = await browser.executeDomIntent({
    kind: "readText",
    selector,
    expectedMatches: 1,
    maxChars,
  });
  if (typeof value !== "string") throw executionFailure("failed", "GPT_DOM_RESULT_INVALID");
  return value;
};

export const readExactSemanticText = async (
  browser: Pick<BrowserTargetLease, "executeDomIntent">,
  selector: string,
): Promise<string> => {
  const value = record(await browser.executeDomIntent({
    kind: "inspect",
    selector,
    fields: ["semanticText", "visible", "connected"],
  }));
  if (value.visible !== true || value.connected !== true || typeof value.semanticText !== "string") {
    throw executionFailure("failed", "GPT_DOM_RESULT_INVALID");
  }
  return value.semanticText;
};

export const readExactCanonicalPromptText = async (
  browser: Pick<BrowserTargetLease, "executeDomIntent">,
  selector: string,
): Promise<string> => {
  const projected = await readExactSemanticText(browser, selector);
  return projected.endsWith("\n") ? projected.slice(0, -1) : projected;
};

export const readExactObservedResponse = async (
  browser: Pick<BrowserTargetLease, "executeDomIntent">,
  selector: string,
): Promise<Readonly<{ rawDomHtml: string; semanticText: string }>> => {
  const value = record(await browser.executeDomIntent({
    kind: "inspect",
    selector,
    fields: ["outerHtml", "semanticText", "visible", "connected"],
  }));
  if (value.visible !== true || value.connected !== true
    || typeof value.outerHtml !== "string" || !value.outerHtml
    || typeof value.semanticText !== "string") {
    throw executionFailure("failed", "GPT_DOM_RESULT_INVALID");
  }
  return Object.freeze({ rawDomHtml: value.outerHtml, semanticText: value.semanticText });
};

export const readExactAttribute = async (
  browser: Pick<BrowserTargetLease, "executeDomIntent">,
  selector: string,
  name: string,
  textContains?: string,
): Promise<string> => {
  const value = await browser.executeDomIntent({
    kind: "readAttribute",
    selector,
    name,
    maxChars: 8_192,
    expectedMatches: 1,
    ...(textContains === undefined ? {} : { textContains }),
  });
  if (typeof value !== "string" || value.length === 0) {
    throw executionFailure("failed", "GPT_DOM_RESULT_INVALID");
  }
  return value;
};
