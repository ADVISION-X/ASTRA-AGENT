import type {
  DomActionResult,
  DomVerificationResult,
} from "../schema.js";

export type DomReviewRequiredStatus =
  | "login_required"
  | "captcha_or_2fa_required"
  | "review_required"
  | "ambiguous";

export type DomReviewRequiredActionContract = DomActionResult & {
  status: "review_required" | "ambiguous";
  reviewRequiredReason: string;
};

export type DomReviewRequiredVerificationContract = DomVerificationResult & {
  status: DomReviewRequiredStatus;
};
