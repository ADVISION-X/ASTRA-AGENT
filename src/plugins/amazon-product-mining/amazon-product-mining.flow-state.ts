import type { AmazonMiningInput, AmazonTaskRecord } from "./amazon-product-mining.schema.js";

export type FinalTaskResolution = {
  finalTaskStatus: "failed" | "manual_required" | "package_completed";
  finalHandoffStatus: "ready" | "failed";
  finalFailureReason: string | null;
};

export const resolveFinalTaskState = (input: {
  allKeywordsFailed: boolean;
  handoffStatus: string;
  manualRequiredReasons: readonly string[];
  failureReasons?: readonly string[];
}): FinalTaskResolution => {
  const failureReasons = input.failureReasons ?? [];
  const finalTaskStatus = input.allKeywordsFailed || failureReasons.length > 0
    ? "failed"
    : input.manualRequiredReasons.length > 0 ? "manual_required" : "package_completed";
  const finalHandoffStatus = finalTaskStatus === "package_completed" && input.handoffStatus !== "manual_required"
    ? "ready"
    : "failed";
  const finalFailureReason = finalTaskStatus === "failed" || finalTaskStatus === "manual_required"
    ? [...failureReasons, ...input.manualRequiredReasons].join("; ")
    : null;

  return {
    finalTaskStatus,
    finalHandoffStatus,
    finalFailureReason,
  };
};

export const buildFailedTaskRecord = (input: {
  taskId: string;
  miningInput: AmazonMiningInput;
  message: string;
}): AmazonTaskRecord => ({
  taskId: input.taskId,
  amazonMarketplace: input.miningInput.amazonMarketplace as "amazon.com",
  targetMarket: input.miningInput.targetMarket,
  productDirection: input.miningInput.productDirection,
  requestedKeywordCount: input.miningInput.requestedKeywordCount,
  languagePreference: input.miningInput.languagePreference ?? "en",
  providerKind: input.miningInput.providerKind,
  status: "failed",
  failureReason: input.message,
  packageJsonPath: null,
  pdfReportPath: null,
  evidenceIndexPath: null,
  exceptionSummaryPath: null,
  handoffStatus: "not_started",
  createdAt: new Date().toISOString(),
  updatedAt: null,
});
