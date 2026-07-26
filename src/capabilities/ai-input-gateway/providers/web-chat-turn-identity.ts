import type { BrowserController } from "../../../lib/browser/browser-controller.js";
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
};

const observationScript = (turnMarker: string): string => `
const marker = ${JSON.stringify(turnMarker)};
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
const matches = turns.filter((turn) => turn.text.includes(marker));
if (matches.length > 1) {
  return {
    status: "review_required",
    message: "WEB_CHAT_TURN_MARKER_AMBIGUOUS",
    pageUrl: location.href,
    userTurnId: null,
    matchingUserTurnCount: matches.length,
  };
}
if (matches.length === 0) {
  return {
    status: "pending",
    message: "waiting for internally marked user turn",
    pageUrl: location.href,
    userTurnId: null,
    matchingUserTurnCount: 0,
  };
}
return {
  status: "success",
  message: "internally marked user turn found",
  pageUrl: location.href,
  userTurnId: matches[0].id,
  matchingUserTurnCount: 1,
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

export const captureWebChatSubmissionProof = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
  previousAssistantCount: number;
  previousUserMessageCount: number;
  requireCanonical?: boolean;
}): Promise<WebChatSubmissionProof> => {
  const execution = input.context.webChatExecution;
  if (!execution) throw new Error("review_required: web-chat execution identity is unavailable after submit.");
  const deadline = Date.now() + (input.requireCanonical ? 120_000 : 10_000);
  let transientConversationUrl: string | null = null;
  let last: TurnIdentityObservation | null = null;
  while (Date.now() < deadline) {
    last = await input.browser.evaluateActiveTab<TurnIdentityObservation>({
      description: "bind submitted web-chat turn to its internal marker and canonical conversation",
      script: observationScript(execution.turnMarker),
      ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
    });
    transientConversationUrl ??= last.pageUrl;
    if (last.status === "review_required") {
      throw new Error(`review_required: ${last.message}`);
    }
    if (last.status === "success" && last.userTurnId) {
      const canonical = isCanonicalConversationUrl(input.request, last.pageUrl);
      if (input.requireCanonical && !canonical) {
        await input.browser.wait(250);
        continue;
      }
      return {
        transientConversationUrl,
        canonicalConversationUrl: canonical ? last.pageUrl : null,
        systemChatTitle: null,
        observedAutoChatTitle: null,
        chatTitleVerifiedAt: null,
        userTurnId: last.userTurnId,
        previousAssistantCount: input.previousAssistantCount,
        previousUserMessageCount: input.previousUserMessageCount,
        submittedAt: new Date().toISOString(),
      };
    }
    await input.browser.wait(250);
  }
  throw new Error(
    `review_required: submitted web-chat turn identity did not stabilize; requireCanonical=${String(input.requireCanonical === true)}; last=${last?.message ?? "none"}; pageUrl=${last?.pageUrl ?? "unknown"}`,
  );
};
