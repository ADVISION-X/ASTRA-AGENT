import type { ForensicsFailure, ForensicsIntegrityDecision, StoredForensicsRecord } from "../schema.js";

export function resolveForensicsPersistenceStatus(input: {
  failureReason: ForensicsFailure | null;
  reviewRequiredReason: string | null;
  integrityDecision: ForensicsIntegrityDecision;
  storedRecord: StoredForensicsRecord | null;
}): "success" | "failed" | "review_required" {
  if (input.failureReason) {
    return "failed";
  }
  if (input.storedRecord?.storageRef) {
    return "success";
  }
  return input.reviewRequiredReason || input.integrityDecision.status === "review_required"
    ? "review_required"
    : "success";
}