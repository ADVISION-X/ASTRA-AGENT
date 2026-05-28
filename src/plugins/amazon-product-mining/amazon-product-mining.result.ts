import type { AmazonTaskRecord, AmazonTaskStatus } from "./amazon-product-mining.schema.js";

const COMPLETED_TASK_STATUSES = new Set<AmazonTaskStatus>(["package_completed", "failed", "manual_required", "terminated"]);

export type AmazonTaskRunConfig = {
  taskId: string;
  amazonMarketplace: string;
  targetMarket: string;
  productDirection: string;
  requestedKeywordCount: number;
  languagePreference: string;
  createdAt: string;
};

export type AmazonTaskResult = {
  taskId: string;
  status: AmazonTaskStatus;
  failureReason: string | null;
  packageJsonPath: string | null;
  pdfReportPath: string | null;
  evidenceIndexPath: string | null;
  exceptionSummaryPath: string | null;
  handoffStatus: string;
  runConfig: AmazonTaskRunConfig;
  completedAt: string | null;
};

export const taskRecordToResult = (task: AmazonTaskRecord): AmazonTaskResult => ({
  taskId: task.taskId,
  status: task.status,
  failureReason: task.failureReason,
  packageJsonPath: task.packageJsonPath,
  pdfReportPath: task.pdfReportPath,
  evidenceIndexPath: task.evidenceIndexPath,
  exceptionSummaryPath: task.exceptionSummaryPath,
  handoffStatus: task.handoffStatus,
  runConfig: {
    taskId: task.taskId,
    amazonMarketplace: task.amazonMarketplace,
    targetMarket: task.targetMarket,
    productDirection: task.productDirection,
    requestedKeywordCount: task.requestedKeywordCount,
    languagePreference: task.languagePreference,
    createdAt: task.createdAt,
  },
  completedAt: COMPLETED_TASK_STATUSES.has(task.status) ? task.updatedAt : null,
});
