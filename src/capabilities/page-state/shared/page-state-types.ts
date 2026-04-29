import type {
  PageStateAbilityInput,
  PageStateChildDetection,
  PageStateDataQualityFlag,
  PageStateDecision,
  PageStateFailureReason,
  PageStateStatus,
  PageStateType,
} from "../schema.js";
import type { PageStatePlatformProfile } from "./page-state-profile.js";

export type PageStateResolvedPlatformProfile = {
  profile: PageStatePlatformProfile;
  profileId: string;
  matchKind: "host" | "local_workbench";
  matchedHost: string;
};

export type PageStateGateFailure = {
  status: Exclude<PageStateStatus, "success">;
  decision: Exclude<PageStateDecision, "proceed">;
  failureReason: PageStateFailureReason;
  stateSummary: string;
  reviewRequiredReason: string | null;
  pageStateType: PageStateType;
  confidence: number;
  dataQualityFlags: PageStateDataQualityFlag[];
};

export type PageStateClassificationOutcome = PageStateChildDetection & {
  status: PageStateStatus;
  decision: PageStateDecision;
  failureReason: PageStateFailureReason | null;
  resolvedProfileId: string | null;
};

export type PageStateClockReading = {
  isoTimestamp: string;
  epochMs: number;
};

export type PageStateExecutionTrace = {
  inputDecision: "allow" | "fail";
  sourceDecision: "allow" | "review_required" | "fail";
  freshnessDecision: "fresh" | "review_required" | "fail";
  platformDecision: "match" | "review_required" | "block";
  classificationDecision: "proceed" | "review_required" | "block" | "fail";
  proceedDecision: PageStateDecision;
};

export type PageStateExecutionTiming = {
  startedAt: PageStateClockReading;
  endedAt: PageStateClockReading;
};

export type PageStateDispatchFailureInput = {
  request: PageStateAbilityInput;
  failureReason: PageStateFailureReason;
  stateSummary: string;
  reviewRequiredReason?: string | null;
  pageStateType?: PageStateType;
  status?: Exclude<PageStateStatus, "success">;
  decision?: Exclude<PageStateDecision, "proceed">;
  dataQualityFlags?: PageStateDataQualityFlag[];
};