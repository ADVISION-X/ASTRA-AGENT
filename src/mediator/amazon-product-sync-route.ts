import {
  AmazonProductSyncInputSchema,
  startAmazonProductSyncTask,
} from "../plugins/amazon-product-sync/index.js";

export const runAmazonProductSyncRoute = (
  rawInput: unknown,
  runtime: Parameters<typeof startAmazonProductSyncTask>[1],
) => startAmazonProductSyncTask(
  AmazonProductSyncInputSchema.parse(rawInput),
  runtime,
);
