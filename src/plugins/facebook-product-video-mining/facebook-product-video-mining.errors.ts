export type FacebookProductVideoMiningFailureCode =
  | "login_required"
  | "captcha_or_2fa_required"
  | "rate_limited"
  | "dom_unstable"
  | "video_download_failed"
  | "ai_review_required"
  | "ai_failed"
  | "not_interested_option_not_found"
  | "next_video_not_found"
  | "storage_failed"
  | "mission_timeout"
  | "max_rounds_reached"
  | "unknown_failure";

export class FacebookProductVideoMiningError extends Error {
  readonly code: FacebookProductVideoMiningFailureCode;

  readonly reviewRequired: boolean;

  constructor(input: {
    code: FacebookProductVideoMiningFailureCode;
    message: string;
    reviewRequired?: boolean;
  }) {
    super(input.message);
    this.name = "FacebookProductVideoMiningError";
    this.code = input.code;
    this.reviewRequired = input.reviewRequired === true;
  }
}

export const isFacebookReviewRequiredError = (
  error: unknown,
): error is FacebookProductVideoMiningError => error instanceof FacebookProductVideoMiningError
  && error.reviewRequired;

export const errorMessageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);