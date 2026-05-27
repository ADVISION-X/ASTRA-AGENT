import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { AMAZON_PRODUCT_MINING_ARTIFACTS_DIR } from "./amazon-product-mining.storage-schema.js";

export type AmazonHandoffRecord = {
  taskId: string;
  packageJsonPath: string;
  reportPath: string;
  evidenceIndexPath: string;
  exceptionSummaryPath: string;
  productCount: number;
  reviewCount: number;
  keywordCount: number;
  handoffStatus: "ready" | "manual_required";
  manualRequiredReasons: string[];
  generatedAt: string;
};

export type PersistedAmazonHandoffRecord = AmazonHandoffRecord & {
  handoffRecordPath: string;
};

const AMAZON_HANDOFF_RECORD_FILE = "amazon-product-mining-handoff-record.json";

const resolveArtifactsDir = (input: { dataDir: string; taskId: string }): string =>
  resolve(input.dataDir, AMAZON_PRODUCT_MINING_ARTIFACTS_DIR, input.taskId);

export const resolveAmazonHandoffRecordPath = (input: { dataDir: string; taskId: string }): string =>
  join(resolveArtifactsDir(input), AMAZON_HANDOFF_RECORD_FILE);

export const buildHandoffRecord = (input: {
  taskId: string;
  packageJsonPath: string;
  reportPath: string;
  evidenceIndexPath: string;
  exceptionSummaryPath: string;
  productCount: number;
  reviewCount: number;
  keywordCount: number;
  manualRequiredReasons: string[];
}): AmazonHandoffRecord => ({
  taskId: input.taskId,
  packageJsonPath: input.packageJsonPath,
  reportPath: input.reportPath,
  evidenceIndexPath: input.evidenceIndexPath,
  exceptionSummaryPath: input.exceptionSummaryPath,
  productCount: input.productCount,
  reviewCount: input.reviewCount,
  keywordCount: input.keywordCount,
  handoffStatus: input.manualRequiredReasons.length > 0 ? "manual_required" : "ready",
  manualRequiredReasons: [...input.manualRequiredReasons],
  generatedAt: new Date().toISOString(),
});

export const writeAmazonHandoffRecord = (input: {
  dataDir: string;
  taskId: string;
  packageJsonPath: string;
  reportPath: string;
  evidenceIndexPath: string;
  exceptionSummaryPath: string;
  productCount: number;
  reviewCount: number;
  keywordCount: number;
  manualRequiredReasons: string[];
}): PersistedAmazonHandoffRecord => {
  const record = buildHandoffRecord(input);
  const artifactsDir = resolveArtifactsDir({ dataDir: input.dataDir, taskId: input.taskId });
  const handoffRecordPath = resolveAmazonHandoffRecordPath({ dataDir: input.dataDir, taskId: input.taskId });

  mkdirSync(artifactsDir, { recursive: true });
  writeFileSync(handoffRecordPath, JSON.stringify(record, null, 2), "utf8");

  return {
    ...record,
    handoffRecordPath,
  };
};
