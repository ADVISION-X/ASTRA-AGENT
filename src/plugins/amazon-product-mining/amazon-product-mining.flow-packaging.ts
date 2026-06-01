import { writeAmazonHandoffRecord } from "./amazon-product-mining.handoff.js";
import { buildAmazonProductMiningPackage } from "./amazon-product-mining.package.js";
import { buildAmazonProductMiningReport } from "./amazon-product-mining.pdf.js";
import { taskRecordToResult, type AmazonTaskResult } from "./amazon-product-mining.result.js";
import { resolveFinalTaskState } from "./amazon-product-mining.flow-state.js";
import { buildPackageInput, didAllKeywordsFail } from "./amazon-product-mining.flow-support.js";
import type { AmazonMiningStorage } from "./amazon-product-mining.storage.js";
import type { AmazonHandoffStatus, AmazonMiningInput, AmazonTaskRecord, AmazonTaskStatus } from "./amazon-product-mining.schema.js";

type AmazonPackagingStorage = {
  getKeywordsForTask(taskId: string): Array<{ status: string }>;
  getTask(taskId: string): AmazonTaskRecord | null;
  updateTaskStatus(input: {
    taskId: string;
    status: AmazonTaskStatus;
    failureReason?: string | null;
    packageJsonPath?: string | null;
    pdfReportPath?: string | null;
    evidenceIndexPath?: string | null;
    exceptionSummaryPath?: string | null;
    handoffStatus?: AmazonHandoffStatus;
  }): AmazonTaskRecord | null;
} & AmazonMiningStorage;

type AmazonPackagingLogger = {
  logHandoffReady(input: { taskId: string }): void;
  logFailure(input: { taskId: string; scope: string; reason: string }): void;
  logManualRequired(input: { taskId: string; scope: string; reason: string }): void;
  logMissionComplete(input: { taskId: string; status?: "success" | "failed" | "review_required" }): void;
  logPackageBuilt(input: { taskId: string; packageJsonPath: string; evidenceIndexPath: string; exceptionSummaryPath: string }): void;
  logPdfBuilt(input: { taskId: string; pdfReportPath: string }): void;
};

type AmazonPackagingRuntime = {
  ctx: { reviewMaxPages?: number };
  dataDir: string;
  failureReasons: string[];
  logger: AmazonPackagingLogger;
  manualRequiredReasons: string[];
  miningInput: AmazonMiningInput;
  storage: AmazonPackagingStorage;
  taskId: string;
};

type PackageBuildResult = Awaited<ReturnType<typeof buildAmazonProductMiningPackage>>;
type PackagingArtifacts = { packageResult: PackageBuildResult; pdfPath: string | null };

const buildPackagingArtifacts = async (
  runtime: AmazonPackagingRuntime,
  detailRankLimit: number,
): Promise<PackagingArtifacts> => {
  const { storage, logger, taskId, miningInput, dataDir, manualRequiredReasons } = runtime;
  storage.updateTaskStatus({ taskId, status: "packaging" });
  const packageResult = await buildAmazonProductMiningPackage(buildPackageInput(runtime, detailRankLimit));
  logger.logPackageBuilt({ taskId, packageJsonPath: packageResult.packageJsonPath, evidenceIndexPath: packageResult.evidenceIndexPath, exceptionSummaryPath: packageResult.exceptionSummaryPath });
  const reportResult = buildAmazonProductMiningReport({
    taskId,
    dataDir,
    packageJsonPath: packageResult.packageJsonPath,
    productCount: packageResult.productCount,
    reviewCount: packageResult.reviewCount,
    keywordCount: packageResult.keywordCount,
    productDirection: miningInput.productDirection,
    amazonMarketplace: miningInput.amazonMarketplace,
    targetMarket: miningInput.targetMarket,
  });
  if (!reportResult.ok) {
    manualRequiredReasons.push(`report_build_failed:${reportResult.reason}`);
    return { packageResult, pdfPath: null };
  }
  logger.logPdfBuilt({ taskId, pdfReportPath: reportResult.pdfReportPath });
  return { packageResult, pdfPath: reportResult.pdfReportPath };
};

const persistFinalPackagingState = async (
  runtime: AmazonPackagingRuntime,
  artifacts: PackagingArtifacts,
  handoffStatus: string,
  detailRankLimit: number,
): Promise<void> => {
  const allKeywordsFailed = didAllKeywordsFail(runtime);
  if (allKeywordsFailed) runtime.manualRequiredReasons.push("all_keywords_failed");
  const resolution = resolveFinalTaskState({
    allKeywordsFailed,
    handoffStatus,
    manualRequiredReasons: runtime.manualRequiredReasons,
    failureReasons: runtime.failureReasons,
  });
  runtime.storage.updateTaskStatus({
    taskId: runtime.taskId,
    status: resolution.finalTaskStatus,
    failureReason: resolution.finalFailureReason,
    packageJsonPath: artifacts.packageResult.packageJsonPath,
    pdfReportPath: artifacts.pdfPath,
    evidenceIndexPath: artifacts.packageResult.evidenceIndexPath,
    exceptionSummaryPath: artifacts.packageResult.exceptionSummaryPath,
    handoffStatus: resolution.finalHandoffStatus,
  });
  await buildAmazonProductMiningPackage(buildPackageInput(runtime, detailRankLimit));
  if (resolution.finalHandoffStatus === "ready") {
    runtime.logger.logHandoffReady({ taskId: runtime.taskId });
  } else if (resolution.finalTaskStatus === "failed") {
    runtime.logger.logFailure({ taskId: runtime.taskId, scope: "handoff", reason: resolution.finalFailureReason ?? "amazon_product_mining_failed" });
  } else {
    runtime.logger.logManualRequired({ taskId: runtime.taskId, scope: "handoff", reason: resolution.finalFailureReason ?? runtime.manualRequiredReasons.join("; ") });
  }
  runtime.logger.logMissionComplete({
    taskId: runtime.taskId,
    status: resolution.finalTaskStatus === "package_completed"
      ? "success"
      : resolution.finalTaskStatus === "manual_required" ? "review_required" : "failed",
  });
};

export const finalizeAmazonMiningPackaging = async (
  runtime: AmazonPackagingRuntime,
  detailRankLimit: number,
): Promise<AmazonTaskResult> => {
  let artifacts = await buildPackagingArtifacts(runtime, detailRankLimit);
  const handoff = writeAmazonHandoffRecord({
    dataDir: runtime.dataDir,
    taskId: runtime.taskId,
    packageJsonPath: artifacts.packageResult.packageJsonPath,
    reportPath: artifacts.pdfPath ?? "",
    evidenceIndexPath: artifacts.packageResult.evidenceIndexPath,
    exceptionSummaryPath: artifacts.packageResult.exceptionSummaryPath,
    productCount: artifacts.packageResult.productCount,
    reviewCount: artifacts.packageResult.reviewCount,
    keywordCount: artifacts.packageResult.keywordCount,
    amazonMarketplace: runtime.miningInput.amazonMarketplace,
    targetMarket: runtime.miningInput.targetMarket,
    productDirection: runtime.miningInput.productDirection,
    requestedKeywordCount: runtime.miningInput.requestedKeywordCount,
    languagePreference: runtime.miningInput.languagePreference ?? "en",
    packageIntegrityStatus: artifacts.packageResult.integrityStatus,
    manualRequiredReasons: runtime.manualRequiredReasons,
  });
  artifacts = { ...artifacts, packageResult: await buildAmazonProductMiningPackage(buildPackageInput(runtime, detailRankLimit)) };
  if (artifacts.packageResult.integrityStatus === "failed" && !runtime.manualRequiredReasons.includes("package_integrity_failed")) {
    runtime.manualRequiredReasons.push("package_integrity_failed");
  }
  const shouldBeReady = runtime.manualRequiredReasons.length === 0 && artifacts.packageResult.integrityStatus === "pass";
  let finalHandoffStatus = handoff.handoffStatus;
  if ((handoff.handoffStatus === "ready") !== shouldBeReady) {
    finalHandoffStatus = writeAmazonHandoffRecord({
      dataDir: runtime.dataDir,
      taskId: runtime.taskId,
      packageJsonPath: artifacts.packageResult.packageJsonPath,
      reportPath: artifacts.pdfPath ?? "",
      evidenceIndexPath: artifacts.packageResult.evidenceIndexPath,
      exceptionSummaryPath: artifacts.packageResult.exceptionSummaryPath,
      productCount: artifacts.packageResult.productCount,
      reviewCount: artifacts.packageResult.reviewCount,
      keywordCount: artifacts.packageResult.keywordCount,
      amazonMarketplace: runtime.miningInput.amazonMarketplace,
      targetMarket: runtime.miningInput.targetMarket,
      productDirection: runtime.miningInput.productDirection,
      requestedKeywordCount: runtime.miningInput.requestedKeywordCount,
      languagePreference: runtime.miningInput.languagePreference ?? "en",
      packageIntegrityStatus: artifacts.packageResult.integrityStatus,
      manualRequiredReasons: runtime.manualRequiredReasons,
    }).handoffStatus;
    artifacts = { ...artifacts, packageResult: await buildAmazonProductMiningPackage(buildPackageInput(runtime, detailRankLimit)) };
  }
  await persistFinalPackagingState(runtime, artifacts, finalHandoffStatus, detailRankLimit);
  return taskRecordToResult(runtime.storage.getTask(runtime.taskId)!);
};
