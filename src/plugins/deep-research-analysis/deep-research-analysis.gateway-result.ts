import type { DeepResearchGatewayResult } from "./deep-research-analysis.analysis-runner.js";
import { buildDeepResearchTextHash } from "./deep-research-analysis.prompts.js";

export type AiGatewayExecutionResult = {
  status: "success" | "failed" | "review_required";
  normalizedText: string | null;
  rawOutputHash: string | null;
  rawOutputRef: string | null;
  providerProof: unknown;
  failureReason?: string | null;
  reviewRequiredReason?: string | null;
};

export const mapGatewayResult = (
  result: AiGatewayExecutionResult,
): DeepResearchGatewayResult => {
  const normalizedText = result.normalizedText ?? "";
  return {
    status: result.status === "success" ? "completed" : result.status,
    rawOutputRef: result.rawOutputRef,
    rawOutputHash: result.rawOutputHash ?? buildDeepResearchTextHash(normalizedText),
    normalizedText,
    providerProofJson: JSON.stringify(result.providerProof),
    errorReason: result.failureReason ?? result.reviewRequiredReason ?? null,
  };
};
