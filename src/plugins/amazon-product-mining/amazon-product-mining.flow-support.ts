import { randomUUID } from "node:crypto";
import type { BrowserTargetSession } from "../../lib/browser/browser-controller.js";

export type AmazonMiningPacingDelayRange = {
  min: number;
  max: number;
};

export const selectAmazonMiningPacingDelayMs = (
  range: AmazonMiningPacingDelayRange,
  randomValue = Math.random(),
): number => Math.floor(randomValue * (range.max - range.min + 1)) + range.min;

export const waitForAmazonMiningPacingDelay = async (
  browser: BrowserTargetSession,
  range: AmazonMiningPacingDelayRange,
): Promise<void> => {
  await browser.wait(selectAmazonMiningPacingDelayMs(range));
};

export const resolveAmazonItemAsin = (productUrl: string, asinIfAvailable: string | null): string =>
  asinIfAvailable ?? productUrl.match(/\/dp\/([A-Z0-9]{10})/)?.[1] ?? productUrl;

export const selectSearchItemsForDetailMining = <T extends { rankPosition: number }>(
  items: readonly T[],
  detailRankLimit: number,
): T[] => [...items]
  .sort((left, right) => left.rankPosition - right.rankPosition)
  .filter((item) => item.rankPosition <= detailRankLimit);

export const openDedicatedAmazonMiningTab = async (
  browser: BrowserTargetSession,
  taskId: string,
): Promise<void> => {
  await browser.open({
    url: "about:blank",
    title: `Amazon mining workspace: ${taskId}`,
    reusePolicy: "open-new-tab",
  });
};

export const buildPackageInput = <TStorage>(runtime: {
  taskId: string;
  dataDir: string;
  storage: TStorage;
  ctx: { reviewMaxPages?: number };
}, detailRankLimit: number) => ({
  taskId: runtime.taskId,
  dataDir: runtime.dataDir,
  storage: runtime.storage,
  detailRankLimit,
  ...(runtime.ctx.reviewMaxPages !== undefined ? { reviewMaxPages: runtime.ctx.reviewMaxPages } : {}),
});

export const didAllKeywordsFail = (runtime: {
  taskId: string;
  storage: {
    getKeywordsForTask(taskId: string): Array<{ status: string }>;
  };
}): boolean => {
  const keywords = runtime.storage.getKeywordsForTask(runtime.taskId);
  return keywords.length > 0
    && keywords.every((keyword) => keyword.status === "failed" || keyword.status === "manual_required");
};

export const recordSearchFailure = (
  runtime: {
    logger: {
      logFailure(input: { taskId: string; scope: string; scopeId: string; reason: string }): void;
    };
    failureReasons: string[];
    storage: {
      persistException(input: {
        exceptionId: string;
        taskId: string;
        scope: string;
        scopeId: string;
        exceptionKind: string;
        message: string;
      }): void;
      updateKeywordStatus(input: { keywordId: string; status: "failed" }): void;
    };
    taskId: string;
  },
  keywordId: string,
  blockerKind: string,
  reason: string,
): void => {
  runtime.storage.updateKeywordStatus({ keywordId, status: "failed" });
  runtime.storage.persistException({
    exceptionId: randomUUID(),
    taskId: runtime.taskId,
    scope: "search",
    scopeId: keywordId,
    exceptionKind: blockerKind,
    message: reason,
  });
  runtime.logger.logFailure({ taskId: runtime.taskId, scope: "search", scopeId: keywordId, reason });
  if (blockerKind === "login_required" || blockerKind === "captcha") {
    runtime.failureReasons.push(`search_blocked:${blockerKind}`);
  }
};
