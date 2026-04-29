export type NerveBusDispatchFailure = {
  status: "failed" | "review_required";
  failureReason: string | null;
  reviewRequiredReason: string | null;
  dataQualityFlags: string[];
};
