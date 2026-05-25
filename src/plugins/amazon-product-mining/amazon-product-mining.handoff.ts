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
  manualRequiredReasons: input.manualRequiredReasons,
  generatedAt: new Date().toISOString(),
});
