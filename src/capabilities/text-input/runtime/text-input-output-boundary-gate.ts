import type { TextInputFailureReason, TextInputSuccessOutput } from "../contract.js";

export function validateTextInputOutputBoundary(input: {
  requestedStatus: "success" | "failed" | "review_required";
  candidateOutput: TextInputSuccessOutput | null;
  failureReason: TextInputFailureReason | null;
  reviewRequiredReason: string | null;
  statusMessage: string;
  dataQualityFlags: string[];
}) {
  if (input.requestedStatus === "success" && input.candidateOutput === null) {
    return {
      status: "failed" as const,
      failureReason: "output_boundary_failed" as const,
      reviewRequiredReason: null,
      statusMessage: "Text Input output boundary rejected success because success output was missing.",
      outputBoundaryDecision: "invalid_success_payload" as const,
      dataQualityFlags: [...input.dataQualityFlags, "output_boundary_missing_success_output"],
      output: null,
    };
  }

  if (input.requestedStatus !== "success" && input.candidateOutput !== null) {
    return {
      status: "failed" as const,
      failureReason: "output_boundary_failed" as const,
      reviewRequiredReason: null,
      statusMessage: "Text Input output boundary rejected failure because output payload leaked across the boundary.",
      outputBoundaryDecision: "invalid_failure_payload" as const,
      dataQualityFlags: [...input.dataQualityFlags, "output_boundary_leaked_failure_output"],
      output: null,
    };
  }

  if (input.requestedStatus === "success" && input.dataQualityFlags.includes("clipboard_restore_failed")) {
    return {
      status: "review_required" as const,
      failureReason: null,
      reviewRequiredReason: "Text Input completed the paste action but clipboard restore failed, so operator review is required.",
      statusMessage: "Text Input completed the paste action but clipboard restore failed, so operator review is required.",
      outputBoundaryDecision: "review_required_clipboard_restore_failed" as const,
      dataQualityFlags: [...input.dataQualityFlags],
      output: null,
    };
  }

  return {
    status: input.requestedStatus,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    statusMessage: input.statusMessage,
    outputBoundaryDecision: "valid" as const,
    dataQualityFlags: [...input.dataQualityFlags],
    output: input.candidateOutput,
  };
}