import type { BrowserTargetSession } from "../../../lib/browser/browser-controller.js";
import type { WebChatSubmissionProof } from "../contracts/ai-provider-adapter.contract.js";
import { searchAndOpenNamedConversation } from "./web-chat-named-conversation-search.js";

type ConversationTarget = {
  status: "focused" | "click_title" | "scroll_title" | "ack_rate_limit" | "open_search" | "review_required";
  message: string;
  pageUrl: string;
  markerCount: number;
  titleCount: number;
  targetPoint?: { x: number; y: number };
  scrollDeltaY?: number;
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
  const centerY = rect.top + rect.height / 2;
  if (centerY < 24 || centerY > innerHeight - 24) {
    return {
      status: "scroll_title",
      message: "exact system-renamed ChatGPT conversation is outside the visible sidebar viewport",
      pageUrl: location.href,
      markerCount,
      titleCount: 1,
      targetPoint: {x: Math.max(24, Math.min(innerWidth - 24, rect.left + Math.min(rect.width / 2, 96))), y: innerHeight / 2},
      scrollDeltaY: Math.max(-600, Math.min(600, centerY - innerHeight / 2)),
    };
  }
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

const buildConversationTargetScript = (input: { systemChatTitle: string; turnMarker: string }): string => `
const expectedTitle = ${JSON.stringify(input.systemChatTitle)};
const marker = ${JSON.stringify(input.turnMarker)};
${CONVERSATION_TARGET_SCRIPT}
`;

const buildGeminiIdentityScript = (turnMarker: string): string => `
const marker = ${JSON.stringify(turnMarker)};
const nodes = Array.from(document.querySelectorAll("user-query, user-query-content, .user-query-container"));
const markerCount = nodes.filter((node) => (node.textContent || "").includes(marker)).length;
return {pageUrl: location.href, markerCount};
`;

const clickTarget = async (input: { base: BrowserTargetSession; description: string; targetPoint: { x: number; y: number } | undefined }): Promise<void> => {
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

const handleNamedConversationTarget = async (input: {
  request: {
    base: BrowserTargetSession;
    systemChatTitle: string;
    signal?: AbortSignal;
  };
  target: ConversationTarget;
  searched: boolean;
}): Promise<boolean> => {
  if (input.target.status === "click_title") {
    await clickTarget({
      base: input.request.base,
      description: "open exact system-renamed ChatGPT conversation",
      targetPoint: input.target.targetPoint,
    });
  } else if (input.target.status === "scroll_title") {
    await input.request.base.scroll({
      targetLabel: "scroll exact system-renamed ChatGPT conversation into view",
      deltaX: 0,
      deltaY: input.target.scrollDeltaY ?? 0,
      coordinateSpace: "browserViewport",
      ...(input.target.targetPoint
        ? { anchorPoint: input.target.targetPoint }
        : {}),
      ...(input.request.signal
        ? { abortSignal: input.request.signal }
        : {}),
    });
  } else if (input.target.status === "ack_rate_limit") {
    await clickTarget({
      base: input.request.base,
      description: "acknowledge ChatGPT temporary history rate limit before named-chat routing",
      targetPoint: input.target.targetPoint,
    });
  } else if (input.target.status === "open_search" && !input.searched) {
    await searchAndOpenNamedConversation({
      base: input.request.base,
      systemChatTitle: input.request.systemChatTitle,
      searchPoint: input.target.targetPoint,
      ...(input.request.signal ? { signal: input.request.signal } : {}),
    });
    return true;
  } else {
    throw new Error(
      "review_required: exact named ChatGPT conversation could not be focused.",
    );
  }
  return input.searched;
};

const focusNamedChatGptConversation = async (input: { base: BrowserTargetSession; systemChatTitle: string; turnMarker: string; signal?: AbortSignal }): Promise<void> => {
  const deadline = Date.now() + 30_000;
  let searched = false;
  let last: ConversationTarget | null = null;
  while (Date.now() < deadline) {
    last = await input.base.evaluate<ConversationTarget>({
      description: "locate exact system-renamed ChatGPT conversation in the single controlled tab",
      script: buildConversationTargetScript(input),
      ...(input.signal ? { abortSignal: input.signal } : {}),
    });
    if (last.status === "focused") return;
    if (last.status === "review_required") {
      throw new Error(`review_required: ${last.message}; pageUrl=${last.pageUrl}`);
    }
    searched = await handleNamedConversationTarget({
      request: input,
      target: last,
      searched,
    });
    await input.base.wait(500);
  }
  throw new Error(`review_required: exact named ChatGPT conversation did not expose exactly one matching marker; title=${input.systemChatTitle}; last=${last?.message ?? "none"}`);
};

const focusGeminiConversation = async (input: { base: BrowserTargetSession; submission: WebChatSubmissionProof; turnMarker: string; signal?: AbortSignal }): Promise<void> => {
  const targetUrl = input.submission.canonicalConversationUrl ?? input.submission.transientConversationUrl;
  const opened = await input.base.open({
    url: targetUrl,
    title: "resume exact Gemini conversation in single controlled tab",
    reusePolicy: "reuse-exact-url",
  });
  if (!opened.ok) throw new Error(`review_required: exact Gemini conversation could not be opened; ${opened.message}`);
  const observed = await input.base.evaluate<{
    pageUrl: string;
    markerCount: number;
  }>({
    description: "verify exact Gemini conversation marker in single controlled tab",
    script: buildGeminiIdentityScript(input.turnMarker),
    ...(input.signal ? { abortSignal: input.signal } : {}),
  });
  if (observed.markerCount !== 1) {
    throw new Error(`review_required: exact Gemini conversation marker mismatch; count=${observed.markerCount}; pageUrl=${observed.pageUrl}`);
  }
};

const UNRENAMED_CHATGPT_IDENTITY_SCRIPT = `
const marker = __TURN_MARKER__;
const targetPath = __TARGET_PATH__;
const visible = (node) => {
  if (!(node instanceof Element)) return false;
  const rect = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
};
const normalized = (value) => String(value || "").replace(/\\s+/gu, " ").trim();
const nodes = Array.from(document.querySelectorAll("[data-message-author-role='user']"));
const markerCount = nodes.filter((node) => normalized(node.textContent).includes(marker)).length;
const transientTarget = targetPath.startsWith("/c/WEB:");
const links = Array.from(document.querySelectorAll("a[href]"))
  .filter((link) => {
    try {
      const rawHref = link.getAttribute("href") || "";
      return /^\\/c\\/(?!WEB:)[^/?#]+(?:[?#].*)?$/u.test(rawHref)
        && new URL(link.href, location.href).pathname === targetPath
        && visible(link);
    } catch {
      return false;
    }
  });
if (
  markerCount === 1
  && (location.pathname === targetPath || transientTarget)
) {
  return {
    status: "focused",
    pageUrl: location.href,
    markerCount,
    titleCount: links.length,
    message: "exact submitted ChatGPT row and marker are focused",
  };
}
if (markerCount > 1) {
  return {
    status: "review_required",
    pageUrl: location.href,
    markerCount,
    titleCount: links.length,
    message: "CHATGPT_SUBMITTED_CONVERSATION_IDENTITY_AMBIGUOUS",
  };
}
if (links.length >= 1) {
  const targetLink = [...links].sort((left, right) => {
    const leftRect = left.getBoundingClientRect();
    const rightRect = right.getBoundingClientRect();
    return (rightRect.width * rightRect.height) - (leftRect.width * leftRect.height);
  })[0];
  const rect = targetLink.getBoundingClientRect();
  const centerY = rect.top + rect.height / 2;
  if (centerY < 24 || centerY > innerHeight - 24) {
    return {
      status: "scroll_title",
      pageUrl: location.href,
      markerCount,
      titleCount: links.length,
      message: "exact submitted ChatGPT sidebar row is outside the visible viewport",
      targetPoint: {x: Math.max(24, Math.min(innerWidth - 24, rect.left + Math.min(rect.width / 2, 96))), y: innerHeight / 2},
      scrollDeltaY: Math.max(-600, Math.min(600, centerY - innerHeight / 2)),
    };
  }
  return {
    status: "click_title",
    pageUrl: location.href,
    markerCount,
    titleCount: links.length,
    message: "exact submitted ChatGPT sidebar row located",
    targetPoint: {x: rect.left + Math.min(rect.width / 2, 96), y: rect.top + rect.height / 2},
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
    pageUrl: location.href,
    markerCount,
    titleCount: 0,
    message: "CHATGPT_RATE_LIMIT_ACK_AMBIGUOUS",
  };
}
if (rateLimitAcks.length === 1) {
  const rect = rateLimitAcks[0].getBoundingClientRect();
  return {
    status: "ack_rate_limit",
    pageUrl: location.href,
    markerCount,
    titleCount: 0,
    message: "ChatGPT rate-limit acknowledgement located before submitted-row routing",
    targetPoint: {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2},
  };
}
return {
  status: "pending",
  pageUrl: location.href,
  markerCount,
  titleCount: 0,
  message: "waiting for exact submitted ChatGPT sidebar row",
};
`;

const buildUnrenamedChatGptIdentityScript = (input: { turnMarker: string; targetPath: string }): string => UNRENAMED_CHATGPT_IDENTITY_SCRIPT.replace("__TURN_MARKER__", JSON.stringify(input.turnMarker)).replace("__TARGET_PATH__", JSON.stringify(input.targetPath));

type UnrenamedConversationTarget = {
  status: "focused" | "click_title" | "scroll_title" | "ack_rate_limit" | "pending" | "review_required";
  pageUrl: string;
  markerCount: number;
  titleCount: number;
  message: string;
  targetPoint?: { x: number; y: number };
  scrollDeltaY?: number;
};

const advanceUnrenamedTarget = async (input: {
  base: BrowserTargetSession;
  target: UnrenamedConversationTarget;
  signal?: AbortSignal;
}): Promise<void> => {
  if (input.target.status === "click_title" || input.target.status === "ack_rate_limit") {
    await clickTarget({
      base: input.base,
      description: input.target.status === "click_title"
        ? "open exact submitted ChatGPT sidebar row before rename"
        : "acknowledge ChatGPT rate limit before submitted-row routing",
      targetPoint: input.target.targetPoint,
    });
  } else if (input.target.status === "scroll_title") {
    await input.base.scroll({
      targetLabel: "scroll exact submitted ChatGPT sidebar row into view",
      deltaX: 0, deltaY: input.target.scrollDeltaY ?? 0,
      coordinateSpace: "browserViewport",
      ...(input.target.targetPoint ? { anchorPoint: input.target.targetPoint } : {}),
      ...(input.signal ? { abortSignal: input.signal } : {}),
    });
  }
};

const focusUnrenamedChatGptConversation = async (input: { base: BrowserTargetSession; targetUrl: string; turnMarker: string; timeoutMs?: number; signal?: AbortSignal }): Promise<void> => {
  const targetUrl = input.targetUrl;
  const targetPath = new URL(targetUrl).pathname;
  const transientTarget = targetPath.startsWith("/c/WEB:");
  if (!transientTarget) {
    const currentUrl = input.base.getSessionState().currentUrl;
    const currentPath = currentUrl ? new URL(currentUrl).pathname : null;
    if (currentPath !== targetPath) {
      const opened = await input.base.open({
        url: targetUrl,
        title: "resume exact submitted ChatGPT conversation by canonical URL",
        reusePolicy: "reuse-exact-url",
      });
      if (!opened.ok) {
        throw new Error(
          `WEB_CHAT_BOUND_CONVERSATION_NOT_READY: exact canonical ChatGPT conversation could not be opened; ${opened.message}`,
        );
      }
    }
  }
  const inspectAndLocate = () =>
    input.base.evaluate<UnrenamedConversationTarget>({
      description: "locate exact submitted ChatGPT conversation row before completing system rename",
      script: buildUnrenamedChatGptIdentityScript({ turnMarker: input.turnMarker, targetPath }),
      ...(input.signal ? { abortSignal: input.signal } : {}),
    });
  const deadline = Date.now() + Math.max(
    1,
    Math.min(input.timeoutMs ?? 15_000, 15_000),
  );
  let last: Awaited<ReturnType<typeof inspectAndLocate>> | null = null;
  while (Date.now() < deadline) {
    last = await inspectAndLocate();
    if (last.status === "focused") return;
    if (last.status === "review_required") {
      throw new Error(`review_required: ${last.message}; pageUrl=${last.pageUrl}`);
    }
    await advanceUnrenamedTarget({
      base: input.base,
      target: last,
      ...(input.signal ? { signal: input.signal } : {}),
    });
    await input.base.wait(500);
  }
  throw new Error(`WEB_CHAT_BOUND_CONVERSATION_NOT_READY: exact submitted ChatGPT sidebar row is not ready for marker verification; last=${last?.message ?? "none"}; pageUrl=${last?.pageUrl ?? targetUrl}`);
};

export const focusChatGptConversationByCanonicalPath = async (input: {
  base: BrowserTargetSession;
  conversationUrl: string;
  turnMarker: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<void> => {
  await focusUnrenamedChatGptConversation({
    base: input.base,
    targetUrl: input.conversationUrl,
    turnMarker: input.turnMarker,
    ...(input.timeoutMs ? { timeoutMs: input.timeoutMs } : {}),
    ...(input.signal ? { signal: input.signal } : {}),
  });
};

export const focusBoundWebChatConversation = async (input: { base: BrowserTargetSession; providerKind: "gpt-web-chat" | "gemini-web-chat"; systemChatTitle: string | null; submission: WebChatSubmissionProof; turnMarker: string; timeoutMs?: number; signal?: AbortSignal }): Promise<void> => {
  if (input.providerKind === "gpt-web-chat") {
    if (input.submission.systemChatTitle !== input.systemChatTitle || !input.submission.chatTitleVerifiedAt) {
      await focusUnrenamedChatGptConversation({
        base: input.base,
        targetUrl: input.submission.canonicalConversationUrl
          ?? input.submission.transientConversationUrl,
        turnMarker: input.turnMarker,
        ...(input.timeoutMs ? { timeoutMs: input.timeoutMs } : {}),
        ...(input.signal ? { signal: input.signal } : {}),
      });
      return;
    }
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
