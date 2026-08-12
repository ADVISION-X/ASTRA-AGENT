import {
  AmazonMiningContinueInputSchema,
  AmazonMiningInputSchema,
  continueInterruptedAmazonProductMiningTasks,
  startAmazonProductMiningMission,
} from "../plugins/amazon-product-mining/index.js";

type AmazonProductMiningRuntime = Omit<
  Parameters<typeof startAmazonProductMiningMission>[0],
  "rawInput"
>;

export const runAmazonProductMiningRoute = (
  rawInput: unknown,
  runtime: AmazonProductMiningRuntime,
) => startAmazonProductMiningMission({
  ...runtime,
  rawInput: AmazonMiningInputSchema.parse(rawInput),
});

export const runContinueAmazonProductMiningRoute = (
  rawInput: unknown,
  runtime: AmazonProductMiningRuntime,
) => continueInterruptedAmazonProductMiningTasks({
  ...runtime,
  ...AmazonMiningContinueInputSchema.parse(rawInput),
});
