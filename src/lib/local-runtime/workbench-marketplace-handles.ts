import {
  exportFacebookProductVideoMiningSelectionRecords,
  getFacebookProductVideoMiningRunStatus,
  getLatestFacebookProductVideoMiningRun,
  listFacebookProductVideoMiningSavedRecords,
} from "../../plugins/facebook-product-video-mining/index.js";
import {
  exportAmazonProductMiningResult,
  getAmazonProductMiningKeywordReview,
  getAmazonProductMiningTaskStatus,
  getLatestAmazonProductMiningTask,
  listAmazonProductMiningKeywordReviews,
} from "../../plugins/amazon-product-mining/index.js";
import { getAmazonProductSyncTaskStatus, getLatestAmazonProductSyncTask } from "../../plugins/amazon-product-sync/index.js";
import { getAmazonProductFeeSyncTaskStatus, getLatestAmazonProductFeeSyncTask } from "../../plugins/amazon-product-fee-sync/index.js";
import { runFacebookProductVideoMiningRoute } from "../../mediator/facebook-product-video-mining-route.js";
import {
  runAmazonProductMiningRoute,
  runContinueAmazonProductMiningRoute,
} from "../../mediator/amazon-product-mining-route.js";
import { runAmazonProductSyncRoute } from "../../mediator/amazon-product-sync-route.js";
import { runAmazonProductFeeSyncRoute } from "../../mediator/amazon-product-fee-sync-route.js";
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

export const buildFacebookMiningHandle = (assembly: WorkbenchAssembly, dataDir: string) => ({
  async startFacebookProductVideoMiningMission(input: Parameters<typeof runFacebookProductVideoMiningRoute>[0]) {
    return runFacebookProductVideoMiningRoute(input, {
      browser: assembly.browserController,
      videoDownload: assembly.videoDownload,
      aiInputGateway: assembly.aiInputGateway,
      runtimeLogger: assembly.runtimeLogger,
      dataDir,
    });
  },
  async getFacebookProductVideoMiningRunStatus(runId: string) {
    return getFacebookProductVideoMiningRunStatus({ dataDir, runId });
  },
  async getLatestFacebookProductVideoMiningRun() {
    return getLatestFacebookProductVideoMiningRun({ dataDir });
  },
  async listFacebookProductVideoMiningSavedRecords(runId: string) {
    return listFacebookProductVideoMiningSavedRecords({ dataDir, runId });
  },
  async exportFacebookProductVideoMiningSelectionRecords(runId: string) {
    return exportFacebookProductVideoMiningSelectionRecords({ dataDir, runId });
  },
});

const buildAmazonMiningRuntime = (assembly: WorkbenchAssembly, dataDir: string) => ({
  dataDir,
  browser: assembly.browserController,
  aiInputGateway: assembly.aiInputGateway,
  runtimeLogger: assembly.runtimeLogger,
});

export const buildAmazonMiningHandle = (assembly: WorkbenchAssembly, dataDir: string) => ({
  startAmazonProductMiningMission(rawInput: unknown) {
    return runAmazonProductMiningRoute(rawInput, buildAmazonMiningRuntime(assembly, dataDir));
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
  continueInterruptedAmazonProductMiningTasks() {
    return runContinueAmazonProductMiningRoute({}, buildAmazonMiningRuntime(assembly, dataDir));
  },
});

export const continueInterruptedAmazonMiningForWorkbench = (assembly: WorkbenchAssembly): void => {
  runContinueAmazonProductMiningRoute({}, buildAmazonMiningRuntime(assembly, assembly.dataDir));
};

export const buildAmazonProductSyncHandle = (assembly: WorkbenchAssembly, dataDir: string) => ({
  async startAmazonProductSyncTask(rawInput: unknown) {
    return runAmazonProductSyncRoute(rawInput, {
      dataDir,
      browser: assembly.browserController,
      runtimeLogger: assembly.runtimeLogger,
    });
  },
  async getAmazonProductSyncTaskStatus(taskId: string) {
    return getAmazonProductSyncTaskStatus({ dataDir, taskId, runtimeLogger: assembly.runtimeLogger });
  },
  async getLatestAmazonProductSyncTask() {
    return getLatestAmazonProductSyncTask({ dataDir, runtimeLogger: assembly.runtimeLogger });
  },
});

export const buildAmazonProductFeeSyncHandle = (assembly: WorkbenchAssembly, dataDir: string) => ({
  async startAmazonProductFeeSyncTask(rawInput: unknown) {
    return runAmazonProductFeeSyncRoute(rawInput, {
      dataDir,
      browser: assembly.browserController,
      runtimeLogger: assembly.runtimeLogger,
    });
  },
  async getAmazonProductFeeSyncTaskStatus(taskId: string) {
    return getAmazonProductFeeSyncTaskStatus({ dataDir, taskId, runtimeLogger: assembly.runtimeLogger });
  },
  async getLatestAmazonProductFeeSyncTask() {
    return getLatestAmazonProductFeeSyncTask({ dataDir, runtimeLogger: assembly.runtimeLogger });
  },
});
