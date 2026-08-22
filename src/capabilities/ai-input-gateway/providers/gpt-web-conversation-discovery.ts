import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import type { AiProviderAdapterContext, WebChatPageActionId } from "../contracts/ai-provider-adapter.contract.js";
import { recordWebChatPageAction } from "./web-chat-page-action-contract.js";

type DiscoveryInput = Readonly<{
  browser: BrowserTargetLease;
  canonicalConversationUrl: string;
  turnMarker: string;
  timeoutMs?: number;
  context?: AiProviderAdapterContext;
}>;

const CHATGPT_SEARCH_BUTTON_SELECTOR = 'button[aria-label="搜索聊天"]';
const CHATGPT_SEARCH_DIALOG_SELECTOR = 'div[role="dialog"]';
const CHATGPT_SEARCH_INPUT_SELECTOR = 'div[role="dialog"] input[placeholder="搜索聊天…"]';
const CHATGPT_SEARCH_RESULT_SELECTOR = 'div[role="dialog"] a[href^="/c/"]';
const CHATGPT_SEARCH_CLOSE_SELECTOR = 'div[role="dialog"] button[aria-label="关闭"]';
const CHATGPT_USER_TURN_SELECTOR = "[data-testid^='conversation-turn-'][data-turn='user']";

const count = async (browser: DiscoveryInput["browser"], input: {
  selector?: string;
  locator?: { role: string };
  textContains?: string;
  maxMatches: number;
}): Promise<number> => {
  const value = await browser.executeDomIntent({
    kind: "find",
    ...(input.selector === undefined ? {} : { selector: input.selector }),
    ...(input.locator === undefined ? {} : { locator: input.locator }),
    ...(input.textContains === undefined ? {} : { textContains: input.textContains }),
    maxMatches: input.maxMatches,
  });
  if (typeof value !== "object" || value === null || Array.isArray(value)
    || typeof (value as { count?: unknown }).count !== "number") {
    throw new Error("BROWSER_TARGET_INVALID");
  }
  return (value as { count: number }).count;
};

const readAttribute = async (browser: DiscoveryInput["browser"], marker: string): Promise<string> => {
  const value = await browser.executeDomIntent({
    kind: "readAttribute",
    selector: CHATGPT_SEARCH_RESULT_SELECTOR,
    name: "href",
    textContains: marker,
    expectedMatches: 1,
    maxChars: 4_096,
  });
  if (typeof value !== "string" || value.length === 0) throw new Error("BROWSER_TARGET_INVALID");
  return value;
};

const documentUrl = async (browser: DiscoveryInput["browser"]): Promise<string> => {
  const value = await browser.executeDomIntent({ kind: "document" });
  if (typeof value !== "object" || value === null || Array.isArray(value)
    || typeof (value as { url?: unknown }).url !== "string") throw new Error("BROWSER_TARGET_INVALID");
  return (value as { url: string }).url;
};

const recordMutation = async (input: DiscoveryInput, actionId: WebChatPageActionId, startedAt: string, semantics: readonly string[]): Promise<void> => {
  if (!input.context) return;
  await recordWebChatPageAction({
    browser: input.browser,
    context: input.context,
    actionId,
    startedAt,
    beforeUrl: null,
    afterUrl: null,
    result: "committed",
    candidateCount: 1,
    semantics,
    allowDocumentChange: actionId === "discover_conversation_via_search",
  });
};

const closeSearchDialog = async (input: DiscoveryInput): Promise<void> => {
  const browser = input.browser;
  const dialogCount = await count(browser, { selector: CHATGPT_SEARCH_DIALOG_SELECTOR, maxMatches: 1 });
  if (dialogCount === 0) return;
  if (dialogCount !== 1 || await count(browser, { selector: CHATGPT_SEARCH_CLOSE_SELECTOR, maxMatches: 1 }) !== 1) {
    throw new Error("review_required: CHATGPT_SEARCH_DIALOG_CLOSE_AMBIGUOUS");
  }
  const startedAt = new Date().toISOString();
  await browser.executeDomIntent({
    kind: "click",
    selector: CHATGPT_SEARCH_CLOSE_SELECTOR,
    expectedMatches: 1,
  });
  if (await count(browser, { selector: CHATGPT_SEARCH_DIALOG_SELECTOR, maxMatches: 1 }) !== 0) {
    throw new Error("review_required: CHATGPT_SEARCH_DIALOG_CLOSE_UNCONFIRMED");
  }
  await recordMutation(input, "cleanup_owned_transient_ui", startedAt, ["one search dialog closed"]);
};

const resolveCanonicalTarget = (input: DiscoveryInput): { targetPath: string; deadline: number } => {
  const target = new URL(input.canonicalConversationUrl);
  if (target.protocol !== "https:" || target.host !== "chatgpt.com"
    || !/^\/c\/(?!WEB:)[^/]+$/u.test(target.pathname)) {
    throw new Error("WEB_CHAT_BOUND_CONVERSATION_NOT_READY: canonical ChatGPT path is unavailable");
  }
  return {
    targetPath: target.pathname,
    deadline: Date.now() + Math.max(1_000, Math.min(input.timeoutMs ?? 15_000, 15_000)),
  };
};

const openSearchDialog = async (input: DiscoveryInput): Promise<string | null> => {
  if (await count(input.browser, { selector: CHATGPT_SEARCH_DIALOG_SELECTOR, maxMatches: 1 }) === 1) return null;
  if (await count(input.browser, { selector: CHATGPT_SEARCH_BUTTON_SELECTOR, maxMatches: 1 }) !== 1) {
    throw new Error("review_required: CHATGPT_SEARCH_CONTROL_AMBIGUOUS");
  }
  const startedAt = new Date().toISOString();
  await input.browser.executeDomIntent({
    kind: "click",
    selector: CHATGPT_SEARCH_BUTTON_SELECTOR,
    expectedMatches: 1,
  });
  return startedAt;
};

const waitForSearchInput = async (input: DiscoveryInput, deadline: number, openStartedAt: string | null): Promise<void> => {
  while (Date.now() < deadline) {
    if (await count(input.browser, { selector: CHATGPT_SEARCH_DIALOG_SELECTOR, maxMatches: 1 }) !== 1) {
      await input.browser.wait({ durationMs: 100 });
      continue;
    }
    if (await count(input.browser, { selector: CHATGPT_SEARCH_INPUT_SELECTOR, maxMatches: 1 }) !== 1) {
      await input.browser.wait({ durationMs: 100 });
      continue;
    }
    if (openStartedAt) {
      await recordMutation(input, "discover_conversation_via_search", openStartedAt, ["one search control", "one search dialog and input ready"]);
    }
    const startedAt = new Date().toISOString();
    const result = await input.browser.executeDomIntent({
      kind: "fill",
      selector: CHATGPT_SEARCH_INPUT_SELECTOR,
      approvedText: input.turnMarker,
      clearBeforeType: true,
      expectedMatches: 1,
    });
    if (typeof result !== "object" || result === null || Array.isArray(result)
      || (result as { candidateCount?: unknown }).candidateCount !== 1
      || (result as { retainedValueVerified?: unknown }).retainedValueVerified !== true) {
      throw new Error("BROWSER_TARGET_INVALID");
    }
    await recordMutation(input, "discover_conversation_via_search", startedAt, ["one search input", "exact marker retained"]);
    return;
  }
  throw new Error("WEB_CHAT_BOUND_CONVERSATION_NOT_READY: Search chats dialog did not become ready");
};

const selectSearchResult = async (
  input: DiscoveryInput,
  targetPath: string,
  deadline: number,
): Promise<void> => {
  while (Date.now() < deadline) {
    const resultCount = await count(input.browser, {
      selector: CHATGPT_SEARCH_RESULT_SELECTOR,
      textContains: input.turnMarker,
      maxMatches: 20,
    });
    if (resultCount === 0) {
      await input.browser.wait({ durationMs: 100 });
      continue;
    }
    if (resultCount !== 1) throw new Error("review_required: CHATGPT_SEARCH_RESULT_AMBIGUOUS");
    const href = new URL(await readAttribute(input.browser, input.turnMarker), await documentUrl(input.browser));
    if (href.origin !== "https://chatgpt.com" || href.pathname !== targetPath) {
      throw new Error("review_required: CHATGPT_SEARCH_RESULT_CANONICAL_PATH_MISMATCH");
    }
    const startedAt = new Date().toISOString();
    await input.browser.executeDomIntent({
      kind: "click",
      selector: CHATGPT_SEARCH_RESULT_SELECTOR,
      expectedText: input.turnMarker,
      expectedMatches: 1,
    });
    if (await count(input.browser, { selector: CHATGPT_SEARCH_DIALOG_SELECTOR, maxMatches: 1 }) !== 0) {
      throw new Error("review_required: CHATGPT_SEARCH_DIALOG_CLOSE_UNCONFIRMED");
    }
    const actualUrl = new URL(await documentUrl(input.browser));
    if (actualUrl.origin !== "https://chatgpt.com" || actualUrl.pathname !== targetPath) {
      throw new Error("review_required: CHATGPT_SEARCH_RESULT_NAVIGATION_MISMATCH");
    }
    const markerCount = await count(input.browser, {
      selector: CHATGPT_USER_TURN_SELECTOR,
      textContains: input.turnMarker,
      maxMatches: 20,
    });
    if (markerCount !== 1) throw new Error("review_required: CHATGPT_SEARCH_RESULT_MARKER_AMBIGUOUS");
    await recordMutation(input, "discover_conversation_via_search", startedAt, [targetPath, input.turnMarker, "one canonical result"]);
    return;
  }
  throw new Error("WEB_CHAT_BOUND_CONVERSATION_NOT_READY: exact Search chats result did not materialize");
};

export const discoverChatGptConversationViaSearch = async (
  input: DiscoveryInput,
): Promise<void> => {
  const { targetPath, deadline } = resolveCanonicalTarget(input);
  let dialogOpen = false;
  try {
    const openStartedAt = await openSearchDialog(input);
    dialogOpen = true;
    await waitForSearchInput(input, deadline, openStartedAt);
    await selectSearchResult(input, targetPath, deadline);
  } finally {
    if (dialogOpen && await count(input.browser, { selector: CHATGPT_SEARCH_DIALOG_SELECTOR, maxMatches: 1 }) !== 0) {
      await closeSearchDialog(input);
    }
  }
};
