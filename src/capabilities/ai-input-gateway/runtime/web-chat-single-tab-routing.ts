import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { WebChatSubmissionProof } from "../contracts/ai-provider-adapter.contract.js";

type ConversationTarget = {
  status: "focused" | "click_title" | "ack_rate_limit" | "open_search" | "review_required";
  message: string;
  pageUrl: string;
  markerCount: number;
  titleCount: number;
  targetPoint?: { x: number; y: number };
};

type SearchTarget = {
  status: "success" | "pending" | "review_required";
  message: string;
  pageUrl: string;
  targetPoint?: { x: number; y: number };
};

const CONVERSATION_TARGET_SCRIPT = `
const visible = (node) => {
  if (!(node instanceof Element)) return false;
  const rect = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
};
const normalized = (value) => String(value || "").replace(/\\s+/gu, " ").trim();
const markerCount = Array.from(document.querySelectorAll("[data-message-author-role='user']"))
  .filter((node) => normalized(node.textContent).includes(marker))
  .length;
const titleLinks = Array.from(document.querySelectorAll("a[href]"))
  .filter((link) =>
    visible(link)
    && (link.getAttribute("href") || "").includes("/c/")
    && normalized(link.textContent) === expectedTitle
  );
const currentPathMatches = titleLinks.length === 1
  && new URL(titleLinks[0].href, location.href).pathname === location.pathname;
if (markerCount === 1 && currentPathMatches) {
  return {
    status: "focused",
    message: "exact named ChatGPT conversation path and marker are focused",
    pageUrl: location.href,
    markerCount,
    titleCount: titleLinks.length,
  };
}
if (markerCount > 1 || titleLinks.length > 1) {
  return {
    status: "review_required",
    message: "CHATGPT_NAMED_CONVERSATION_IDENTITY_AMBIGUOUS",
    pageUrl: location.href,
    markerCount,
    titleCount: titleLinks.length,
  };
}
if (titleLinks.length === 1) {
  const rect = titleLinks[0].getBoundingClientRect();
  return {
    status: "click_title",
    message: "exact system-renamed ChatGPT conversation located",
    pageUrl: location.href,
    markerCount,
    titleCount: 1,
    targetPoint: {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2},
  };
}
const rateLimitDialogs = Array.from(document.querySelectorAll("[role='dialog']"))
  .filter((node) => visible(node))
  .filter((node) => /请求过于频繁|too many requests|temporarily limited/i.test(normalized(node.textContent)));
const rateLimitAcks = rateLimitDialogs.flatMap((dialog) =>
  Array.from(dialog.querySelectorAll("button"))
    .filter((node) => visible(node))
    .filter((node) => /^(明白了|got it|understood)$/i.test(normalized(
      node.getAttribute("aria-label") || node.textContent
    )))
);
if (rateLimitDialogs.length > 1 || rateLimitAcks.length > 1) {
  return {
    status: "review_required",
    message: "CHATGPT_RATE_LIMIT_ACK_AMBIGUOUS",
    pageUrl: location.href,
    markerCount,
    titleCount: 0,
  };
}
if (rateLimitAcks.length === 1) {
  const rect = rateLimitAcks[0].getBoundingClientRect();
  return {
    status: "ack_rate_limit",
    message: "ChatGPT temporary history rate-limit acknowledgement located",
    pageUrl: location.href,
    markerCount,
    titleCount: 0,
    targetPoint: {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2},
  };
}
const searchControls = Array.from(document.querySelectorAll("button, [role='button']"))
  .filter((node) => visible(node))
  .filter((node) => /搜索聊天|search chats/i.test(normalized(
    node.getAttribute("aria-label") || node.getAttribute("title") || node.textContent
  )))
  .sort((left, right) => right.getBoundingClientRect().x - left.getBoundingClientRect().x);
if (searchControls.length >= 1) {
  const rect = searchControls[0].getBoundingClientRect();
  return {
    status: "open_search",
    message: "ChatGPT search chat control located",
    pageUrl: location.href,
    markerCount,
    titleCount: 0,
    targetPoint: {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2},
  };
}
return {
  status: "review_required",
  message: "CHATGPT_NAMED_CONVERSATION_AND_SEARCH_CONTROL_NOT_FOUND",
  pageUrl: location.href,
  markerCount,
  titleCount: 0,
};
`;

const buildConversationTargetScript = (input: {
  systemChatTitle: string;
  turnMarker: string;
}): string => `
const expectedTitle = ${JSON.stringify(input.systemChatTitle)};
const marker = ${JSON.stringify(input.turnMarker)};
${CONVERSATION_TARGET_SCRIPT}
`;

const SEARCH_TEXTBOX_TARGET_SCRIPT = `
const visible = (node) => {
  if (!(node instanceof Element)) return false;
  const rect = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
};
const normalized = (value) => String(value || "").replace(/\\s+/gu, " ").trim();
const candidates = Array.from(document.querySelectorAll("input, textarea, [role='textbox']"))
  .filter((node) => visible(node))
  .filter((node) => /搜索聊天|search chats/i.test(normalized(
    node.getAttribute("aria-label") || node.getAttribute("placeholder")
  )));
if (candidates.length !== 1) {
  return {
    status: candidates.length === 0 ? "pending" : "review_required",
    message: candidates.length === 0 ? "waiting for ChatGPT search textbox" : "CHATGPT_SEARCH_TEXTBOX_AMBIGUOUS",
    pageUrl: location.href,
  };
}
const rect = candidates[0].getBoundingClientRect();
return {
  status: "success",
  message: "ChatGPT search textbox located",
  pageUrl: location.href,
  targetPoint: {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2},
};
`;

const buildSearchResultTargetScript = (systemChatTitle: string): string => `
const expectedTitle = ${JSON.stringify(systemChatTitle)};
const visible = (node) => {
  if (!(node instanceof Element)) return false;
  const rect = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
};
const normalized = (value) => String(value || "").replace(/\\s+/gu, " ").trim();
const candidates = Array.from(document.querySelectorAll("a[href]"))
  .filter((node) =>
    visible(node)
    && (node.getAttribute("href") || "").includes("/c/")
    && normalized(node.textContent) === expectedTitle
  );
if (candidates.length !== 1) {
  return {
    status: candidates.length === 0 ? "pending" : "review_required",
    message: candidates.length === 0 ? "waiting for exact named ChatGPT search result" : "CHATGPT_SEARCH_RESULT_AMBIGUOUS",
    pageUrl: location.href,
  };
}
const rect = candidates[0].getBoundingClientRect();
return {
  status: "success",
  message: "exact named ChatGPT search result located",
  pageUrl: location.href,
  targetPoint: {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2},
};
`;

const buildGeminiIdentityScript = (turnMarker: string): string => `
const marker = ${JSON.stringify(turnMarker)};
const nodes = Array.from(document.querySelectorAll("user-query, user-query-content, .user-query-container"));
const markerCount = nodes.filter((node) => (node.textContent || "").includes(marker)).length;
return {pageUrl: location.href, markerCount};
`;

const clickTarget = async (input: {
  base: BrowserController;
  description: string;
  targetPoint: { x: number; y: number } | undefined;
}): Promise<void> => {
  if (!input.targetPoint) throw new Error(`review_required: ${input.description} point missing.`);
  const clicked = await input.base.click({
    targetLabel: input.description,
    point: input.targetPoint,
    coordinateSpace: "browserViewport",
    button: "left",
    clickCount: 1,
  });
  if (!clicked.ok) throw new Error(`review_required: ${input.description} real click failed; ${clicked.message}`);
};

const locateSearchTarget = async (input: {
  base: BrowserController;
  script: string;
  description: string;
  signal?: AbortSignal;
}): Promise<SearchTarget> => {
  const deadline = Date.now() + 10_000;
  let last: SearchTarget | null = null;
  while (Date.now() < deadline) {
    last = await input.base.evaluateActiveTab<SearchTarget>({
      description: input.description,
      script: input.script,
      ...(input.signal ? { abortSignal: input.signal } : {}),
    });
    if (last.status === "success") return last;
    if (last.status === "review_required") throw new Error(`review_required: ${last.message}`);
    await input.base.wait(250);
  }
  throw new Error(`review_required: ${input.description} timed out; last=${last?.message ?? "none"}`);
};

const searchAndOpenNamedConversation = async (input: {
  base: BrowserController;
  systemChatTitle: string;
  searchPoint: { x: number; y: number } | undefined;
  signal?: AbortSignal;
}): Promise<void> => {
  await clickTarget({
    base: input.base,
    description: "open ChatGPT chat search",
    targetPoint: input.searchPoint,
  });
  const textbox = await locateSearchTarget({
    base: input.base,
    script: SEARCH_TEXTBOX_TARGET_SCRIPT,
    description: "locate ChatGPT chat search textbox",
    ...(input.signal ? { signal: input.signal } : {}),
  });
  await clickTarget({
    base: input.base,
    description: "focus ChatGPT chat search textbox",
    targetPoint: textbox.targetPoint,
  });
  await input.base.textInput({
    targetLabel: "ChatGPT chat search textbox",
    action: "clear-input",
    ...(input.signal ? { abortSignal: input.signal } : {}),
  });
  await input.base.textInput({
    targetLabel: "ChatGPT chat search textbox",
    action: "type-text",
    text: input.systemChatTitle,
    ...(input.signal ? { abortSignal: input.signal } : {}),
  });
  const result = await locateSearchTarget({
    base: input.base,
    script: buildSearchResultTargetScript(input.systemChatTitle),
    description: "locate exact system-renamed ChatGPT search result",
    ...(input.signal ? { signal: input.signal } : {}),
  });
  await clickTarget({
    base: input.base,
    description: "open exact system-renamed ChatGPT search result",
    targetPoint: result.targetPoint,
  });
};

const focusNamedChatGptConversation = async (input: {
  base: BrowserController;
  systemChatTitle: string;
  turnMarker: string;
  signal?: AbortSignal;
}): Promise<void> => {
  const deadline = Date.now() + 30_000;
  let searched = false;
  let last: ConversationTarget | null = null;
  while (Date.now() < deadline) {
    last = await input.base.evaluateActiveTab<ConversationTarget>({
      description: "locate exact system-renamed ChatGPT conversation in the single controlled tab",
      script: buildConversationTargetScript(input),
      ...(input.signal ? { abortSignal: input.signal } : {}),
    });
    if (last.status === "focused") return;
    if (last.status === "review_required") {
      throw new Error(`review_required: ${last.message}; pageUrl=${last.pageUrl}`);
    }
    if (last.status === "click_title") {
      await clickTarget({
        base: input.base,
        description: "open exact system-renamed ChatGPT conversation",
        targetPoint: last.targetPoint,
      });
    } else if (last.status === "ack_rate_limit") {
      await clickTarget({
        base: input.base,
        description: "acknowledge ChatGPT temporary history rate limit before named-chat routing",
        targetPoint: last.targetPoint,
      });
      const refreshed = await input.base.open({
        url: last.pageUrl,
        title: "refresh same ChatGPT tab immediately after temporary history rate limit",
        reusePolicy: "reuse-active-tab",
      });
      if (!refreshed.ok) {
        throw new Error("review_required: ChatGPT rate-limit acknowledgement succeeded but same-tab refresh failed.");
      }
    } else if (last.status === "open_search" && !searched) {
      searched = true;
      await searchAndOpenNamedConversation({
        base: input.base,
        systemChatTitle: input.systemChatTitle,
        searchPoint: last.targetPoint,
        ...(input.signal ? { signal: input.signal } : {}),
      });
    } else {
      throw new Error("review_required: exact named ChatGPT conversation could not be focused.");
    }
    await input.base.wait(500);
  }
  throw new Error(
    `review_required: exact named ChatGPT conversation did not expose exactly one matching marker; title=${input.systemChatTitle}; last=${last?.message ?? "none"}`,
  );
};

const focusGeminiConversation = async (input: {
  base: BrowserController;
  submission: WebChatSubmissionProof;
  turnMarker: string;
  signal?: AbortSignal;
}): Promise<void> => {
  const targetUrl = input.submission.canonicalConversationUrl ?? input.submission.transientConversationUrl;
  const opened = await input.base.open({
    url: targetUrl,
    title: "resume exact Gemini conversation in single controlled tab",
    reusePolicy: "reuse-active-tab",
  });
  if (!opened.ok) throw new Error(`review_required: exact Gemini conversation could not be opened; ${opened.message}`);
  const observed = await input.base.evaluateActiveTab<{ pageUrl: string; markerCount: number }>({
    description: "verify exact Gemini conversation marker in single controlled tab",
    script: buildGeminiIdentityScript(input.turnMarker),
    ...(input.signal ? { abortSignal: input.signal } : {}),
  });
  if (observed.markerCount !== 1) {
    throw new Error(
      `review_required: exact Gemini conversation marker mismatch; count=${observed.markerCount}; pageUrl=${observed.pageUrl}`,
    );
  }
};

export const focusBoundWebChatConversation = async (input: {
  base: BrowserController;
  providerKind: "gpt-web-chat" | "gemini-web-chat";
  systemChatTitle: string | null;
  submission: WebChatSubmissionProof;
  turnMarker: string;
  signal?: AbortSignal;
}): Promise<void> => {
  if (input.providerKind === "gpt-web-chat") {
    if (!input.systemChatTitle) {
      throw new Error("review_required: GPT web-chat execution is missing its system chat title.");
    }
    await focusNamedChatGptConversation({
      base: input.base,
      systemChatTitle: input.systemChatTitle,
      turnMarker: input.turnMarker,
      ...(input.signal ? { signal: input.signal } : {}),
    });
    return;
  }
  await focusGeminiConversation({
    base: input.base,
    submission: input.submission,
    turnMarker: input.turnMarker,
    ...(input.signal ? { signal: input.signal } : {}),
  });
};
