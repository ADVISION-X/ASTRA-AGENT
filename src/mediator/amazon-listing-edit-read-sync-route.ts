import {
  AmazonListingEditReadSyncInputSchema,
  startAmazonListingEditReadSyncTask,
} from "../plugins/amazon-listing-edit-read-sync/index.js";

export const runAmazonListingEditReadSyncRoute = (
  rawInput: unknown,
  runtime: Parameters<typeof startAmazonListingEditReadSyncTask>[1],
) => startAmazonListingEditReadSyncTask(
  AmazonListingEditReadSyncInputSchema.parse(rawInput),
  runtime,
);
