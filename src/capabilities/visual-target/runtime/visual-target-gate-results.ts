import type { VisualTargetDataQualityFlag, VisualTargetFailureReason } from "../contract.js";

export type VisualTargetGateSuccess<TDecision extends string, TExtra extends object = {}> = {
  ok: true;
  decision: TDecision;
  dataQualityFlags: VisualTargetDataQualityFlag[];
} & TExtra;

export type VisualTargetGateBlocked<TDecision extends string = "block", TExtra extends object = {}> = {
  ok: false;
  status: "failed";
  decision: TDecision;
  failureReason: VisualTargetFailureReason;
  statusMessage: string;
  reviewRequiredReason: null;
  dataQualityFlags: VisualTargetDataQualityFlag[];
} & TExtra;

export type VisualTargetGateReviewRequired<TDecision extends string = "review_required", TExtra extends object = {}> = {
  ok: false;
  status: "review_required";
  decision: TDecision;
  failureReason: VisualTargetFailureReason;
  statusMessage: string;
  reviewRequiredReason: string;
  dataQualityFlags: VisualTargetDataQualityFlag[];
} & TExtra;

export function createVisualTargetGateSuccess<TDecision extends string, TExtra extends object>(
  decision: TDecision,
  dataQualityFlags: VisualTargetDataQualityFlag[],
  extra: TExtra,
): VisualTargetGateSuccess<TDecision, TExtra> {
  return { ok: true, decision, dataQualityFlags, ...extra };
}

export function createVisualTargetGateBlocked<TDecision extends string, TExtra extends object>(input: {
  decision: TDecision;
  failureReason: VisualTargetFailureReason;
  statusMessage: string;
  dataQualityFlags: VisualTargetDataQualityFlag[];
  extra: TExtra;
}): VisualTargetGateBlocked<TDecision, TExtra> {
  return {
    ok: false,
    status: "failed",
    decision: input.decision,
    failureReason: input.failureReason,
    statusMessage: input.statusMessage,
    reviewRequiredReason: null,
    dataQualityFlags: input.dataQualityFlags,
    ...input.extra,
  };
}

export function createVisualTargetGateReviewRequired<TDecision extends string, TExtra extends object>(input: {
  decision: TDecision;
  failureReason: VisualTargetFailureReason;
  statusMessage: string;
  reviewRequiredReason: string;
  dataQualityFlags: VisualTargetDataQualityFlag[];
  extra: TExtra;
}): VisualTargetGateReviewRequired<TDecision, TExtra> {
  return {
    ok: false,
    status: "review_required",
    decision: input.decision,
    failureReason: input.failureReason,
    statusMessage: input.statusMessage,
    reviewRequiredReason: input.reviewRequiredReason,
    dataQualityFlags: input.dataQualityFlags,
    ...input.extra,
  };
}

export const collectVisualTargetFlags = (flags: Iterable<VisualTargetDataQualityFlag>): VisualTargetDataQualityFlag[] => [...flags];