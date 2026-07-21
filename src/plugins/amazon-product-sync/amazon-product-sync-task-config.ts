import { createId } from "../../lib/local-runtime/ids.js";
import type { AmazonProductSyncInput, AmazonProductSyncTaskRecord } from "./amazon-product-sync.schema.js";

export const flowTimeoutReasonPrefix = "amazon_product_sync_flow_timeout_after_";
export const startupProgressStaleMs = 60_000;
export const activeProgressStaleMs = 45_000;
export const startupProgressWaitMs = 5_000;
export const runningProgressStaleReasonPrefix = "amazon_product_sync_running_progress_stale_after_";

export const buildInitialAmazonProductSyncTask = (
  mission: AmazonProductSyncInput,
  taskId = createId("amazon_product_sync"),
): AmazonProductSyncTaskRecord => {
  const now = new Date().toISOString();
  return {
    taskId,
    site: mission.site,
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
