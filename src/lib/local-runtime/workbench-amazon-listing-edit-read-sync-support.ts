import {
  getAmazonListingEditReadSyncTaskStatus,
  getLatestAmazonListingEditReadSyncTask,
} from "../../plugins/amazon-listing-edit-read-sync/index.js";
import { runAmazonListingEditReadSyncRoute } from "../../mediator/amazon-listing-edit-read-sync-route.js";
import type { WorkbenchAssembly } from "./workbench-assembly.js";

const readListingEditReadSyncTimeoutMs = (): number | undefined => {
  const value = process.env.AMAZON_LISTING_EDIT_READ_SYNC_TIMEOUT_MS?.trim();
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 300_000 ? parsed : undefined;
};

export const buildAmazonListingEditReadSyncHandle = (
  assembly: WorkbenchAssembly,
  dataDir: string,
) => ({
  async startAmazonListingEditReadSyncTask(rawInput: unknown) {
    const flowTimeoutMs = readListingEditReadSyncTimeoutMs();
    return runAmazonListingEditReadSyncRoute(rawInput, {
      dataDir,
      browser: assembly.browserController,
      runtimeLogger: assembly.runtimeLogger,
      ...(flowTimeoutMs ? { flowTimeoutMs } : {}),
    });
  },
  async getAmazonListingEditReadSyncTaskStatus(taskId: string) {
    return getAmazonListingEditReadSyncTaskStatus({
      dataDir,
      taskId,
    });
  },
  async getLatestAmazonListingEditReadSyncTask() {
    return getLatestAmazonListingEditReadSyncTask({
      dataDir,
    });
  },
});
