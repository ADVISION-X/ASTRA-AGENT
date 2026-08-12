import {
  AmazonProductFeeSyncInputSchema,
  startAmazonProductFeeSyncTask,
} from "../plugins/amazon-product-fee-sync/index.js";

export const runAmazonProductFeeSyncRoute = (
  rawInput: unknown,
  runtime: Parameters<typeof startAmazonProductFeeSyncTask>[1],
) => startAmazonProductFeeSyncTask(
  AmazonProductFeeSyncInputSchema.parse(rawInput),
  runtime,
);
