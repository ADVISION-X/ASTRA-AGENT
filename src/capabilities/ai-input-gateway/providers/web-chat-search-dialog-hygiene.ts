import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";

type SearchDialogContext = Pick<AiProviderAdapterContext, "abortSignal">;

const SEARCH_DIALOG_AMBIGUOUS_CODE = "CHATGPT_SEARCH_DIALOG_AMBIGUOUS";
const SEARCH_DIALOG_CLOSE_AMBIGUOUS_CODE = "CHATGPT_SEARCH_DIALOG_CLOSE_AMBIGUOUS";
const SEARCH_DIALOG_STILL_VISIBLE_CODE = "CHATGPT_SEARCH_DIALOG_STILL_VISIBLE";

type SearchDialogTarget = {
  status: "not_found" | "close_located" | "review_required";
  message: string;
  pageUrl: string;
  targetPoint?: { x: number; y: number };
};

const SEARCH_DIALOG_CLOSE_TARGET_SCRIPT = `
const visible = (node) => {
  if (!(node instanceof Element)) return false;
  const rect = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  return rect.width > 0
    && rect.height > 0
    && style.display !== "none"
    && style.visibility !== "hidden"
    && Number(style.opacity || "1") > 0;
};
const normalized = (value) => String(value || "").replace(/\\s+/gu, " ").trim();
const dialogCandidates = Array.from(new Set([
  ...document.querySelectorAll("[role='dialog']"),
  ...document.querySelectorAll("[aria-modal='true']"),
])).filter(visible);
const searchDialogs = dialogCandidates.filter((dialog) => {
  const searchTextboxes = Array.from(
    dialog.querySelectorAll("input, textarea, [role='textbox']")
  )
    .filter(visible)
    .filter((node) => /搜索聊天|search chats/i.test(normalized(
      node.getAttribute("aria-label") || node.getAttribute("placeholder")
    )));
  return searchTextboxes.length === 1;
});
if (searchDialogs.length === 0) {
  return {
    status: "not_found",
    message: "no visible ChatGPT chat-search dialog",
    pageUrl: location.href,
  };
}
if (searchDialogs.length !== 1) {
  return {
    status: "review_required",
    message: ${JSON.stringify(SEARCH_DIALOG_AMBIGUOUS_CODE)},
    pageUrl: location.href,
  };
}
const closeButtons = Array.from(
  searchDialogs[0].querySelectorAll("button, [role='button']")
)
  .filter(visible)
  .filter((node) => /^(关闭|close)$/i.test(normalized(
    node.getAttribute("aria-label")
      || node.getAttribute("title")
      || node.textContent
  )));
if (closeButtons.length !== 1) {
  return {
    status: "review_required",
    message: closeButtons.length === 0
      ? "CHATGPT_SEARCH_DIALOG_CLOSE_NOT_FOUND"
      : ${JSON.stringify(SEARCH_DIALOG_CLOSE_AMBIGUOUS_CODE)},
    pageUrl: location.href,
  };
}
const rect = closeButtons[0].getBoundingClientRect();
return {
  status: "close_located",
  message: "unique ChatGPT chat-search close action located",
  pageUrl: location.href,
  targetPoint: {
    x: Math.round(rect.left + rect.width / 2),
    y: Math.round(rect.top + rect.height / 2),
  },
};
`;

const observeSearchDialog = (
  browser: BrowserTargetLease,
  context: SearchDialogContext,
  description: string,
): Promise<SearchDialogTarget> =>
  browser.evaluate<SearchDialogTarget>({
    description,
    script: SEARCH_DIALOG_CLOSE_TARGET_SCRIPT,
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });

export const dismissChatGptSearchDialogIfVisible = async (
  browser: BrowserTargetLease,
  context: SearchDialogContext,
): Promise<"not_found" | "closed"> => {
  const target = await observeSearchDialog(
    browser,
    context,
    "locate visible ChatGPT chat-search close action",
  );
  if (target.status === "not_found") return "not_found";
  if (target.status === "review_required" || !target.targetPoint) {
    throw new Error(`review_required: ${target.message}`);
  }
  const clicked = await browser.click({
    targetLabel: "close the uniquely identified ChatGPT chat-search dialog",
    point: target.targetPoint,
    coordinateSpace: "browserViewport",
    button: "left",
    clickCount: 1,
  });
  if (!clicked.ok) {
    throw new Error(
      `review_required: CHATGPT_SEARCH_DIALOG_CLOSE_CLICK_FAILED; ${clicked.message}`,
    );
  }
  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline) {
    await browser.wait(100);
    const observed = await observeSearchDialog(
      browser,
      context,
      "verify ChatGPT chat-search dialog closed",
    );
    if (observed.status === "not_found") return "closed";
    if (observed.status === "review_required") {
      throw new Error(`review_required: ${observed.message}`);
    }
  }
  throw new Error(`review_required: ${SEARCH_DIALOG_STILL_VISIBLE_CODE}`);
};
