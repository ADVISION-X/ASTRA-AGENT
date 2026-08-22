import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import type { AiProviderAdapterContext, WebChatSubmissionProof } from "../contracts/ai-provider-adapter.contract.js";
import { discoverChatGptConversationViaSearch } from "../providers/gpt-web-conversation-discovery.js";
import { recordWebChatPageAction } from "../providers/web-chat-page-action-contract.js";

/**
 * Canonical routing may observe, click one predeclared row, or use the one
 * bounded Search chats fallback after the exact row is absent. It cannot open
 * a second tab, select an active tab, execute a page script or revive a
 * retired controller interface.
 */
type WebChatRoutingBrowser = Pick<BrowserTargetLease, "executeDomIntent" | "wait" | "navigate">;

const isFullBrowserLease = (browser: WebChatRoutingBrowser): browser is BrowserTargetLease =>
  "target" in browser && "document" in browser && "resolvePendingMutation" in browser;

const CHATGPT_USER_TURN_SELECTOR = "[data-testid^='conversation-turn-'][data-turn='user']";

const countFrom = (value: unknown): number => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("BROWSER_TARGET_INVALID");
  const count = (value as { count?: unknown }).count;
  if (typeof count !== "number" || !Number.isInteger(count) || count < 0) throw new Error("BROWSER_TARGET_INVALID");
  return count;
};

const canonicalPathFor = (conversationUrl: string): string => {
  const path = new URL(conversationUrl).pathname;
  if (!/^\/c\/(?!WEB:)[^/]+$/u.test(path)) {
    throw new Error(`WEB_CHAT_BOUND_CONVERSATION_NOT_READY: canonical ChatGPT path is unavailable; url=${conversationUrl}`);
  }
  return path;
};

const canonicalRouteSelector = (path: string): string => `a[href=${JSON.stringify(path)}]`;

const currentPath = async (browser: WebChatRoutingBrowser): Promise<string> => {
  const value = await browser.executeDomIntent({ kind: "document" });
  if (typeof value !== "object" || value === null || Array.isArray(value)
    || typeof (value as { url?: unknown }).url !== "string") throw new Error("BROWSER_TARGET_INVALID");
  const url = new URL((value as { url: string }).url);
  return url.origin === "https://chatgpt.com" ? url.pathname : "";
};

const observeOne = async (input: {
  browser: WebChatRoutingBrowser;
  selector: string;
  textContains?: string;
  absentReason: string;
  ambiguousReason: string;
}): Promise<void> => {
  try {
    const count = countFrom(await input.browser.executeDomIntent({
      kind: "find",
      selector: input.selector,
      ...(input.textContains === undefined ? {} : { textContains: input.textContains }),
      maxMatches: 1,
    }));
    if (count === 0) throw new Error(input.absentReason);
  } catch (error) {
    if (error instanceof Error && error.message === input.absentReason) throw error;
    throw new Error(`review_required: ${input.ambiguousReason}`);
  }
};

const clickOne = async (input: {
  browser: WebChatRoutingBrowser;
  selector: string;
  expectedText?: string;
  description: string;
}): Promise<void> => {
  try {
    await input.browser.executeDomIntent({
      kind: "click",
      selector: input.selector,
      ...(input.expectedText === undefined ? {} : { expectedText: input.expectedText }),
      expectedMatches: 1,
    });
  } catch {
    throw new Error(`review_required: ${input.description} is absent or ambiguous`);
  }
};

const verifyCanonicalMarker = async (input: {
  browser: WebChatRoutingBrowser;
  turnMarker: string;
}): Promise<void> => observeOne({
  browser: input.browser,
  selector: CHATGPT_USER_TURN_SELECTOR,
  textContains: input.turnMarker,
  absentReason: "WEB_CHAT_BOUND_CONVERSATION_NOT_READY: exact canonical ChatGPT marker is not materialized",
  ambiguousReason: "CHATGPT_CANONICAL_CONVERSATION_IDENTITY_AMBIGUOUS",
});

type CanonicalRouteInput = Readonly<{
  base: WebChatRoutingBrowser;
  conversationUrl: string;
  turnMarker?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  context?: AiProviderAdapterContext;
}>;

const waitForSidebarRow = async (
  input: CanonicalRouteInput,
  selector: string,
  deadline: number,
): Promise<boolean> => {
  while (Date.now() < deadline) {
    if (input.signal?.aborted) throw new Error("BROWSER_TARGET_INVALID");
    try {
      await observeOne({
        browser: input.base, selector,
        absentReason: "WEB_CHAT_BOUND_CONVERSATION_NOT_READY: exact canonical ChatGPT sidebar row is not materialized",
        ambiguousReason: "CHATGPT_CANONICAL_CONVERSATION_IDENTITY_AMBIGUOUS",
      });
      return true;
    } catch (error) {
      const failure = error instanceof Error ? error : new Error("WEB_CHAT_BOUND_CONVERSATION_NOT_READY");
      if (!failure.message.includes("WEB_CHAT_BOUND_CONVERSATION_NOT_READY")) throw failure;
      await input.base.wait({ durationMs: 100 });
    }
  }
  return false;
};

const discoverCanonicalRoute = async (input: CanonicalRouteInput): Promise<void> => {
  if (!input.turnMarker) throw new Error(
    "WEB_CHAT_BOUND_CONVERSATION_NOT_READY: Search chats fallback requires the exact turn marker",
  );
  if (!isFullBrowserLease(input.base)) throw new Error("BROWSER_TARGET_INVALID");
  await discoverChatGptConversationViaSearch({
    browser: input.base, canonicalConversationUrl: input.conversationUrl,
    turnMarker: input.turnMarker, timeoutMs: Math.min(input.timeoutMs ?? 15_000, 15_000),
    ...(input.context ? { context: input.context } : {}),
  });
};

const commitCanonicalRoute = async (
  input: CanonicalRouteInput,
  targetPath: string,
  selector: string,
  deadline: number,
): Promise<void> => {
  const startedAt = new Date().toISOString();
  await clickOne({ browser: input.base, selector, description: "exact canonical ChatGPT sidebar row" });
  while (Date.now() < deadline) {
    if (await currentPath(input.base) !== targetPath) {
      await input.base.wait({ durationMs: 100 });
      continue;
    }
    if (input.turnMarker) await verifyCanonicalMarker({ browser: input.base, turnMarker: input.turnMarker });
    if (input.context && isFullBrowserLease(input.base)) await recordWebChatPageAction({
      browser: input.base, context: input.context, actionId: "switch_exact_conversation", startedAt,
      beforeUrl: null, afterUrl: input.conversationUrl, result: "committed", candidateCount: 1,
      semantics: [targetPath, ...(input.turnMarker ? [input.turnMarker] : [])], allowDocumentChange: true,
    });
    return;
  }
  throw new Error("WEB_CHAT_BOUND_CONVERSATION_NOT_READY: exact canonical ChatGPT route did not commit");
};

/**
 * Normal recovery stays in the one already leased physical provider tab. A
 * persisted canonical path may select only one exact sidebar row. If that row
 * remains absent through the bounded observation window, the exact Search
 * chats dialog is the sole discovery fallback and must re-prove the canonical
 * path plus marker before returning.
 */
export const focusChatGptConversationByCanonicalPath = async (input: CanonicalRouteInput): Promise<void> => {
  const targetPath = canonicalPathFor(input.conversationUrl);
  const deadline = Date.now() + Math.max(1, Math.min(input.timeoutMs ?? 15_000, 15_000));
  const selector = canonicalRouteSelector(targetPath);
  if (await currentPath(input.base) === targetPath) {
    if (input.turnMarker) await verifyCanonicalMarker({ browser: input.base, turnMarker: input.turnMarker });
    return;
  }
  if (!(await waitForSidebarRow(input, selector, deadline))) return discoverCanonicalRoute(input);
  await commitCanonicalRoute(input, targetPath, selector, deadline);
};

const focusGeminiConversation = async (input: {
  base: WebChatRoutingBrowser;
  submission: WebChatSubmissionProof;
  turnMarker: string;
}): Promise<void> => {
  const targetUrl = input.submission.canonicalConversationUrl ?? input.submission.transientConversationUrl;
  await input.base.navigate({ url: targetUrl, title: "resume exact Gemini conversation" });
  await observeOne({
    browser: input.base,
    selector: "user-query,user-query-content,.user-query-container",
    textContains: input.turnMarker,
    absentReason: "WEB_CHAT_BOUND_CONVERSATION_NOT_READY: exact Gemini marker is not materialized",
    ambiguousReason: "GEMINI_CANONICAL_CONVERSATION_IDENTITY_AMBIGUOUS",
  });
};

export const focusBoundWebChatConversation = async (input: {
  base: WebChatRoutingBrowser;
  providerKind: "gpt-web-chat" | "gemini-web-chat";
  submission: WebChatSubmissionProof;
  turnMarker: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  context?: AiProviderAdapterContext;
}): Promise<void> => {
  if (input.providerKind === "gpt-web-chat") {
    await focusChatGptConversationByCanonicalPath({
      base: input.base,
      conversationUrl: input.submission.canonicalConversationUrl ?? input.submission.transientConversationUrl,
      turnMarker: input.turnMarker,
      ...(input.timeoutMs === undefined ? {} : { timeoutMs: input.timeoutMs }),
      ...(input.signal === undefined ? {} : { signal: input.signal }),
      ...(input.context === undefined ? {} : { context: input.context }),
    });
    return;
  }
  await focusGeminiConversation(input);
};
