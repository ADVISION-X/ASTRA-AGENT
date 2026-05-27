import { mkdirSync } from "node:fs";
import { join } from "node:path";

import type {
  AmazonExceptionRecord,
  AmazonSearchResultItem,
} from "./amazon-product-mining.package-artifact-builders.js";
import type { AmazonPackageLayout } from "./amazon-product-mining.package-layout.js";
import { toPackageRelativePath, writeTextFile } from "./amazon-product-mining.package-evidence-shared.js";
import type { AmazonMiningStorage } from "./amazon-product-mining.storage.js";

type AmazonAiKeywordRunRecord = ReturnType<AmazonMiningStorage["getAiKeywordRunsForTask"]>[number];
type AmazonSearchResultProductLink = ReturnType<AmazonMiningStorage["getSearchResultProductLinksForTask"]>[number];

export const buildExceptionScopeMap = (
  exceptions: readonly AmazonExceptionRecord[],
): Map<string, string[]> => {
  const scopeMap = new Map<string, string[]>();
  for (const exception of exceptions) {
    if (!exception.scopeId) continue;
    const ids = scopeMap.get(exception.scopeId) ?? [];
    ids.push(exception.exceptionId);
    scopeMap.set(exception.scopeId, ids);
  }
  return scopeMap;
};

export const buildLinkedSearchItemsByDetailId = (
  allSearchResults: readonly AmazonSearchResultItem[],
  links: readonly AmazonSearchResultProductLink[],
): Map<string, AmazonSearchResultItem[]> => {
  const itemsById = new Map(allSearchResults.map((item) => [item.itemId, item]));
  const linkedSearchItems = new Map<string, AmazonSearchResultItem[]>();
  for (const link of links) {
    const item = itemsById.get(link.itemId);
    if (!item) continue;
    const rows = linkedSearchItems.get(link.detailId) ?? [];
    rows.push(item);
    linkedSearchItems.set(link.detailId, rows);
  }
  for (const rows of linkedSearchItems.values()) {
    rows.sort((left, right) => left.rankPosition - right.rankPosition);
  }
  return linkedSearchItems;
};

export const writeAiKeywordRunArtifacts = (input: {
  layout: AmazonPackageLayout;
  aiKeywordRuns: readonly AmazonAiKeywordRunRecord[];
}) =>
  input.aiKeywordRuns.map((run) => {
    const runDir = join(input.layout.aiKeywordRunsDir, `run-${run.runId}`);
    mkdirSync(runDir, { recursive: true });
    writeTextFile(join(runDir, "prompt.txt"), run.promptText);
    writeTextFile(join(runDir, "raw-response.txt"), run.rawResponse);
    return {
      runId: run.runId,
      promptTextRef: toPackageRelativePath(input.layout.packageRootPath, join(runDir, "prompt.txt")),
      rawResponseRef: toPackageRelativePath(input.layout.packageRootPath, join(runDir, "raw-response.txt")),
      parsedKeywords: run.parsedKeywords,
      dedupedKeywords: run.dedupedKeywords,
      status: run.status,
      failureReason: run.failureReason,
      createdAt: run.createdAt,
    };
  });