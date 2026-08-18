import type { BrowserTargetSession } from "../../../lib/browser/browser-controller.js";
import type {
  AiProviderAdapterContext,
  WebChatSubmissionProof,
} from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";

type TurnIdentityObservation = {
  status: "success" | "pending" | "review_required";
  message: string;
  pageUrl: string;
  userTurnId: string | null;
  matchingUserTurnCount: number;
  userTurnCount: number;
};

const observationScript = (promptText: string): string => `
const expectedPrompt = String(${JSON.stringify(promptText)} || "").replace(/\\s+/gu, " ").trim();
const visible = (node) => {
  if (!(node instanceof Element)) return false;
  const style = getComputedStyle(node);
  const rect = node.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
};
const text = (node) => (node instanceof HTMLElement ? node.innerText : node?.textContent || "")
  .replace(/\\s+/gu, " ")
  .trim();
const chatGptTurns = Array.from(document.querySelectorAll("[data-message-author-role='user']"))
  .filter(visible)
  .map((node, index) => ({
    node,
    id: node.closest("[data-testid^='conversation-turn-']")?.getAttribute("data-testid")
      || node.getAttribute("data-testid")
      || "chatgpt-user-" + String(index + 1),
    text: text(node),
  }));
const geminiCandidates = Array.from(document.querySelectorAll("user-query, user-query-content, .user-query-container"))
  .filter(visible)
  .filter((node) => text(node).length > 0);
const geminiTurns = geminiCandidates
  .filter((node) => !geminiCandidates.some((other) => other !== node && other.contains(node)))
  .map((node, index) => ({
    node,
    id: node.getAttribute("data-test-id") || node.id || "gemini-user-" + String(index + 1),
    text: text(node),
  }));
const turns = chatGptTurns.length > 0 ? chatGptTurns : geminiTurns;
const matches = turns.filter((turn) => turn.text === expectedPrompt);
if (matches.length > 1) {
  return {
    status: "review_required",
    message: "WEB_CHAT_PROMPT_IDENTITY_AMBIGUOUS",
    pageUrl: location.href,
    userTurnId: null,
    matchingUserTurnCount: matches.length,
    userTurnCount: turns.length,
  };
}
if (matches.length === 0) {
  return {
    status: "pending",
    message: "waiting for exact submitted user prompt",
    pageUrl: location.href,
    userTurnId: null,
    matchingUserTurnCount: 0,
    userTurnCount: turns.length,
  };
}
return {
  status: "success",
  message: "exact submitted user prompt found",
  pageUrl: location.href,
  userTurnId: matches[0].id,
  matchingUserTurnCount: 1,
  userTurnCount: turns.length,
};
`;

const isCanonicalConversationUrl = (request: AiFeedInput, pageUrl: string): boolean => {
  const parsed = new URL(pageUrl);
  if (request.providerKind === "gpt-web-chat") {
    return parsed.host === "chatgpt.com"
      && /^\/c\/(?!WEB:)[^/]+$/u.test(parsed.pathname);
  }
  return parsed.host === "gemini.google.com" && parsed.pathname.startsWith("/app/");
};

const assertFreshConversationTurn = (input: {
  request: AiFeedInput;
  previousUserMessageCount: number;
}, observation: TurnIdentityObservation): void => {
  if (
    input.request.providerKind !== "gpt-web-chat"
    || input.request.providerContinuationRef
    || input.request.providerForkRef
  ) return;
  if (
    input.previousUserMessageCount === 0
    && observation.userTurnCount === 1
  ) return;
  throw new Error(
    "WEB_CHAT_FRESH_CONVERSATION_REBOUND: "
    + `previous=${input.previousUserMessageCount}; `
    + `actual=${observation.userTurnCount}; `
    + `pageUrl=${observation.pageUrl}`,
  );
};

const assertContinuationConversation = (
  request: AiFeedInput,
  pageUrl: string,
  canonical: boolean,
): void => {
  if (!canonical || !request.providerContinuationRef) return;
  const expected = new URL(
    request.providerContinuationRef.providerPageUrl,
  );
  const actual = new URL(pageUrl);
  if (
    expected.origin === actual.origin
    && expected.pathname === actual.pathname
  ) return;
  throw new Error(
    "WEB_CHAT_CONTINUATION_CONVERSATION_DRIFT: "
    + `expected=${expected.href}; actual=${actual.href}`,
  );
};

const buildSubmissionProof = (input: {
  executionId: string;
  turnMarker: string;
  observation: TurnIdentityObservation & { userTurnId: string };
  transientConversationUrl: string;
  canonical: boolean;
  previousAssistantCount: number;
  previousUserMessageCount: number;
}): WebChatSubmissionProof => ({
  executionId: input.executionId,
  turnMarker: input.turnMarker,
  transientConversationUrl: input.transientConversationUrl,
  canonicalConversationUrl: input.canonical
    ? input.observation.pageUrl
    : null,
  userTurnId: input.observation.userTurnId,
  previousAssistantCount: input.previousAssistantCount,
  previousUserMessageCount: input.previousUserMessageCount,
  submittedAt: new Date().toISOString(),
});

export const captureWebChatSubmissionProof = async (input: {
  browser: BrowserTargetSession;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
  previousAssistantCount: number;
  previousUserMessageCount: number;
  initialConversationUrl?: string;
  requireCanonical?: boolean;
}): Promise<WebChatSubmissionProof> => {
  const execution = input.context.webChatExecution;
  if (!execution) throw new Error("review_required: web-chat execution identity is unavailable after submit.");
  const deadline = Date.now() + (input.requireCanonical ? 120_000 : 10_000);
  let transientConversationUrl: string | null =
    input.initialConversationUrl ?? null;
  let last: TurnIdentityObservation | null = null;
  while (Date.now() < deadline) {
    last = await input.browser.evaluate<TurnIdentityObservation>({
      description: "bind submitted web-chat turn to its exact clean prompt and canonical conversation",
      script: observationScript(input.request.textPrompt),
      ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
    });
    transientConversationUrl ??= last.pageUrl;
    if (last.status === "review_required") {
      throw new Error(`review_required: ${last.message}`);
    }
    if (last.status === "success" && last.userTurnId) {
      assertFreshConversationTurn(input, last);
      const canonical = isCanonicalConversationUrl(input.request, last.pageUrl);
      assertContinuationConversation(input.request, last.pageUrl, canonical);
      if (input.requireCanonical && !canonical) {
        await input.browser.wait(250);
        continue;
      }
      return buildSubmissionProof({
        executionId: execution.executionId,
        turnMarker: execution.turnMarker,
        observation: { ...last, userTurnId: last.userTurnId },
        transientConversationUrl: transientConversationUrl ?? last.pageUrl,
        canonical,
        previousAssistantCount: input.previousAssistantCount,
        previousUserMessageCount: input.previousUserMessageCount,
      });
    }
    await input.browser.wait(250);
  }
  throw new Error(
    `review_required: submitted web-chat turn identity did not stabilize; requireCanonical=${String(input.requireCanonical === true)}; last=${last?.message ?? "none"}; pageUrl=${last?.pageUrl ?? "unknown"}`,
  );
};
