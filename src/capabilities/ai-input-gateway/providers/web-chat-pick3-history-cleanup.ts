import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import { readWorkspaceConversationLedger } from "./web-chat-workspace.js";

type HistoryCleanupInput = {
  browser: BrowserController;
  dataDir: string;
  providerKind: string;
  workspaceId: string;
  keepRecentCount: number;
  abortSignal?: AbortSignal;
  triggerThreshold?: number;
  maxDeleteCount?: number;
};

type DomClickTarget = { status: string; clickPoint?: { x: number; y: number } };

const providerLabel = (providerKind: string): string =>
  providerKind === "gemini-web-chat" ? "Gemini" : "ChatGPT";

const PICK3_TRAINING_HISTORY_TITLE_MARKERS = ["Pick3 Blind Eval", "Blind Eval", "Blind Chart", "Blind Time-Series", "Blind Series", "Visual Pattern Prediction"] as const;

const toUrlPath = (url: string): string => {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
};

const ensureProviderHistorySidebarOpen = async (input: { browser: BrowserController; providerKind: string; abortSignal?: AbortSignal }): Promise<void> => {
  if (input.providerKind !== "gemini-web-chat") return;
  const target = await input.browser.evaluateActiveTab<DomClickTarget>({
    description: "ensure Gemini sidebar is open before Pick3 history cleanup",
    script: `
	const visible = (node) => {
	  if (!node || typeof node.getBoundingClientRect !== "function") return false;
	  const rect = node.getBoundingClientRect(), style = window.getComputedStyle(node);
	  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
	};
const openButton = Array.from(document.querySelectorAll('button[aria-label]'))
  .filter(visible)
  .find((button) => String(button.getAttribute("aria-label") || "") === "Open sidebar");
if (!openButton || typeof openButton.getBoundingClientRect !== "function") return {status: "sidebar_already_open"};
const rect = openButton.getBoundingClientRect();
return {status: "sidebar_open_located", clickPoint: {x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2)}};
`,
    ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
  });
  if (!target.clickPoint || target.status !== "sidebar_open_located") return;
  const clicked = await input.browser.click({ targetLabel: "open Gemini sidebar for Pick3 history cleanup", point: target.clickPoint, coordinateSpace: "browserViewport", button: "left", clickCount: 1 });
  if (clicked.ok) await input.browser.wait(800);
};

const discoverLegacyPick3HistoryUrls = async (input: { browser: BrowserController; providerKind: string; protectedPaths: readonly string[]; abortSignal?: AbortSignal }): Promise<string[]> => {
  await ensureProviderHistorySidebarOpen(input);
  return input.browser.evaluateActiveTab<string[]>({
    description: `discover legacy Pick3 ${providerLabel(input.providerKind)} sidebar history entries`,
    script: `
const protectedPaths = new Set(${JSON.stringify(input.protectedPaths)});
const titleMarkers = ${JSON.stringify(PICK3_TRAINING_HISTORY_TITLE_MARKERS)};
	const visible = (node) => {
	  if (!node || typeof node.getBoundingClientRect !== "function") return false;
	  const rect = node.getBoundingClientRect();
	  return rect.width > 0 && rect.height > 0;
	};
const urls = [];
for (const anchor of Array.from(document.querySelectorAll('a[href]')).filter(visible)) {
  const label = String(anchor.textContent || "").trim();
  if (!titleMarkers.some((marker) => label.includes(marker))) continue;
  const href = anchor.href || anchor.getAttribute("href") || "";
  let path = href;
  try { path = new URL(href, location.href).pathname; } catch {}
  if (!protectedPaths.has(path)) urls.push(href);
}
return Array.from(new Set(urls));
`,
    ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
  });
};

const staleHistoryUrls = async (input: HistoryCleanupInput): Promise<string[]> => {
  const ledger = readWorkspaceConversationLedger(input);
  const protectedPaths = ledger.slice(-input.keepRecentCount).map(toUrlPath);
  const legacyPick3Urls = await discoverLegacyPick3HistoryUrls({ browser: input.browser, providerKind: input.providerKind, protectedPaths, ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}) });
  if (input.providerKind === "gemini-web-chat") return legacyPick3Urls;
  return Array.from(new Set([...ledger.slice(0, Math.max(0, ledger.length - input.keepRecentCount)), ...legacyPick3Urls]));
};

const nativeClick = async (browser: BrowserController, target: DomClickTarget, expectedStatus: string, targetLabel: string): Promise<string> => {
  if (!target.clickPoint || target.status !== expectedStatus) return target.status;
  const clicked = await browser.click({ targetLabel, point: target.clickPoint, coordinateSpace: "browserViewport", button: "left", clickCount: 1 });
  return clicked.ok ? `${expectedStatus.replace("_located", "")}_clicked` : `${expectedStatus}_click_failed`;
};

const locateOpenHistoryDeleteAction = async (input: { browser: BrowserController; providerKind: string; abortSignal?: AbortSignal }): Promise<DomClickTarget> =>
  input.browser.evaluateActiveTab<DomClickTarget>({
    description: `locate already-open stale ${providerLabel(input.providerKind)} conversation delete action`,
    script: `
const visible = (node) => {
  if (!node || typeof node.getBoundingClientRect !== "function") return false;
  const rect = node.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
};
const candidates = Array.from(document.querySelectorAll('[role="menuitem"], button, [role="button"]')).filter(visible);
const target = candidates.find((node) => {
  const role = String(node.getAttribute("role") || "").toLowerCase();
  const label = ((node.getAttribute("aria-label") || "") + " " + (node.textContent || "")).toLowerCase();
  return role === "menuitem" && (label.includes("delete") || label.includes("删除"));
});
if (!target || typeof target.getBoundingClientRect !== "function") return {status: "delete_action_not_found"};
const rect = target.getBoundingClientRect();
return {status: "delete_action_located", clickPoint: {x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2)}};
`,
    ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
  });

const resolveHistoryRowScript = `
const visible = (node) => {
  if (!node || typeof node.getBoundingClientRect !== "function") return false;
  const rect = node.getBoundingClientRect();
  const style = window.getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
};
const findHistoryLink = (targetUrl) => {
  const targetPath = (() => {
    try { return new URL(targetUrl).pathname; } catch { return targetUrl; }
  })();
  const anchors = Array.from(document.querySelectorAll('a[href]')).filter(visible);
  return anchors.find((anchor) => {
    const href = anchor.href || anchor.getAttribute("href") || "";
    if (href === targetUrl) return true;
    try { return new URL(href, location.href).pathname === targetPath; } catch { return false; }
  }) || null;
};
const resolveHistoryRow = (link) => {
  const linkRect = link.getBoundingClientRect();
  const candidates = [];
  for (let node = link; node && node !== document.body; node = node.parentElement) {
    if (!visible(node)) continue;
    const rect = node.getBoundingClientRect();
    const containsLink = rect.left <= linkRect.left + 4 && rect.right >= linkRect.right - 4;
    const rowSized = rect.height >= 28 && rect.height <= 96 && rect.width >= Math.max(180, linkRect.width);
    if (containsLink && rowSized) candidates.push(node);
  }
  return candidates[candidates.length - 1] || link;
};
`;

const locateHistoryRowForUrl = async (input: { browser: BrowserController; staleUrl: string; providerKind: string; abortSignal?: AbortSignal }): Promise<DomClickTarget> =>
  input.browser.evaluateActiveTab<DomClickTarget>({
    description: `locate stale ${providerLabel(input.providerKind)} conversation history row`,
    script: `
const targetUrl = ${JSON.stringify(input.staleUrl)};
${resolveHistoryRowScript}
const link = findHistoryLink(targetUrl);
if (!link) return {status: "not_found"};
const row = resolveHistoryRow(link);
if (!row || typeof row.getBoundingClientRect !== "function") return {status: "row_not_found"};
row.scrollIntoView({block: "center"});
const rowRect = row.getBoundingClientRect();
return {status: "row_located", clickPoint: {x: Math.round(rowRect.right - 24), y: Math.round(rowRect.y + rowRect.height / 2)}};
`,
    ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
  });

const locateHistoryMenuForUrl = async (input: { browser: BrowserController; staleUrl: string; providerKind: string; abortSignal?: AbortSignal }): Promise<DomClickTarget> =>
  input.browser.evaluateActiveTab<DomClickTarget>({
    description: `locate stale ${providerLabel(input.providerKind)} conversation history menu`,
    script: `
const targetUrl = ${JSON.stringify(input.staleUrl)};
${resolveHistoryRowScript}
const norm = (value) => String(value || "").trim();
const link = findHistoryLink(targetUrl);
if (!link) return {status: "not_found"};
const row = resolveHistoryRow(link);
if (!row || typeof row.getBoundingClientRect !== "function") return {status: "row_not_found"};
const rowRect = row.getBoundingClientRect();
const linkLabel = norm(link.textContent);
const controls = Array.from(document.querySelectorAll('button, [role="button"]')).filter((node) => {
  if (!visible(node)) return false;
  const rect = node.getBoundingClientRect();
  return rect.top >= rowRect.top - 8 && rect.bottom <= rowRect.bottom + 8 && rect.left >= rowRect.left && rect.right <= rowRect.right + 220;
});
const more = controls.find((node) => {
  const aria = norm(node.getAttribute("aria-label"));
  const label = (aria + " " + norm(node.textContent)).toLowerCase();
  return (linkLabel && aria.includes(linkLabel) && aria.includes("对话选项"))
    || (linkLabel && aria.includes("More options for " + linkLabel))
    || label.includes("more")
    || label.includes("option")
    || label.includes("menu")
    || label.includes("更多")
    || label.includes("选项")
    || label.includes("操作");
}) || controls[controls.length - 1];
if (!more || typeof more.getBoundingClientRect !== "function") return {status: "menu_button_not_found"};
const rect = more.getBoundingClientRect();
return {status: "menu_located", clickPoint: {x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2)}};
`,
    ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
  });

const dispatchRowMouseEnter = async (input: { browser: BrowserController; staleUrl: string; providerKind: string; abortSignal?: AbortSignal }): Promise<void> => {
  await input.browser.evaluateActiveTab<void>({
    description: `dispatch mouseenter on stale ${providerLabel(input.providerKind)} conversation row to reveal menu button`,
    script: `
const targetUrl = ${JSON.stringify(input.staleUrl)};
${resolveHistoryRowScript}
const anchor = findHistoryLink(targetUrl);
const row = anchor ? resolveHistoryRow(anchor) : null;
if (row instanceof HTMLElement) {
  row.scrollIntoView({ block: "center" });
  row.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true, cancelable: true }));
  row.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true }));
}
`,
    ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
  });
};

const pollForHistoryMenuButton = async (input: {
  browser: BrowserController;
  staleUrl: string;
  providerKind: string;
  abortSignal?: AbortSignal;
  maxWaitMs: number;
}): Promise<DomClickTarget> => {
  const deadline = Date.now() + input.maxWaitMs;
  let last: DomClickTarget = { status: "menu_button_not_found" };
  while (Date.now() < deadline) {
    last = await locateHistoryMenuForUrl(input);
    if (last.status === "menu_located") return last;
    await input.browser.wait(150);
  }
  return last;
};

const openHistoryMenuForUrl = async (input: {
  browser: BrowserController;
  staleUrl: string;
  providerKind: string;
  abortSignal?: AbortSignal;
}): Promise<string> => {
  await ensureProviderHistorySidebarOpen(input);
  const openDelete = await locateOpenHistoryDeleteAction(input);
  if (openDelete.status === "delete_action_located") return "menu_opened";

  const rowTarget = await locateHistoryRowForUrl(input);
  if (!rowTarget.clickPoint || rowTarget.status !== "row_located") return rowTarget.status;
  const moved = await input.browser.move?.({
    targetLabel: `stale ${providerLabel(input.providerKind)} conversation row hover`,
    point: rowTarget.clickPoint,
    coordinateSpace: "browserViewport",
  });
  if (moved && !moved.ok) return "row_hover_failed";
  await dispatchRowMouseEnter(input);
  await input.browser.wait(600);
  const target = await pollForHistoryMenuButton({ ...input, maxWaitMs: 1_000 });
  const result = await nativeClick(input.browser, target, "menu_located", `stale ${providerLabel(input.providerKind)} conversation options`);
  return result === "menu_clicked" ? "menu_opened" : result;
};

const clickHistoryDeleteAction = async (input: {
  browser: BrowserController;
  providerKind: string;
  abortSignal?: AbortSignal;
}): Promise<string> => {
  const target = await input.browser.evaluateActiveTab<DomClickTarget>({
    description: `locate stale ${providerLabel(input.providerKind)} conversation delete action`,
    script: `
const visible = (node) => {
  if (!node || typeof node.getBoundingClientRect !== "function") return false;
  const rect = node.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
};
const candidates = Array.from(document.querySelectorAll('[role="menuitem"], button, [role="button"]')).filter(visible);
const target = candidates.find((node) => {
  const label = ((node.getAttribute("aria-label") || "") + " " + (node.textContent || "")).toLowerCase();
  return label.includes("delete") || label.includes("删除");
});
if (!target || typeof target.getBoundingClientRect !== "function") return {status: "delete_action_not_found"};
const rect = target.getBoundingClientRect();
return {status: "delete_action_located", clickPoint: {x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2)}};
`,
    ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
  });
  return nativeClick(input.browser, target, "delete_action_located", `stale ${providerLabel(input.providerKind)} conversation delete action`);
};

const confirmHistoryDeletion = async (input: {
  browser: BrowserController;
  providerKind: string;
  abortSignal?: AbortSignal;
}): Promise<string> => {
  const target = await input.browser.evaluateActiveTab<DomClickTarget>({
    description: `locate stale ${providerLabel(input.providerKind)} conversation deletion confirmation`,
    script: `
const visible = (node) => {
  if (!node || typeof node.getBoundingClientRect !== "function") return false;
  const rect = node.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
};
const scopes = [...Array.from(document.querySelectorAll('[role="dialog"], [data-radix-portal]')).filter(visible), document.body];
const deleteChatDialog = scopes.find((scope) => String(scope.textContent || "").includes("Delete chat"));
const candidates = scopes.flatMap((scope) => Array.from(scope.querySelectorAll('button, [role="button"]')).filter(visible));
const scopedCandidates = deleteChatDialog
  ? Array.from(deleteChatDialog.querySelectorAll('button, [role="button"]')).filter(visible)
  : candidates;
const target = scopedCandidates.reverse().find((node) => {
  const label = ((node.getAttribute("aria-label") || "") + " " + (node.textContent || "")).toLowerCase();
  return label.includes("delete") || label.includes("删除");
});
if (!target || typeof target.getBoundingClientRect !== "function") return {status: "confirm_delete_not_found"};
const rect = target.getBoundingClientRect();
return {status: "confirm_delete_located", clickPoint: {x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2)}};
`,
    ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
  });
  return nativeClick(input.browser, target, "confirm_delete_located", `confirm stale ${providerLabel(input.providerKind)} conversation deletion`);
};

const verifyHistoryDeleted = async (input: {
  browser: BrowserController;
  staleUrl: string;
  providerKind: string;
  abortSignal?: AbortSignal;
}): Promise<boolean> => {
  await input.browser.wait(600);
  await ensureProviderHistorySidebarOpen(input);
  const result = await input.browser.evaluateActiveTab<{ status: string }>({
    description: `verify stale ${providerLabel(input.providerKind)} conversation disappeared from live history DOM`,
    script: `
const targetUrl = ${JSON.stringify(input.staleUrl)};
const targetPath = (() => {
  try { return new URL(targetUrl).pathname; } catch { return targetUrl; }
})();
const anchors = Array.from(document.querySelectorAll('a[href]'));
const link = anchors.find((anchor) => {
  const href = anchor.href || anchor.getAttribute("href") || "";
  if (href === targetUrl) return true;
  try { return new URL(href, location.href).pathname === targetPath; } catch { return false; }
});
return {status: link ? "still_present" : "deleted"};
`,
    ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
  });
  return result.status === "deleted";
};

const STALE_CLEANUP_TRIGGER_THRESHOLD = 15;
const STALE_CLEANUP_MAX_PER_RUN = 3;
export const GEMINI_STALE_CLEANUP_MAX_PER_RUN = 80;

const staleCleanupTriggerThreshold = (input: Pick<HistoryCleanupInput, "triggerThreshold">): number =>
  input.triggerThreshold ?? STALE_CLEANUP_TRIGGER_THRESHOLD;

const staleCleanupMaxPerRun = (input: Pick<HistoryCleanupInput, "providerKind" | "maxDeleteCount">): number =>
  input.maxDeleteCount ?? (input.providerKind === "gemini-web-chat" ? GEMINI_STALE_CLEANUP_MAX_PER_RUN : STALE_CLEANUP_MAX_PER_RUN);

const deleteOpenedHistoryUrl = async (input: {
  browser: BrowserController;
  staleUrl: string;
  providerKind: string;
  abortSignal?: AbortSignal;
}): Promise<boolean> => {
  await input.browser.wait(350);
  const deleteStatus = await clickHistoryDeleteAction({ browser: input.browser, providerKind: input.providerKind, ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}) });
  if (deleteStatus !== "delete_action_clicked") return false;
  await input.browser.wait(350);
  const confirmStatus = await confirmHistoryDeletion({ browser: input.browser, providerKind: input.providerKind, ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}) });
  if (confirmStatus !== "confirm_delete_clicked") return false;
  if (input.providerKind === "gemini-web-chat") {
    await input.browser.wait(500);
    return true;
  }
  return verifyHistoryDeleted({ browser: input.browser, staleUrl: input.staleUrl, providerKind: input.providerKind, ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}) });
};

const discoverNextLegacyUrls = async (input: HistoryCleanupInput, attemptedUrls: Set<string>, notFoundAttemptsByUrl: Map<string, number>, remainingSlots: number): Promise<string[]> => {
  const protectedPaths = readWorkspaceConversationLedger(input).slice(-input.keepRecentCount).map(toUrlPath);
  const newlyVisibleLegacyUrls = await discoverLegacyPick3HistoryUrls({ browser: input.browser, providerKind: input.providerKind, protectedPaths, ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}) });
  return newlyVisibleLegacyUrls.filter((staleUrl) => !attemptedUrls.has(staleUrl) && (notFoundAttemptsByUrl.get(staleUrl) ?? 0) < 2).slice(0, remainingSlots);
};

export const cleanupStaleWorkspaceConversationHistory = async (input: HistoryCleanupInput): Promise<string> => {
  return `provider_history_delete_temporarily_disabled:${providerLabel(input.providerKind)}`;
  const staleUrls = await staleHistoryUrls(input);
  if (staleUrls.length === 0) return "history_not_needed";
  const triggerThreshold = staleCleanupTriggerThreshold(input);
  if (staleUrls.length < triggerThreshold) {
    return `history_cleanup_deferred_stale_${staleUrls.length}_below_threshold_${triggerThreshold}`;
  }

  const maxDeletes = staleCleanupMaxPerRun(input);
  let urlsToDelete = staleUrls.slice(0, maxDeletes);
  const attemptedUrls = new Set<string>();
  const notFoundAttemptsByUrl = new Map<string, number>();
  let operationCount = 0;
  let deletedCount = 0;
  let notFoundCount = 0;
  let failedCount = 0;
  while (urlsToDelete.length > 0 && operationCount < maxDeletes) {
    for (const staleUrl of urlsToDelete) {
      const menuStatus = await openHistoryMenuForUrl({
        browser: input.browser,
        staleUrl,
        providerKind: input.providerKind,
        ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
      });
      if (menuStatus === "not_found") {
        notFoundCount += 1;
        notFoundAttemptsByUrl.set(staleUrl, (notFoundAttemptsByUrl.get(staleUrl) ?? 0) + 1);
        continue;
      }
      operationCount += 1;
      attemptedUrls.add(staleUrl);
      if (menuStatus !== "menu_opened") {
        failedCount += 1;
        continue;
      }

      if (await deleteOpenedHistoryUrl({ browser: input.browser, staleUrl, providerKind: input.providerKind, ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}) })) {
        deletedCount += 1;
      } else {
        failedCount += 1;
      }
    }
    const remainingSlots = maxDeletes - operationCount;
    if (remainingSlots <= 0) break;
    urlsToDelete = await discoverNextLegacyUrls(input, attemptedUrls, notFoundAttemptsByUrl, remainingSlots);
  }

  const remainingLegacyUrls = await discoverLegacyPick3HistoryUrls({
    browser: input.browser,
    providerKind: input.providerKind,
    protectedPaths: readWorkspaceConversationLedger(input).slice(-input.keepRecentCount).map(toUrlPath),
    ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
  });
  failedCount += remainingLegacyUrls.length;

  return `history_deleted_${deletedCount}_not_found_${notFoundCount}_failed_${failedCount}`;
};
