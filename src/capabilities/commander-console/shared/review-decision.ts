import type { CommanderCommandType } from "./command-policy.js";

export type CandidateReviewStatusInput = "approved" | "rejected" | "archived" | "pending";
export type CandidateDispositionInput = "approve" | "reject" | "hold" | "pending";

export function mapReviewStatusToCommandType(status: CandidateReviewStatusInput): Extract<CommanderCommandType, "approve-candidate" | "reject-candidate" | "mark-review-required"> {
  switch (status) {
    case "approved":
      return "approve-candidate";
    case "rejected":
      return "reject-candidate";
    case "archived":
      return "mark-review-required";
    default:
      return "mark-review-required";
  }
}

export function mapDispositionToCommandType(disposition: CandidateDispositionInput): Extract<CommanderCommandType, "approve-candidate" | "reject-candidate" | "mark-review-required"> {
  switch (disposition) {
    case "approve":
      return "approve-candidate";
    case "reject":
      return "reject-candidate";
    default:
      return "mark-review-required";
  }
}
