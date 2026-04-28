import type { MissionStatus } from "./map-types.js";

export type BranchResult = {
  branchTaken: "success" | "failure" | "review";
  conditionEvaluated: string;
  nextStepId: string | null;
  status: MissionStatus;
  failureReason: string | null;
};