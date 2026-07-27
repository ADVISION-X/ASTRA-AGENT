import type { BrowserController } from "../../../lib/browser/browser-controller.js";

type SearchTarget = {
  status: "success" | "pending" | "review_required";
  message: string;
  pageUrl: string;
  targetPoint?: { x: number; y: number };
};

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

const clickTarget = async (input: {
  base: BrowserController;
  description: string;
  targetPoint: { x: number; y: number } | undefined;
}): Promise<void> => {
  if (!input.targetPoint) {
    throw new Error(`review_required: ${input.description} point missing.`);
  }
  const clicked = await input.base.click({
    targetLabel: input.description,
    point: input.targetPoint,
    coordinateSpace: "browserViewport",
    button: "left",
    clickCount: 1,
  });
  if (!clicked.ok) {
    throw new Error(
      `review_required: ${input.description} real click failed; ${clicked.message}`,
    );
  }
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
    if (last.status === "review_required") {
      throw new Error(`review_required: ${last.message}`);
    }
    await input.base.wait(250);
  }
  throw new Error(
    `review_required: ${input.description} timed out; last=${last?.message ?? "none"}`,
  );
};

export const searchAndOpenNamedConversation = async (input: {
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
