import { randomUUID } from "node:crypto";

import type { AiInputGatewayAbilityGroup } from "../../capabilities/ai-input-gateway/index.js";
import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import { runAmazonProductMiningFlow } from "./amazon-product-mining.flow.js";
import type { AmazonFlowResult } from "./amazon-product-mining.flow.js";
import { taskRecordToResult } from "./amazon-product-mining.result.js";
import { AmazonMiningSchemas } from "./amazon-product-mining.schema.js";
import type { AmazonMiningInput } from "./amazon-product-mining.schema.js";
import { createAmazonMiningStorage } from "./amazon-product-mining.storage.js";

export type { AmazonFlowResult } from "./amazon-product-mining.flow.js";
export { AmazonMiningSchemas } from "./amazon-product-mining.schema.js";

const ACTIVE_AMAZON_MINING_TASKS = new Map<string, Promise<AmazonFlowResult>>();

export const startAmazonProductMiningMission = (input: {
  rawInput: unknown;
  dataDir: string;
  browser: BrowserController;
  aiInputGateway: AiInputGatewayAbilityGroup;
  runtimeLogger: RuntimeLogger;
}): { taskId: string } => {
  const miningInput = AmazonMiningSchemas.AmazonMiningInputSchema.parse(input.rawInput) as AmazonMiningInput;
  const taskId = miningInput.taskId ?? randomUUID();

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

  return { taskId };
};

export const getAmazonProductMiningTaskStatus = (input: {
  dataDir: string;
  taskId: string;
}): AmazonFlowResult | null => {
  const storage = createAmazonMiningStorage(input.dataDir);
  try {
    const task = storage.getTask(input.taskId);
    return task ? taskRecordToResult(task) : null;
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
    return task ? taskRecordToResult(task) : null;
  } finally {
    storage.close();
  }
};

export const exportAmazonProductMiningResult = (input: {
  dataDir: string;
  taskId: string;
}): { packageJsonPath: string | null; evidenceIndexPath: string | null; pdfReportPath: string | null } | null => {
  const storage = createAmazonMiningStorage(input.dataDir);
  try {
    const task = storage.getTask(input.taskId);
    if (!task) return null;
    return {
      packageJsonPath: task.packageJsonPath,
      evidenceIndexPath: task.evidenceIndexPath,
      pdfReportPath: task.pdfReportPath,
    };
  } finally {
    storage.close();
  }
};
