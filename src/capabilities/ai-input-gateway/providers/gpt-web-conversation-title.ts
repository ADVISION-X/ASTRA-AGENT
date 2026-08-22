import { createHash } from "node:crypto";

import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import type {
  AiProviderAdapterContext,
  WebChatConversationTitleProof,
  WebChatSubmissionProof,
} from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import { focusChatGptConversationByCanonicalPath } from "../runtime/web-chat-single-tab-routing.js";
import { recordWebChatPageAction } from "./web-chat-page-action-contract.js";

const CHATGPT_USER_TURN_SELECTOR = "[data-testid^='conversation-turn-'][data-turn='user']";
const CHATGPT_TITLE_INPUT_SELECTOR = 'input[aria-label="聊天标题"]';
const CHATGPT_COMPOSER_SELECTOR = "#prompt-textarea";

type FinalizationInput = Readonly<{
  browser: BrowserTargetLease;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
  submission: WebChatSubmissionProof;
}>;

type TitleExecution = NonNullable<AiProviderAdapterContext["webChatExecution"]>;
type TitleState = NonNullable<TitleExecution["conversationTitle"]>;

const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const canonicalConversationUrl = (value: string): string => {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" || parsed.host !== "chatgpt.com" || !/^\/c\/(?!WEB:)[^/]+$/u.test(parsed.pathname)) {
    throw new Error("WEB_CHAT_TITLE_FINALIZATION_NOT_READY:canonical conversation unavailable");
  }
  return `${parsed.origin}${parsed.pathname}`;
};

const exactSidebarRowSelector = (canonicalUrl: string): string =>
  `a[href=${JSON.stringify(new URL(canonicalUrl).pathname)}]`;

const record = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("BROWSER_TARGET_INVALID");
  return value as Record<string, unknown>;
};

const readDocumentUrl = async (browser: BrowserTargetLease): Promise<string> => {
  const value = record(await browser.executeDomIntent({ kind: "document" }));
  if (typeof value.url !== "string") throw new Error("BROWSER_TARGET_INVALID");
  return canonicalConversationUrl(value.url);
};

const findOne = async (browser: BrowserTargetLease, selector: string, textContains?: string): Promise<void> => {
  const value = record(await browser.executeDomIntent({
    kind: "find",
    selector,
    ...(textContains === undefined ? {} : { textContains }),
    maxMatches: 1,
  }));
  if (value.count !== 1) throw new Error("review_required: CHATGPT_TITLE_TARGET_AMBIGUOUS_OR_ABSENT");
};

const readOneText = async (browser: BrowserTargetLease, selector: string): Promise<string> => {
  const value = await browser.executeDomIntent({
    kind: "readText",
    selector,
    expectedMatches: 1,
    maxChars: 256,
  });
  if (typeof value !== "string") throw new Error("BROWSER_TARGET_INVALID");
  return value.trim();
};

const findExactOne = async (browser: BrowserTargetLease, selector: string, textEquals?: string): Promise<void> => {
  const value = record(await browser.executeDomIntent({
    kind: "find",
    selector,
    ...(textEquals === undefined ? {} : { textEquals }),
    maxMatches: 20,
  }));
  if (value.count !== 1) throw new Error("review_required: CHATGPT_TITLE_TARGET_AMBIGUOUS_OR_ABSENT");
};

const recordTitleMutation = async (input: {
  browser: BrowserTargetLease;
  context: AiProviderAdapterContext;
  canonicalUrl: string;
  startedAt: string;
  semantics: readonly string[];
}): Promise<void> => {
  await recordWebChatPageAction({
    browser: input.browser,
    context: input.context,
    actionId: "rename_exact_conversation",
    startedAt: input.startedAt,
    beforeUrl: input.canonicalUrl,
    afterUrl: input.canonicalUrl,
    result: "committed",
    candidateCount: 1,
    semantics: input.semantics,
  });
};

const assertExactConversationState = async (input: {
  browser: BrowserTargetLease;
  canonicalUrl: string;
  turnMarker: string;
  rowSelector: string;
}): Promise<void> => {
  if (await readDocumentUrl(input.browser) !== input.canonicalUrl) {
    throw new Error("review_required: CHATGPT_TITLE_CONVERSATION_IDENTITY_MISMATCH");
  }
  await findOne(input.browser, input.rowSelector);
  await findOne(input.browser, CHATGPT_USER_TURN_SELECTOR, input.turnMarker);
};

type RenameTitleInput = Readonly<{
  browser: BrowserTargetLease;
  context: AiProviderAdapterContext;
  canonicalUrl: string;
  rowSelector: string;
  expectedTitle: string;
  timeoutMs: number;
}>;

const openRenameEditor = async (input: RenameTitleInput): Promise<void> => {
  let startedAt = new Date().toISOString();
  await input.browser.executeDomIntent({
    kind: "click",
    selector: `${input.rowSelector} button[data-trailing-button]`,
    expectedMatches: 1,
  });
  await findExactOne(input.browser, "[role='menuitem']", "重命名");
  await recordTitleMutation({ ...input, startedAt, semantics: ["one exact sidebar row", "rename menu ready"] });
  startedAt = new Date().toISOString();
  await input.browser.executeDomIntent({
    kind: "click",
    selector: "[role='menuitem']",
    expectedTextEquals: "重命名",
    expectedMatches: 1,
  });
  await findExactOne(input.browser, CHATGPT_TITLE_INPUT_SELECTOR);
  await recordTitleMutation({ ...input, startedAt, semantics: ["one rename menu item", "one title input ready"] });
};

const fillRenameTitle = async (input: RenameTitleInput): Promise<void> => {
  const startedAt = new Date().toISOString();
  const fillResult = record(await input.browser.executeDomIntent({
    kind: "fill",
    selector: CHATGPT_TITLE_INPUT_SELECTOR,
    approvedText: input.expectedTitle,
    clearBeforeType: true,
    expectedMatches: 1,
  }));
  if (fillResult.candidateCount !== 1 || fillResult.retainedValueVerified !== true) {
    throw new Error("review_required: CHATGPT_TITLE_INPUT_NOT_RETAINED");
  }
  await recordTitleMutation({ ...input, startedAt, semantics: ["one title input", "exact title retained"] });
};

const commitRenameTitle = async (input: RenameTitleInput): Promise<void> => {
  /** The observed UI commits the inline title when its focus moves to the composer. */
  const startedAt = new Date().toISOString();
  await input.browser.executeDomIntent({
    kind: "click",
    selector: CHATGPT_COMPOSER_SELECTOR,
    expectedMatches: 1,
  });
  const deadline = Date.now() + Math.max(1, input.timeoutMs);
  while (Date.now() < deadline) {
    if (await readOneText(input.browser, input.rowSelector) === input.expectedTitle) {
      await recordTitleMutation({ ...input, startedAt, semantics: ["one composer commit target", "exact sidebar title committed"] });
      return;
    }
    await input.browser.wait({ durationMs: 100 });
  }
  throw new Error("review_required: CHATGPT_TITLE_COMMIT_NOT_CONFIRMED");
};

const renameObservedSidebarRow = async (input: RenameTitleInput): Promise<void> => {
  await openRenameEditor(input);
  await fillRenameTitle(input);
  await commitRenameTitle(input);
};

const buildProof = (input: {
  state: TitleState;
  canonicalUrl: string;
  previousObservedTitle: string;
}): WebChatConversationTitleProof => {
  const verifiedAt = new Date().toISOString();
  const evidence = JSON.stringify({
    policyVersion: input.state.policyVersion,
    sourceMappingVersion: input.state.sourceMappingVersion,
    operatorTimeZone: input.state.operatorTimeZone,
    canonicalConversationUrl: input.canonicalUrl,
    expectedTitleHash: input.state.expectedTitleHash,
    previousObservedTitle: input.previousObservedTitle,
    observedTitle: input.state.expectedTitle,
    verifiedAt,
  });
  const evidenceHash = hash(evidence);
  return {
    proofStatus: "verified",
    owner: input.state.owner,
    policyVersion: input.state.policyVersion,
    sourceMappingVersion: input.state.sourceMappingVersion,
    operatorTimeZone: input.state.operatorTimeZone,
    expectedTitle: input.state.expectedTitle,
    expectedTitleHash: input.state.expectedTitleHash,
    shortTrace: input.state.shortTrace,
    previousObservedTitle: input.previousObservedTitle,
    observedTitle: input.state.expectedTitle,
    canonicalConversationUrl: input.canonicalUrl,
    verifiedAt,
    evidenceRef: `provider-dom-action:chatgpt-title:${evidenceHash.slice(7)}`,
    evidenceHash,
  };
};

const finalizeObservedTitle = async (input: {
  browser: BrowserTargetLease;
  execution: TitleExecution;
  state: TitleState;
  canonicalUrl: string;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
}): Promise<WebChatConversationTitleProof> => {
  const rowSelector = exactSidebarRowSelector(input.canonicalUrl);
  await focusChatGptConversationByCanonicalPath({
    base: input.browser,
    conversationUrl: input.canonicalUrl,
    turnMarker: input.execution.turnMarker,
    timeoutMs: Math.min(input.request.timeoutMs, 15_000),
    context: input.context,
  });
  await assertExactConversationState({
    browser: input.browser,
    canonicalUrl: input.canonicalUrl,
    turnMarker: input.execution.turnMarker,
    rowSelector,
  });
  const previousObservedTitle = await readOneText(input.browser, rowSelector);
  if (previousObservedTitle !== input.state.expectedTitle) {
    await renameObservedSidebarRow({
      browser: input.browser,
      context: input.context,
      canonicalUrl: input.canonicalUrl,
      rowSelector,
      expectedTitle: input.state.expectedTitle,
      timeoutMs: Math.min(input.request.timeoutMs, 15_000),
    });
  }
  await assertExactConversationState({
    browser: input.browser,
    canonicalUrl: input.canonicalUrl,
    turnMarker: input.execution.turnMarker,
    rowSelector,
  });
  const observedTitle = await readOneText(input.browser, rowSelector);
  if (observedTitle !== input.state.expectedTitle) {
    throw new Error("review_required: CHATGPT_TITLE_COMMIT_NOT_CONFIRMED");
  }
  return buildProof({
    state: input.state,
    canonicalUrl: input.canonicalUrl,
    previousObservedTitle,
  });
};

export const finalizeGptWebConversationTitle = async (
  input: FinalizationInput,
): Promise<WebChatConversationTitleProof | null> => {
  const execution = input.context.webChatExecution;
  const state = execution?.conversationTitle ?? null;
  if (input.request.providerKind !== "gpt-web-chat" || !execution || !state) return null;
  const canonicalUrl = input.submission.canonicalConversationUrl;
  if (!canonicalUrl) throw new Error("WEB_CHAT_TITLE_FINALIZATION_NOT_READY:canonical conversation unavailable");
  const exactCanonicalUrl = canonicalConversationUrl(canonicalUrl);
  const startedAt = new Date().toISOString();
  await execution.onConversationTitleFinalizationStarted(exactCanonicalUrl);
  const proof = await execution.runExclusivePatrol((browser) => finalizeObservedTitle({
    browser,
    execution,
    state,
    canonicalUrl: exactCanonicalUrl,
    request: input.request,
    context: input.context,
  }));
  await execution.onConversationTitleVerified(proof);
  await recordWebChatPageAction({
    browser: input.browser,
    context: input.context,
    actionId: "verify_exact_conversation_title",
    startedAt,
    beforeUrl: exactCanonicalUrl,
    afterUrl: exactCanonicalUrl,
    result: proof.previousObservedTitle === proof.expectedTitle ? "no_op" : "committed",
    candidateCount: 1,
    semantics: [proof.policyVersion, proof.expectedTitleHash],
  });
  return proof;
};
