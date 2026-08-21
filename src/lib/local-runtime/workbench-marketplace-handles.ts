import {
  exportAmazonProductMiningResult,
  getAmazonProductMiningKeywordReview,
  getAmazonProductMiningTaskStatus,
  getLatestAmazonProductMiningTask,
  listAmazonProductMiningKeywordReviews,
  readAmazonProductMiningIntervention,
} from "../../plugins/amazon-product-mining/index.js";
import {
  runCancelAmazonProductMiningRoute,
  runAmazonProductMiningRoute,
  runContinueAmazonProductMiningRoute,
  runPauseAmazonProductMiningRoute,
  runResumeAmazonProductMiningRoute,
  runTakeoverAmazonProductMiningRoute,
} from "../../mediator/amazon-product-mining-route.js";
import { loadOnlineAiProviderPublicStatus, saveOnlineAiProviderConfig } from "../online-ai/index.js";
import { loadAppRunLimitSettings, saveAppRunLimitSettings } from "./settings.js";
import type { WorkbenchAssembly } from "./workbench-assembly.js";

export const buildSettingsHandle = (dataDir: string) => ({
  async getAppRunLimitSettings() {
    return loadAppRunLimitSettings(dataDir);
  },
  async saveAppRunLimitSettings(input: Parameters<typeof saveAppRunLimitSettings>[1]) {
    return saveAppRunLimitSettings(dataDir, input);
  },
  async getOnlineAiProviderSettings() {
    return loadOnlineAiProviderPublicStatus(dataDir);
  },
  async saveOnlineAiProviderSettings(input: Parameters<typeof saveOnlineAiProviderConfig>[1]) {
    return saveOnlineAiProviderConfig(dataDir, input);
  },
});

const buildAmazonMiningRuntime = async (assembly: WorkbenchAssembly, dataDir: string) => ({
  dataDir,
  browser: await assembly.browserAuthority.acquireTargetLease("amazon-product-mining"),
  aiInputGateway: assembly.aiInputGateway,
  runtimeLogger: assembly.runtimeLogger,
});

export const buildAmazonMiningHandle = (assembly: WorkbenchAssembly, dataDir: string) => ({
  async startAmazonProductMiningMission(rawInput: unknown) {
    return runAmazonProductMiningRoute(rawInput, await buildAmazonMiningRuntime(assembly, dataDir));
  },
  getAmazonProductMiningTaskStatus(taskId: string) {
    return getAmazonProductMiningTaskStatus({ dataDir, taskId });
  },
  getLatestAmazonProductMiningTask() {
    return getLatestAmazonProductMiningTask({ dataDir });
  },
  exportAmazonProductMiningResult(taskId: string) {
    return exportAmazonProductMiningResult({ dataDir, taskId });
  },
  listAmazonProductMiningKeywordReviews(taskId?: string) {
    return listAmazonProductMiningKeywordReviews(taskId ? { dataDir, taskId } : { dataDir });
  },
  getAmazonProductMiningKeywordReview(reviewId: string) {
    return getAmazonProductMiningKeywordReview({ dataDir, reviewId });
  },
  async continueInterruptedAmazonProductMiningTasks() {
    return runContinueAmazonProductMiningRoute({}, await buildAmazonMiningRuntime(assembly, dataDir));
  },
  ...buildAmazonMiningInterventionHandle(assembly, dataDir),
});

const buildAmazonMiningInterventionHandle = (assembly: WorkbenchAssembly, dataDir: string) => ({
  async readAmazonProductMiningIntervention(taskId: string) { return readAmazonProductMiningIntervention(dataDir, taskId); },
  async pauseAmazonProductMining(input: Parameters<typeof runPauseAmazonProductMiningRoute>[0]) { return runPauseAmazonProductMiningRoute(input, dataDir); },
  async cancelAmazonProductMining(input: Parameters<typeof runCancelAmazonProductMiningRoute>[0]) { return runCancelAmazonProductMiningRoute(input, dataDir); },
  async takeoverAmazonProductMining(input: Parameters<typeof runTakeoverAmazonProductMiningRoute>[0]) { return runTakeoverAmazonProductMiningRoute(input, dataDir); },
  async resumeAmazonProductMining(input: Parameters<typeof runResumeAmazonProductMiningRoute>[0]) {
    const snapshot = runResumeAmazonProductMiningRoute(input, dataDir);
    assembly.aiInputGateway.resumeProviderTargetAfterOperator?.(`amazon-product-mining:${input.taskId}`);
    void runContinueAmazonProductMiningRoute({}, await buildAmazonMiningRuntime(assembly, dataDir));
    return snapshot;
  },
});
