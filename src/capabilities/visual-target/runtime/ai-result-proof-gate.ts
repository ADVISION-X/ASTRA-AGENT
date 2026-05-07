import type { ParsedVisualTargetAbilityInput, VisualTargetDataQualityFlag, VisualTargetFailureReason } from "../contract.js";
import { evaluateAiResultProof } from "./ai-result-proof-gate-support.js";

export function validateAiResultProof(input: {
  request: ParsedVisualTargetAbilityInput;
}):
  | { ok: true; decision: "allow" | "not_required"; aiInputHash: string | null; aiOutputPayloadHash: string | null; dataQualityFlags: VisualTargetDataQualityFlag[] }
  | {
      ok: false;
      status: "failed" | "review_required";
      decision: "block" | "review_required";
      failureReason: VisualTargetFailureReason;
      statusMessage: string;
      reviewRequiredReason: string | null;
      aiInputHash: string | null;
      aiOutputPayloadHash: string | null;
      dataQualityFlags: VisualTargetDataQualityFlag[];
    } {
  return evaluateAiResultProof(input);
}
