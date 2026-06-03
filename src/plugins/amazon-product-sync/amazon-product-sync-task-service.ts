import type { BrowserController } from "../../lib/browser/browser-controller.js";
import { createId } from "../../lib/local-runtime/ids.js";
import { runAmazonProductSyncFlow } from "./amazon-product-sync.flow.js";
import {
  AmazonProductSyncInputSchema,
  type AmazonProductSyncInput,
  type AmazonProductSyncTaskRecord,
} from "./amazon-product-sync.schema.js";
import {
  persistAmazonProductSyncTask,
  readAmazonProductSyncTask,
  readLatestAmazonProductSyncTask,
} from "./amazon-product-sync.storage.js";

export type AmazonProductSyncRuntime = {
  readonly dataDir: string;
  readonly browser: BrowserController;
};

const initialTask = (mission: AmazonProductSyncInput, taskId = createId("amazon_product_sync")): AmazonProductSyncTaskRecord => {
  const now = new Date().toISOString();
  return {
    taskId,
    requestId: mission.requestId,
    marketplace: mission.marketplace,
    ok: false,
    status: "queued",
    reason: null,
    reachedStep: "queued",
    items: [],
    createdAt: now,
    updatedAt: now,
  };
};

export const startAmazonProductSyncTask = async (
  rawInput: unknown,
  runtime: AmazonProductSyncRuntime,
): Promise<AmazonProductSyncTaskRecord> => {
  const mission = AmazonProductSyncInputSchema.parse(rawInput);
  const queued = await persistAmazonProductSyncTask(runtime.dataDir, initialTask(mission));
  const running = await persistAmazonProductSyncTask(runtime.dataDir, {
    ...queued,
    status: "running",
    reachedStep: "flow_started",
    updatedAt: new Date().toISOString(),
  });
  void runAmazonProductSyncFlow({
    browser: runtime.browser,
    mission,
    taskId: queued.taskId,
    createdAt: queued.createdAt,
  })
    .then((result) => persistAmazonProductSyncTask(runtime.dataDir, result))
    .catch((error) => persistAmazonProductSyncTask(runtime.dataDir, {
      ...running,
      ok: false,
      status: "failed",
      reason: error instanceof Error ? error.message : String(error),
      reachedStep: "flow_failed",
      updatedAt: new Date().toISOString(),
    }));
  return running;
};

export const getAmazonProductSyncTaskStatus = (
  input: { readonly dataDir: string; readonly taskId: string },
): Promise<AmazonProductSyncTaskRecord | null> =>
  readAmazonProductSyncTask(input.dataDir, input.taskId);

export const getLatestAmazonProductSyncTask = (
  input: { readonly dataDir: string },
): Promise<AmazonProductSyncTaskRecord | null> =>
  readLatestAmazonProductSyncTask(input.dataDir);

