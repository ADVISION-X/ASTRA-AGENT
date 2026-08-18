import type { BrowserTargetSession } from "../../../lib/browser/browser-controller.js";
import type { WebChatSubmissionProof } from "../contracts/ai-provider-adapter.contract.js";

type CanonicalConversationTarget = {
  status:
    | "focused"
    | "click_row"
    | "scroll_row"
    | "ack_rate_limit"
    | "pending"
    | "review_required";
  message: string;
  pageUrl: string;
  markerCount: number;
  rowCount: number;
  targetPoint?: { x: number; y: number };
  scrollDeltaY?: number;
};

const CANONICAL_CONVERSATION_SCRIPT = `
const targetPath = __TARGET_PATH__;
const visible = (node) => {
  if (!(node instanceof Element)) return false;
  const rect = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
};
const normalized = (value) => String(value || "").replace(/\\s+/gu, " ").trim();
const rows = Array.from(document.querySelectorAll("a[href]"))
  .filter((link) => {
    try {
      return visible(link)
        && new URL(link.getAttribute("href") || "", location.href).pathname === targetPath;
    } catch {
      return false;
    }
  })
  .map((node) => {
    const rect = node.getBoundingClientRect();
    const centerX = rect.left + Math.min(rect.width / 2, 96);
    const centerY = rect.top + rect.height / 2;
    return {
      node,
      rect,
      centerX,
      centerY,
      actionable: centerY >= 24 && centerY <= innerHeight - 24,
    };
  })
  .sort((left, right) =>
    Number(right.actionable) - Number(left.actionable)
    || left.rect.top - right.rect.top
    || left.rect.left - right.rect.left
    || left.rect.width - right.rect.width
    || left.rect.height - right.rect.height
  );
if (location.pathname === targetPath) {
  return {status: "focused", message: "exact canonical ChatGPT conversation is focused", pageUrl: location.href, markerCount: 0, rowCount: rows.length};
}
if (rows.length > 0) {
  const selected = rows[0];
  if (!selected.actionable) {
    return {
      status: "scroll_row",
      message: "all renderings of the exact canonical ChatGPT sidebar route are outside the visible viewport",
      pageUrl: location.href,
      markerCount: 0,
      rowCount: rows.length,
      targetPoint: {x: Math.max(24, Math.min(innerWidth - 24, selected.centerX)), y: innerHeight / 2},
      scrollDeltaY: Math.max(-600, Math.min(600, selected.centerY - innerHeight / 2)),
    };
  }
  return {
    status: "click_row",
    message: "exact canonical ChatGPT logical sidebar route located by stable geometry order",
    pageUrl: location.href,
    markerCount: 0,
    rowCount: rows.length,
    targetPoint: {x: selected.centerX, y: selected.centerY},
  };
}
const rateLimitDialogs = Array.from(document.querySelectorAll("[role='dialog']"))
  .filter((node) => visible(node))
  .filter((node) => /请求过于频繁|too many requests|temporarily limited/i.test(normalized(node.textContent)));
const acknowledgements = rateLimitDialogs.flatMap((dialog) =>
  Array.from(dialog.querySelectorAll("button"))
    .filter((node) => visible(node))
    .filter((node) => /^(明白了|got it|understood)$/i.test(normalized(node.getAttribute("aria-label") || node.textContent)))
);
if (rateLimitDialogs.length > 1 || acknowledgements.length > 1) {
  return {status: "review_required", message: "CHATGPT_RATE_LIMIT_ACK_AMBIGUOUS", pageUrl: location.href, markerCount: 0, rowCount: 0};
}
if (acknowledgements.length === 1) {
  const rect = acknowledgements[0].getBoundingClientRect();
  return {
    status: "ack_rate_limit",
    message: "ChatGPT rate-limit acknowledgement located",
    pageUrl: location.href,
    markerCount: 0,
    rowCount: 0,
    targetPoint: {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2},
  };
}
return {status: "pending", message: "waiting for exact canonical ChatGPT sidebar row", pageUrl: location.href, markerCount: 0, rowCount: 0};
`;

export const buildCanonicalConversationScript = (input: {
  targetPath: string;
}): string =>
  CANONICAL_CONVERSATION_SCRIPT.replace("__TARGET_PATH__", JSON.stringify(input.targetPath));

const clickTarget = async (input: {
  base: BrowserTargetSession;
  description: string;
  targetPoint: { x: number; y: number } | undefined;
}): Promise<void> => {
  if (!input.targetPoint)
    throw new Error(`review_required: ${input.description} point missing.`);
  const clicked = await input.base.click({
    targetLabel: input.description,
    point: input.targetPoint,
    coordinateSpace: "browserViewport",
    button: "left",
    clickCount: 1,
  });
  if (!clicked.ok)
    throw new Error(
      `WEB_CHAT_BOUND_CONVERSATION_NOT_READY: ${input.description} click failed; ${clicked.message}`,
    );
};

const reacquireCanonicalConversationTarget = async (input: {
  base: BrowserTargetSession;
  conversationUrl: string;
  signal?: AbortSignal;
}): Promise<void> => {
  const acquired = await input.base.open({
    url: input.conversationUrl,
    title: "reacquire exact canonical ChatGPT conversation tab",
    reusePolicy: "reuse-exact-url",
    ...(input.signal ? { abortSignal: input.signal } : {}),
  });
  if (!acquired.ok) {
    throw new Error(
      `WEB_CHAT_BOUND_CONVERSATION_NOT_READY: unique existing ChatGPT provider target could not be reacquired; ${acquired.message}`,
    );
  }
};

const pollCanonicalConversationRoute = async (input: {
  base: BrowserTargetSession;
  targetPath: string;
  conversationUrl: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<void> => {
  const deadline =
    Date.now() + Math.max(1, Math.min(input.timeoutMs ?? 15_000, 15_000));
  let last: CanonicalConversationTarget | null = null;
  while (Date.now() < deadline) {
    last = await input.base.evaluate<CanonicalConversationTarget>({
      description: "locate exact canonical ChatGPT conversation row",
      script: buildCanonicalConversationScript({
        targetPath: input.targetPath,
      }),
      ...(input.signal ? { abortSignal: input.signal } : {}),
    });
    if (last.status === "focused") return;
    if (last.status === "review_required")
      throw new Error(
        `review_required: ${last.message}; pageUrl=${last.pageUrl}`,
      );
    if (last.status === "click_row" || last.status === "ack_rate_limit") {
      await clickTarget({
        base: input.base,
        description:
          last.status === "click_row"
            ? "open exact canonical ChatGPT sidebar row"
            : "acknowledge ChatGPT rate limit before canonical routing",
        targetPoint: last.targetPoint,
      });
    } else if (last.status === "scroll_row") {
      await input.base.scroll({
        targetLabel: "scroll exact canonical ChatGPT sidebar row into view",
        deltaX: 0,
        deltaY: last.scrollDeltaY ?? 0,
        coordinateSpace: "browserViewport",
        ...(last.targetPoint ? { anchorPoint: last.targetPoint } : {}),
        ...(input.signal ? { abortSignal: input.signal } : {}),
      });
    }
    await input.base.wait(500);
  }
  throw new Error(
    "WEB_CHAT_BOUND_CONVERSATION_NOT_READY: exact canonical ChatGPT conversation is not ready; " +
      `last=${last?.message ?? "none"}; pageUrl=${last?.pageUrl ?? input.conversationUrl}`,
  );
};

export const focusChatGptConversationByCanonicalPath = async (input: {
  base: BrowserTargetSession;
  conversationUrl: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<void> => {
  const targetPath = new URL(input.conversationUrl).pathname;
  if (!/^\/c\/(?!WEB:)[^/]+$/u.test(targetPath)) {
    throw new Error(
      `WEB_CHAT_BOUND_CONVERSATION_NOT_READY: canonical ChatGPT path is unavailable; url=${input.conversationUrl}`,
    );
  }
  if (input.base.getTarget && !input.base.getTarget()) {
    await reacquireCanonicalConversationTarget(input);
  }
  await pollCanonicalConversationRoute({ ...input, targetPath });
};

const focusGeminiConversation = async (input: {
  base: BrowserTargetSession;
  submission: WebChatSubmissionProof;
  turnMarker: string;
  signal?: AbortSignal;
}): Promise<void> => {
  const targetUrl =
    input.submission.canonicalConversationUrl ??
    input.submission.transientConversationUrl;
  const opened = await input.base.open({
    url: targetUrl,
    title: "resume exact Gemini conversation",
    reusePolicy: "reuse-exact-url",
  });
  if (!opened.ok)
    throw new Error(
      `review_required: exact Gemini conversation could not be opened; ${opened.message}`,
    );
  const observed = await input.base.evaluate<{
    pageUrl: string;
    markerCount: number;
  }>({
    description: "verify exact Gemini conversation marker",
    script: `
const marker = ${JSON.stringify(input.turnMarker)};
const nodes = Array.from(document.querySelectorAll("user-query, user-query-content, .user-query-container"));
const markerCount = nodes.filter((node) => (node.textContent || "").includes(marker)).length;
return {pageUrl: location.href, markerCount};
`,
    ...(input.signal ? { abortSignal: input.signal } : {}),
  });
  if (observed.markerCount !== 1)
    throw new Error(
      `review_required: exact Gemini conversation marker mismatch; count=${observed.markerCount}; pageUrl=${observed.pageUrl}`,
    );
};

export const focusBoundWebChatConversation = async (input: {
  base: BrowserTargetSession;
  providerKind: "gpt-web-chat" | "gemini-web-chat";
  submission: WebChatSubmissionProof;
  turnMarker: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<void> => {
  if (input.providerKind === "gpt-web-chat") {
    await focusChatGptConversationByCanonicalPath({
      base: input.base,
      conversationUrl:
        input.submission.canonicalConversationUrl ??
        input.submission.transientConversationUrl,
      ...(input.timeoutMs ? { timeoutMs: input.timeoutMs } : {}),
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
