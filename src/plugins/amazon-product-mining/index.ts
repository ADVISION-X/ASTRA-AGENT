import { randomUUID } from "node:crypto";

import type { AiInputGatewayAbilityGroup } from "../../capabilities/ai-input-gateway/index.js";
import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import { runAmazonProductMiningFlow } from "./amazon-product-mining.flow.js";
import type { AmazonFlowResult } from "./amazon-product-mining.flow.js";
import { createKeywordProgress, taskRecordToResult } from "./amazon-product-mining.result.js";
import { AmazonMiningSchemas } from "./amazon-product-mining.schema.js";
import type { AmazonMiningInput, AmazonTaskRecord } from "./amazon-product-mining.schema.js";
import {
  getAmazonProductMiningKeywordReviewHistoryEntry,
  listAmazonProductMiningKeywordReviewHistory,
} from "./amazon-product-mining.keyword-review-history.js";
import { createAmazonProductMiningPackageZip } from "./amazon-product-mining.package-zip.js";
import { ingestManualKeywordOpportunityReview } from "./amazon-product-mining.keyword-review.js";
import { createAmazonMiningStorage } from "./amazon-product-mining.storage.js";
import type { AmazonMiningStorage } from "./amazon-product-mining.storage.js";

export type { AmazonFlowResult } from "./amazon-product-mining.flow.js";
export { AmazonMiningSchemas } from "./amazon-product-mining.schema.js";

const ACTIVE_AMAZON_MINING_TASKS = new Map<string, Promise<AmazonFlowResult>>();

type AmazonProductMiningRuntimeInput = {
  dataDir: string;
  browser: BrowserController;
  aiInputGateway: AiInputGatewayAbilityGroup;
  runtimeLogger: RuntimeLogger;
};

const RUNNING_TASK_STATUSES = [
  "created",
  "keyword_generating",
  "keyword_ready",
  "mining",
  "packaging",
] as const;

const taskRecordToMiningInput = (
  task: AmazonTaskRecord,
): AmazonMiningInput => ({
  taskId: task.taskId,
  amazonMarketplace: task.amazonMarketplace,
  targetMarket: task.targetMarket,
  productDirection: task.productDirection,
  requestedKeywordCount: task.requestedKeywordCount,
  languagePreference: task.languagePreference,
  providerKind: task.providerKind,
});

const buildTaskReadModel = (
  storage: AmazonMiningStorage,
  task: AmazonTaskRecord,
): AmazonFlowResult => {
  const details = storage.getProductDetailsForTask(task.taskId);
  const reviewsByDetailId = new Map(details.map((detail) => [
    detail.detailId,
    storage.getReviewsForProduct(detail.detailId).length,
  ]));
  const linkedDetailIdsBySearchItemId = new Map(
    storage.getSearchResultProductLinksForTask(task.taskId).map((link) => [link.itemId, link.detailId]),
  );
  const keywordProgress = storage.getKeywordsForTask(task.taskId).map((keyword) => {
    const searchResults = storage.getSearchResultsForKeyword(keyword.keywordId);
    const detailIds = new Set(searchResults
      .map((searchResult) => linkedDetailIdsBySearchItemId.get(searchResult.itemId))
      .filter((detailId): detailId is string => typeof detailId === "string" && detailId.length > 0));
    const reviewCount = [...detailIds].reduce((total, detailId) => total + (reviewsByDetailId.get(detailId) ?? 0), 0);
    return createKeywordProgress(keyword, {
      searchResultCount: searchResults.length,
      productDetailCount: detailIds.size,
      reviewCount,
    });
  });
  const keywordReviewCount = storage.listKeywordOpportunityReviews({ taskId: task.taskId }).length;
  return taskRecordToResult(task, {
    keywordReviewCount,
    keywords: keywordProgress,
  });
};

const runAmazonProductMiningTaskOnce = (
  miningInput: AmazonMiningInput,
  input: AmazonProductMiningRuntimeInput,
): string => {
  const taskId = miningInput.taskId ?? randomUUID();
  if (ACTIVE_AMAZON_MINING_TASKS.has(taskId)) {
    return taskId;
  }
  const backgroundRun = runAmazonProductMiningFlow({
    miningInput,
    taskId,
    dataDir: input.dataDir,
    browser: input.browser,
    aiInputGateway: input.aiInputGateway,
    runtimeLogger: input.runtimeLogger,
    providerKind: miningInput.providerKind,
  }).finally(() => {
    ACTIVE_AMAZON_MINING_TASKS.delete(taskId);
  });
  backgroundRun.catch(() => undefined);
  ACTIVE_AMAZON_MINING_TASKS.set(taskId, backgroundRun);
  return taskId;
};

export const startAmazonProductMiningMission = (input: {
  rawInput: unknown;
} & AmazonProductMiningRuntimeInput): { taskId: string } => {
  const miningInput = AmazonMiningSchemas.AmazonMiningInputSchema.parse(input.rawInput) as AmazonMiningInput;
  const taskId = runAmazonProductMiningTaskOnce(miningInput, input);

  return { taskId };
};

export const pauseAmazonProductMiningTask = (input: {
  dataDir: string;
  taskId: string;
}): AmazonFlowResult | null => {
  const storage = createAmazonMiningStorage(input.dataDir);
  try {
    const task = storage.getTask(input.taskId);
    if (!task) return null;
    if (task.status === "package_completed" || task.status === "failed" || task.status === "manual_required" || task.status === "terminated") {
      return buildTaskReadModel(storage, task);
    }
    const updated = storage.updateTaskStatus({ taskId: input.taskId, status: "paused" });
    return updated ? buildTaskReadModel(storage, updated) : null;
  } finally {
    storage.close();
  }
};

export const terminateAmazonProductMiningTask = (input: {
  dataDir: string;
  taskId: string;
}): AmazonFlowResult | null => {
  const storage = createAmazonMiningStorage(input.dataDir);
  try {
    const task = storage.getTask(input.taskId);
    if (!task) return null;
    if (task.status === "package_completed" || task.status === "failed" || task.status === "manual_required") {
      return buildTaskReadModel(storage, task);
    }
    const updated = storage.updateTaskStatus({ taskId: input.taskId, status: "terminated" });
    return updated ? buildTaskReadModel(storage, updated) : null;
  } finally {
    storage.close();
  }
};

export const continueAmazonProductMiningTask = (input: {
  taskId: string;
} & AmazonProductMiningRuntimeInput): { taskId: string } | null => {
  const storage = createAmazonMiningStorage(input.dataDir);
  try {
    const task = storage.getTask(input.taskId);
    if (!task || task.status === "terminated" || task.status === "package_completed") {
      return null;
    }
    if (task.status === "paused") {
      storage.updateTaskStatus({ taskId: input.taskId, status: "mining", operatorOverride: true });
    }
    const taskId = runAmazonProductMiningTaskOnce(taskRecordToMiningInput(task), input);
    return { taskId };
  } finally {
    storage.close();
  }
};

export const continueInterruptedAmazonProductMiningTasks = (
  input: AmazonProductMiningRuntimeInput,
): { taskIds: string[] } => {
  const storage = createAmazonMiningStorage(input.dataDir);
  try {
    const tasks = storage.listTasksByStatuses(RUNNING_TASK_STATUSES);
    const taskIds = tasks.map((task) => runAmazonProductMiningTaskOnce(taskRecordToMiningInput(task), input));
    return { taskIds };
  } finally {
    storage.close();
  }
};

export const getAmazonProductMiningTaskStatus = (input: {
  dataDir: string;
  taskId: string;
}): AmazonFlowResult | null => {
  const storage = createAmazonMiningStorage(input.dataDir);
  try {
    const task = storage.getTask(input.taskId);
    return task ? buildTaskReadModel(storage, task) : null;
  } finally {
    storage.close();
  }
};

export const getLatestAmazonProductMiningTask = (input: {
  dataDir: string;
}): AmazonFlowResult | null => {
  const storage = createAmazonMiningStorage(input.dataDir);
  try {
    const task = storage.getLatestTask();
    return task ? buildTaskReadModel(storage, task) : null;
  } finally {
    storage.close();
  }
};

export const listAmazonProductMiningKeywordReviews = (input: {
  dataDir: string;
  taskId?: string;
}) => {
  const storage = createAmazonMiningStorage(input.dataDir);
  try {
    return listAmazonProductMiningKeywordReviewHistory(storage, input.taskId ? { taskId: input.taskId } : undefined);
  } finally {
    storage.close();
  }
};

export const getAmazonProductMiningKeywordReview = (input: {
  dataDir: string;
  reviewId: string;
}) => {
  const storage = createAmazonMiningStorage(input.dataDir);
  try {
    return getAmazonProductMiningKeywordReviewHistoryEntry(storage, input.reviewId);
  } finally {
    storage.close();
  }
};

export const ingestAmazonProductMiningKeywordReview = (input: {
  dataDir: string;
  rawInput: unknown;
}) => {
  const storage = createAmazonMiningStorage(input.dataDir);
  try {
    return ingestManualKeywordOpportunityReview({
      dataDir: input.dataDir,
      storage,
      rawInput: input.rawInput,
    });
  } finally {
    storage.close();
  }
};

export const exportAmazonProductMiningResult = (input: {
  dataDir: string;
  taskId: string;
}): {
  packageJsonPath: string | null;
  evidenceIndexPath: string | null;
  pdfReportPath: string | null;
  packageZipPath: string | null;
} | null => {
  const storage = createAmazonMiningStorage(input.dataDir);
  try {
    const task = storage.getTask(input.taskId);
    if (!task) return null;
    const packageZipPath = task.packageJsonPath
      ? createAmazonProductMiningPackageZip({ dataDir: input.dataDir, taskId: input.taskId }).packageZipPath
      : null;
    return {
      packageJsonPath: task.packageJsonPath,
      evidenceIndexPath: task.evidenceIndexPath,
      pdfReportPath: task.pdfReportPath,
      packageZipPath,
    };
  } finally {
    storage.close();
  }
};
