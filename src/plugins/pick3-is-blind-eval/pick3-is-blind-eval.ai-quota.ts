import type { AiFeedResult } from "../../capabilities/ai-input-gateway/index.js";

export const PICK3_QUOTA_EXHAUSTED_WAIT_MS = 40 * 60 * 1000;

export const isPick3QuotaExhaustedResult = (result: AiFeedResult): boolean => {
  const reason = `${result.reviewRequiredReason ?? ""} ${result.failureReason ?? ""}`;
  return reason.includes("pick3_quota_exhausted_wait_required");
};
