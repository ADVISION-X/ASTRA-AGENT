import {
  AmazonMiningContinueInputSchema,
  AmazonMiningInputSchema,
  AmazonProductMiningInterventionRequestSchema,
  cancelAmazonProductMining,
  continueInterruptedAmazonProductMiningTasks,
  pauseAmazonProductMining,
  resumeAmazonProductMining,
  startAmazonProductMiningMission,
  takeoverAmazonProductMining,
} from "../plugins/amazon-product-mining/index.js";

export const runPauseAmazonProductMiningRoute = (rawInput: Parameters<typeof pauseAmazonProductMining>[1], dataDir: string) =>
  pauseAmazonProductMining(dataDir, AmazonProductMiningInterventionRequestSchema.parse(rawInput));
export const runCancelAmazonProductMiningRoute = (rawInput: Parameters<typeof cancelAmazonProductMining>[1], dataDir: string) =>
  cancelAmazonProductMining(dataDir, AmazonProductMiningInterventionRequestSchema.parse(rawInput));
export const runTakeoverAmazonProductMiningRoute = (rawInput: Parameters<typeof takeoverAmazonProductMining>[1], dataDir: string) =>
  takeoverAmazonProductMining(dataDir, AmazonProductMiningInterventionRequestSchema.parse(rawInput));
export const runResumeAmazonProductMiningRoute = (rawInput: Parameters<typeof resumeAmazonProductMining>[1], dataDir: string) =>
  resumeAmazonProductMining(dataDir, AmazonProductMiningInterventionRequestSchema.parse(rawInput));

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
