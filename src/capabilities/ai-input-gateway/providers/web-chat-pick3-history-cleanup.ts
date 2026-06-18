import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import { readWorkspaceConversationLedger } from "./web-chat-workspace.js";

type HistoryCleanupInput = {
  browser: BrowserController;
  dataDir: string;
  providerKind: string;
  workspaceId: string;
  keepRecentCount: number;
  abortSignal?: AbortSignal;
};

type DomClickTarget = {
  status: string;
  clickPoint?: { x: number; y: number };
};

const PICK3_TRAINING_HISTORY_TITLE_MARKERS = [
  "Pick3 Blind Eval",
  "Blind Eval",
  "Blind Chart",
  "Blind Time-Series",
  "Blind Series",
  "Visual Pattern Prediction",
] as const;

const toUrlPath = (url: string): string => {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
};

const discoverLegacyPick3HistoryUrls = async (input: {
  browser: BrowserController;
  protectedPaths: readonly string[];
  abortSignal?: AbortSignal;
}): Promise<string[]> => input.browser.evaluateActiveTab<string[]>({
  description: "discover legacy Pick3 ChatGPT sidebar history entries",
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

const staleHistoryUrls = async (input: HistoryCleanupInput): Promise<string[]> => {
  const ledger = readWorkspaceConversationLedger(input);
  const protectedPaths = ledger.slice(-input.keepRecentCount).map(toUrlPath);
  const legacyPick3Urls = await discoverLegacyPick3HistoryUrls({
    browser: input.browser,
    protectedPaths,
    ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
  });
  return Array.from(new Set([
    ...ledger.slice(0, Math.max(0, ledger.length - input.keepRecentCount)),
    ...legacyPick3Urls,
  ]));
};

const nativeClick = async (
  browser: BrowserController,
  target: DomClickTarget,
  expectedStatus: string,
  targetLabel: string,
): Promise<string> => {
  if (!target.clickPoint || target.status !== expectedStatus) return target.status;
  const clicked = await browser.click({
    targetLabel,
    point: target.clickPoint,
    coordinateSpace: "browserViewport",
    button: "left",
    clickCount: 1,
  });
  return clicked.ok ? `${expectedStatus.replace("_located", "")}_clicked` : `${expectedStatus}_click_failed`;
};

const locateHistoryRowForUrl = async (input: {
  browser: BrowserController;
  staleUrl: string;
  abortSignal?: AbortSignal;
}): Promise<DomClickTarget> =>
  input.browser.evaluateActiveTab<DomClickTarget>({
    description: "locate stale ChatGPT conversation history row",
    script: `
const targetUrl = ${JSON.stringify(input.staleUrl)};
const targetPath = (() => {
  try { return new URL(targetUrl).pathname; } catch { return targetUrl; }
})();
const visible = (node) => {
  if (!node || typeof node.getBoundingClientRect !== "function") return false;
  const rect = node.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
};
const norm = (value) => String(value || "").trim();
const anchors = Array.from(document.querySelectorAll('a[href]')).filter(visible);
const link = anchors.find((anchor) => {
  const href = anchor.href || anchor.getAttribute("href") || "";
  if (href === targetUrl) return true;
  try { return new URL(href, location.href).pathname === targetPath; } catch { return false; }
});
if (!link) return {status: "not_found"};
const row = link.closest('[data-testid], li, div') || link.parentElement;
if (!row || typeof row.getBoundingClientRect !== "function") return {status: "row_not_found"};
row.scrollIntoView({block: "center"});
const rowRect = row.getBoundingClientRect();
return {status: "row_located", clickPoint: {x: Math.round(rowRect.right - 24), y: Math.round(rowRect.y + rowRect.height / 2)}};
`,
    ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
  });

const locateHistoryMenuForUrl = async (input: {
  browser: BrowserController;
  staleUrl: string;
  abortSignal?: AbortSignal;
}): Promise<DomClickTarget> =>
  input.browser.evaluateActiveTab<DomClickTarget>({
    description: "locate stale ChatGPT conversation history menu",
    script: `
const targetUrl = ${JSON.stringify(input.staleUrl)};
const targetPath = (() => {
  try { return new URL(targetUrl).pathname; } catch { return targetUrl; }
})();
const visible = (node) => {
  if (!node || typeof node.getBoundingClientRect !== "function") return false;
  const rect = node.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
};
const norm = (value) => String(value || "").trim();
const anchors = Array.from(document.querySelectorAll('a[href]')).filter(visible);
const link = anchors.find((anchor) => {
  const href = anchor.href || anchor.getAttribute("href") || "";
  if (href === targetUrl) return true;
  try { return new URL(href, location.href).pathname === targetPath; } catch { return false; }
});
if (!link) return {status: "not_found"};
const row = link.closest('[data-testid], li, div') || link.parentElement;
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

const openHistoryMenuForUrl = async (input: {
  browser: BrowserController;
  staleUrl: string;
  abortSignal?: AbortSignal;
}): Promise<string> => {
  const rowTarget = await locateHistoryRowForUrl(input);
  if (!rowTarget.clickPoint || rowTarget.status !== "row_located") return rowTarget.status;
  const moved = await input.browser.move?.({
    targetLabel: "stale ChatGPT conversation row hover",
    point: rowTarget.clickPoint,
    coordinateSpace: "browserViewport",
  });
  if (moved && !moved.ok) return "row_hover_failed";
  await input.browser.wait(250);
  const target = await locateHistoryMenuForUrl(input);
  const result = await nativeClick(input.browser, target, "menu_located", "stale ChatGPT conversation options");
  return result === "menu_clicked" ? "menu_opened" : result;
};

const clickHistoryDeleteAction = async (input: {
  browser: BrowserController;
  abortSignal?: AbortSignal;
}): Promise<string> => {
  const target = await input.browser.evaluateActiveTab<DomClickTarget>({
    description: "locate stale ChatGPT conversation delete action",
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
  return nativeClick(input.browser, target, "delete_action_located", "stale ChatGPT conversation delete action");
};

const confirmHistoryDeletion = async (input: {
  browser: BrowserController;
  abortSignal?: AbortSignal;
}): Promise<string> => {
  const target = await input.browser.evaluateActiveTab<DomClickTarget>({
    description: "locate stale ChatGPT conversation deletion confirmation",
    script: `
const visible = (node) => {
  if (!node || typeof node.getBoundingClientRect !== "function") return false;
  const rect = node.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
};
const scopes = [...Array.from(document.querySelectorAll('[role="dialog"], [data-radix-portal]')).filter(visible), document.body];
const candidates = scopes.flatMap((scope) => Array.from(scope.querySelectorAll('button, [role="button"]')).filter(visible));
const target = candidates.reverse().find((node) => {
  const label = ((node.getAttribute("aria-label") || "") + " " + (node.textContent || "")).toLowerCase();
  return label.includes("delete") || label.includes("删除");
});
if (!target || typeof target.getBoundingClientRect !== "function") return {status: "confirm_delete_not_found"};
const rect = target.getBoundingClientRect();
return {status: "confirm_delete_located", clickPoint: {x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2)}};
`,
    ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
  });
  return nativeClick(input.browser, target, "confirm_delete_located", "confirm stale ChatGPT conversation deletion");
};

const verifyHistoryDeleted = async (input: {
  browser: BrowserController;
  staleUrl: string;
  abortSignal?: AbortSignal;
}): Promise<boolean> => {
  await input.browser.open({
    url: "https://chatgpt.com/",
    title: "Refresh ChatGPT sidebar history after deletion",
    reusePolicy: "reuse-active-tab",
  });
  await input.browser.wait(1800);
  const result = await input.browser.evaluateActiveTab<{ status: string }>({
    description: "verify stale ChatGPT conversation deleted from refreshed history",
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

export const cleanupStaleWorkspaceConversationHistory = async (input: HistoryCleanupInput): Promise<string> => {
  const staleUrls = await staleHistoryUrls(input);
  if (staleUrls.length === 0) return "history_not_needed";

  let deletedCount = 0;
  let notFoundCount = 0;
  let failedCount = 0;
  for (const staleUrl of staleUrls) {
    const menuStatus = await openHistoryMenuForUrl({
      browser: input.browser,
      staleUrl,
      ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
    });
    if (menuStatus === "not_found") {
      notFoundCount += 1;
      continue;
    }
    if (menuStatus !== "menu_opened") {
      failedCount += 1;
      continue;
    }

    await input.browser.wait(350);
    const deleteStatus = await clickHistoryDeleteAction({
      browser: input.browser,
      ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
    });
    if (deleteStatus !== "delete_action_clicked") {
      failedCount += 1;
      continue;
    }

    await input.browser.wait(350);
    const confirmStatus = await confirmHistoryDeletion({
      browser: input.browser,
      ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
    });
    if (confirmStatus !== "confirm_delete_clicked") {
      failedCount += 1;
      continue;
    }

    if (await verifyHistoryDeleted({
      browser: input.browser,
      staleUrl,
      ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
    })) {
      deletedCount += 1;
    } else {
      failedCount += 1;
    }
  }

  const remainingLegacyUrls = await discoverLegacyPick3HistoryUrls({
    browser: input.browser,
    protectedPaths: readWorkspaceConversationLedger(input).slice(-input.keepRecentCount).map(toUrlPath),
    ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
  });
  failedCount += remainingLegacyUrls.length;

  return `history_deleted_${deletedCount}_not_found_${notFoundCount}_failed_${failedCount}`;
};

export const deletePick3WorkspaceConversationHistoryUrl = async (input: {
  browser: BrowserController;
  conversationUrl: string;
  abortSignal?: AbortSignal;
}): Promise<string> => {
  const menuStatus = await openHistoryMenuForUrl({
    browser: input.browser,
    staleUrl: input.conversationUrl,
    ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
  });
  if (menuStatus === "not_found") return "current_history_not_found";
  if (menuStatus !== "menu_opened") return `current_history_${menuStatus}`;

  await input.browser.wait(350);
  const deleteStatus = await clickHistoryDeleteAction({
    browser: input.browser,
    ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
  });
  if (deleteStatus !== "delete_action_clicked") return `current_history_${deleteStatus}`;

  await input.browser.wait(350);
  const confirmStatus = await confirmHistoryDeletion({
    browser: input.browser,
    ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
  });
  if (confirmStatus !== "confirm_delete_clicked") return `current_history_${confirmStatus}`;

  return await verifyHistoryDeleted({
    browser: input.browser,
    staleUrl: input.conversationUrl,
    ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
  })
    ? "current_history_deleted"
    : "current_history_delete_verify_failed";
};
