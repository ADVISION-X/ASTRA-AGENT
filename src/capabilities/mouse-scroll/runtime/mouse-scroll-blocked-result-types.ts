import type { MouseScrollFailureReason } from "../contract.js";
import type { MouseScrollExecutionContext } from "./mouse-scroll-runtime-context.js";
import type { MouseScrollExecutionSeed } from "./mouse-scroll-execution-contract.js";

export type BlockedResultInput = {
  seed: MouseScrollExecutionSeed;
  context: MouseScrollExecutionContext;
  status: "failed" | "review_required";
  failureReason: MouseScrollFailureReason;
  reviewRequiredReason: string | null;
  statusMessage: string;
  policyDecision: "allow" | "block" | "review_required" | "duplicate_review_required";
  policyDecisionReason: string | null;
  geometryDecision: "allow" | "block";
  geometryDecisionReason: string | null;
  safetyDecision: "allow" | "block";
  safetyDecisionReason: string | null;
  dataQualityFlags: string[];
};
