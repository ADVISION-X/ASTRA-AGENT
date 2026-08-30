import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import { executionFailure } from "../../../lib/typed-failure.js";

import { assertGptUrl } from "./contracts/target-document.contract.js";

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw executionFailure("failed", "GPT_DOM_RESULT_INVALID");
  }
  return value as Record<string, unknown>;
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
