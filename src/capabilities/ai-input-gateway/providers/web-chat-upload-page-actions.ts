import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { WebChatEvaluation } from "./web-chat-evaluation-contract.js";

const CHATGPT_COMPOSER_FORM_SELECTOR = "form:has(#prompt-textarea)";
const CHATGPT_COMPOSER_SELECTOR = `${CHATGPT_COMPOSER_FORM_SELECTOR} #prompt-textarea`;
const CHATGPT_ATTACHMENT_SURFACE_SELECTOR = [
  CHATGPT_COMPOSER_FORM_SELECTOR,
  CHATGPT_COMPOSER_SELECTOR,
].join(",");

export type AttachmentBrowser = Pick<BrowserTargetLease, "executeDomIntent">;

type ExactAttachmentStateOptions = {
  expectedPageUrl?: string | null;
  requireComposerTextEmpty?: boolean;
};

const attachmentSurfaceContractMismatch = (detail: string): Error =>
  new Error(`review_required: ATTACHMENT_SURFACE_CONTRACT_MISMATCH:${detail}`);

const record = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw attachmentSurfaceContractMismatch("result_shape");
  }
  return value as Record<string, unknown>;
};

const documentState = async (browser: AttachmentBrowser): Promise<{ url: string; title: string }> => {
  const value = record(await browser.executeDomIntent({ kind: "document" }));
  if (typeof value.url !== "string" || typeof value.title !== "string" || !value.url.startsWith("https://")) {
    throw attachmentSurfaceContractMismatch("document_shape");
  }
  return { url: value.url, title: value.title };
};

type AttachmentSurfaceNode = Readonly<{
  id: string;
  tagName: string;
  text: string;
  disabled: boolean;
}>;

type AttachmentSurface = Readonly<{
  pageUrl: string;
  composer: AttachmentSurfaceNode;
  formText: string;
}>;

const stringField = (value: unknown): string => {
  if (typeof value !== "string") throw attachmentSurfaceContractMismatch("string_field");
  return value;
};

const booleanField = (value: unknown): boolean => {
  if (typeof value !== "boolean") throw attachmentSurfaceContractMismatch("boolean_field");
  return value;
};

const surfaceNode = (value: unknown): AttachmentSurfaceNode => {
  const node = record(value);
  return {
    id: stringField(node.id),
    tagName: stringField(node.tagName),
    text: stringField(node.text),
    disabled: booleanField(node.disabled),
  };
};

const exactlyOne = (
  nodes: readonly AttachmentSurfaceNode[],
  predicate: (node: AttachmentSurfaceNode) => boolean,
  label: string,
): AttachmentSurfaceNode => {
  const matches = nodes.filter(predicate);
  if (matches.length !== 1) {
    throw attachmentSurfaceContractMismatch(`${label}_count_${matches.length}`);
  }
  return matches[0]!;
};

const readAttachmentSurface = async (browser: AttachmentBrowser): Promise<AttachmentSurface> => {
  const { url: pageUrl } = await documentState(browser);
  const result = record(await browser.executeDomIntent({
    kind: "find",
    selector: CHATGPT_ATTACHMENT_SURFACE_SELECTOR,
    maxMatches: 20,
    fields: ["id", "tagName", "text", "disabled"],
  }));
  if (!Number.isInteger(result.count)
    || !Array.isArray(result.matches)
    || result.matches.length !== result.count) {
    throw attachmentSurfaceContractMismatch("snapshot_shape");
  }
  const nodes = result.matches.map(surfaceNode);
  const form = exactlyOne(nodes, (node) => node.tagName === "FORM", "composer_form");
  const composer = exactlyOne(nodes, (node) => node.id === "prompt-textarea", "composer");
  return {
    pageUrl,
    composer,
    formText: form.text.trim(),
  };
};

const emptyAttachmentState = (
  pageUrl: string,
  composerTextLength: number,
): WebChatEvaluation => ({
  status: "success",
  message: "exact visible ChatGPT composer and zero-attachment surface verified",
  pageUrl,
  attachmentCount: 0,
  attachmentNames: [],
  attachmentScope: "composer",
  composerCandidateCount: 1,
  composerRootCount: 1,
  conversationTurnCountInScope: 0,
  pendingAttachmentCount: 0,
  composerTextLength,
});

const evaluateObservedAttachmentSet = (input: Readonly<{
  pageUrl: string;
  composerTextLength: number;
  expectedCount: number;
  matchedNames: readonly string[];
  formText: string;
  duplicateNameCount: number;
}>): WebChatEvaluation => {
  const common = {
    pageUrl: input.pageUrl,
    attachmentCount: input.matchedNames.length,
    attachmentNames: [...input.matchedNames],
  };
  if (input.duplicateNameCount > 0) {
    return { status: "review_required", message: "CHATGPT_ATTACHMENT_SET_AMBIGUOUS", ...common };
  }
  if (input.matchedNames.length === input.expectedCount) {
    return {
      status: "success",
      message: "exact visible ChatGPT attachment file names verified",
      ...common,
      attachmentScope: "composer",
      composerCandidateCount: 1,
      composerRootCount: 1,
      conversationTurnCountInScope: 0,
      pendingAttachmentCount: input.matchedNames.length,
      composerTextLength: input.composerTextLength,
    };
  }
  if (input.formText.length === 0) {
    return { status: "pending", message: "CHATGPT_ATTACHMENT_SURFACE_EMPTY", ...common };
  }
  return { status: "review_required", message: "CHATGPT_ATTACHMENT_SET_AMBIGUOUS", ...common };
};

const occurrences = (value: string, needle: string): number =>
  needle.length === 0 ? 0 : value.split(needle).length - 1;

const evaluateObservedAttachmentSetFromSurface = (
  observed: AttachmentSurface,
  pageUrl: string,
  composerTextLength: number,
  expectedCount: number,
  expectedFileNames: readonly string[],
): Promise<WebChatEvaluation> => {
  const nameOccurrences = expectedFileNames.map((fileName) => ({
    fileName,
    count: occurrences(observed.formText, fileName),
  }));
  return Promise.resolve(evaluateObservedAttachmentSet({
    pageUrl,
    composerTextLength,
    expectedCount,
    matchedNames: nameOccurrences.filter(({ count }) => count === 1).map(({ fileName }) => fileName),
    formText: observed.formText,
    duplicateNameCount: nameOccurrences.filter(({ count }) => count > 1).length,
  }));
};

const evaluateKnownAttachmentPreflight = async (
  browser: AttachmentBrowser,
  expectedCount: number,
  expectedFileNames: readonly string[],
  options: ExactAttachmentStateOptions,
): Promise<WebChatEvaluation> => {
  const observed = await readAttachmentSurface(browser);
  if (options.expectedPageUrl && observed.pageUrl !== options.expectedPageUrl) {
    return { status: "review_required", message: "WEB_CHAT_PROVIDER_IDENTITY_DRIFT", pageUrl: observed.pageUrl };
  }
  if (observed.composer.tagName !== "DIV" || observed.composer.disabled) {
    return { status: "review_required", message: "CHATGPT_COMPOSER_INVALID", pageUrl: observed.pageUrl };
  }
  const composerText = typeof observed.composer.text === "string" ? observed.composer.text.trim() : "";
  if (options.requireComposerTextEmpty && composerText.length > 0) {
    return { status: "review_required", message: "WEB_CHAT_COMPOSER_NOT_EMPTY", pageUrl: observed.pageUrl, composerText };
  }
  if (expectedCount === 0) {
    if (observed.formText.length !== 0) {
      return { status: "review_required", message: "CHATGPT_ATTACHMENT_SET_AMBIGUOUS", pageUrl: observed.pageUrl };
    }
    return emptyAttachmentState(observed.pageUrl, composerText.length);
  }
  return evaluateObservedAttachmentSetFromSurface(
    observed,
    observed.pageUrl,
    composerText.length,
    expectedCount,
    expectedFileNames,
  );
};

export const readExactAttachmentState = (
  browser: AttachmentBrowser,
  _context: AiProviderAdapterContext,
  expectedCount: number,
  expectedFileNames: readonly string[],
  options: ExactAttachmentStateOptions = {},
): Promise<WebChatEvaluation> => evaluateKnownAttachmentPreflight(browser, expectedCount, expectedFileNames, options);

/** Unknown drafts are never cleared. This only admits a already-empty composer. */
export const clearComposer = async (
  browser: AttachmentBrowser,
  context: AiProviderAdapterContext,
): Promise<WebChatEvaluation> => readExactAttachmentState(browser, context, 0, [], { requireComposerTextEmpty: true });

const throwIfTerminalAttachmentEvaluation = (input: {
  evaluation: WebChatEvaluation;
  expectedCount: number;
  expectedFileNames: readonly string[];
}): void => {
  if (input.evaluation.status !== "review_required" && input.evaluation.status !== "failed") return;
  throw new Error(`${input.evaluation.message}; step=${input.expectedCount}; expected_files=${input.expectedFileNames.join("|")}; page_url=${input.evaluation.pageUrl ?? "unknown"}`);
};

export const observeExactAttachmentSet = async (
  browser: AttachmentBrowser,
  context: AiProviderAdapterContext,
  expectedCount: number,
  expectedFileNames: readonly string[],
  options: ExactAttachmentStateOptions = {},
): Promise<WebChatEvaluation> => {
  const evaluation = await readExactAttachmentState(browser, context, expectedCount, expectedFileNames, options);
  if (evaluation.status === "success") return evaluation;
  throwIfTerminalAttachmentEvaluation({ evaluation, expectedCount, expectedFileNames });
  throw new Error(`GPT_ATTACHMENT_COUNT_MISMATCH; expected_count=${expectedCount}; expected_files=${expectedFileNames.join("|")}`);
};
