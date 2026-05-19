export type DomReviewRequired = {
  status: "review_required";
  reason: string;
  evidenceRef?: string;
};
