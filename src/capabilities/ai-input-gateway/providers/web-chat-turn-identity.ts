import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import type {
  AiProviderAdapterContext,
  WebChatSubmissionProof,
} from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";

const CHATGPT_USER_TURN_SELECTOR = "[data-testid^='conversation-turn-'][data-turn='user']";

const record = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("BROWSER_TARGET_INVALID");
  return value as Record<string, unknown>;
};

const documentUrl = async (browser: BrowserTargetLease): Promise<string> => {
  const result = record(await browser.executeDomIntent({ kind: "document" }));
  if (typeof result.url !== "string") throw new Error("BROWSER_TARGET_INVALID");
  return result.url;
};

const count = async (browser: BrowserTargetLease, selector: string, maxMatches: number, textContains?: string): Promise<number> => {
  const result = record(await browser.executeDomIntent({
    kind: "find",
    selector,
    maxMatches,
    ...(textContains === undefined ? {} : { textContains }),
  }));
  if (typeof result.count !== "number" || !Number.isInteger(result.count)) throw new Error("BROWSER_TARGET_INVALID");
  return result.count;
};

const readTurnId = async (browser: BrowserTargetLease, prompt: string): Promise<string> => {
  const result = await browser.executeDomIntent({
    kind: "readAttribute",
    selector: CHATGPT_USER_TURN_SELECTOR,
    name: "data-testid",
    textContains: prompt,
    expectedMatches: 1,
    maxChars: 128,
  });
  if (typeof result !== "string" || !/^conversation-turn-[1-9][0-9]*$/u.test(result)) {
    throw new Error("BROWSER_TARGET_INVALID");
  }
  return result;
};

const isCanonicalConversationUrl = (pageUrl: string): boolean => {
  const parsed = new URL(pageUrl);
  return parsed.protocol === "https:" && parsed.host === "chatgpt.com" && /^\/c\/(?!WEB:)[^/]+$/u.test(parsed.pathname);
};

type SubmissionCaptureInput = {
  browser: BrowserTargetLease;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
  previousAssistantCount: number;
  previousUserMessageCount: number;
  initialConversationUrl?: string;
  requireCanonical?: boolean;
};

const assertFreshConversationBinding = (
  input: SubmissionCaptureInput,
  pageUrl: string,
  userTurnCount: number,
): void => {
  if (input.request.providerContinuationRef || input.request.providerForkRef) return;
  if (input.previousUserMessageCount === 0 && userTurnCount === 1) return;
  throw new Error(
    `WEB_CHAT_FRESH_CONVERSATION_REBOUND: previous=${input.previousUserMessageCount}; actual=${userTurnCount}; pageUrl=${pageUrl}`,
  );
};

const assertContinuationBinding = (input: SubmissionCaptureInput, pageUrl: string): void => {
  const continuation = input.request.providerContinuationRef;
  if (!continuation) return;
  const expected = new URL(continuation.providerPageUrl);
  const actual = new URL(pageUrl);
  if (expected.origin !== actual.origin || expected.pathname !== actual.pathname) {
    throw new Error(`WEB_CHAT_CONTINUATION_CONVERSATION_DRIFT: expected=${expected.href}; actual=${actual.href}`);
  }
};

const buildSubmissionProof = async (input: SubmissionCaptureInput, execution: NonNullable<AiProviderAdapterContext["webChatExecution"]>, transientConversationUrl: string | null, pageUrl: string, canonical: boolean): Promise<WebChatSubmissionProof> => ({
  executionId: execution.executionId,
  turnMarker: execution.turnMarker,
  transientConversationUrl: transientConversationUrl ?? pageUrl,
  canonicalConversationUrl: canonical ? pageUrl : null,
  userTurnId: await readTurnId(input.browser, input.request.textPrompt),
  previousAssistantCount: input.previousAssistantCount,
  previousUserMessageCount: input.previousUserMessageCount,
  submittedAt: new Date().toISOString(),
});

const captureStableSubmissionProof = async (
  input: SubmissionCaptureInput,
  execution: NonNullable<AiProviderAdapterContext["webChatExecution"]>,
): Promise<WebChatSubmissionProof> => {
  const deadline = Date.now() + (input.requireCanonical ? 120_000 : 10_000);
  let transientConversationUrl = input.initialConversationUrl ?? null;
  let lastPageUrl = "unknown";
  while (Date.now() < deadline) {
    const pageUrl = await documentUrl(input.browser);
    lastPageUrl = pageUrl;
    transientConversationUrl ??= pageUrl;
    const userTurnCount = await count(input.browser, CHATGPT_USER_TURN_SELECTOR, 20);
    const exactCount = await count(input.browser, CHATGPT_USER_TURN_SELECTOR, 1, input.request.textPrompt);
    if (exactCount === 1) {
      assertFreshConversationBinding(input, pageUrl, userTurnCount);
      const canonical = isCanonicalConversationUrl(pageUrl);
      assertContinuationBinding(input, pageUrl);
      if (input.requireCanonical && !canonical) {
        await input.browser.wait({ durationMs: 250 });
        continue;
      }
      return buildSubmissionProof(input, execution, transientConversationUrl, pageUrl, canonical);
    }
    await input.browser.wait({ durationMs: 250 });
  }
  throw new Error(`review_required: submitted web-chat turn identity did not stabilize; requireCanonical=${String(input.requireCanonical === true)}; pageUrl=${lastPageUrl}`);
};

export const captureWebChatSubmissionProof = async (input: SubmissionCaptureInput): Promise<WebChatSubmissionProof> => {
  if (input.request.providerKind !== "gpt-web-chat") {
    throw new Error("review_required: NOT_PRODUCTION_VERIFIED: Gemini submission DOM is not observed");
  }
  const execution = input.context.webChatExecution;
  if (!execution) throw new Error("review_required: web-chat execution identity is unavailable after submit");
  return captureStableSubmissionProof(input, execution);
};
