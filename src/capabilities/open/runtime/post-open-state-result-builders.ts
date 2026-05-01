import type {
  BrowserSessionSnapshot,
  OpenDataQualityFlag,
  OpenNavigationDecision,
  PostOpenStateDecision,
  OpenTargetProfile,
} from "../contract.js";
import { PostOpenStateDecisionSchema } from "../schema.js";

export type PostOpenStateEvaluationResult = {
  status: "success" | "failed" | "review_required";
  failureCode: "post_open_state_failed" | null;
  reason: string | null;
  decision: PostOpenStateDecision;
  dataQualityFlags: OpenDataQualityFlag[];
};

const buildPostOpenStateDecision = (input: {
  status: "success" | "failed" | "review_required";
  classification: "unknown" | "login_wall" | "captcha_wall" | "permission_wall" | "security_wall" | "blank_page" | "wrong_domain" | "local_workbench" | "platform_feed";
  reason: string | null;
  openedUrl: string | null;
  pageTitleAfter: string | null;
  pageStateHandoffRequired: boolean;
  pageStateHandoffRef: string | null;
  authoritative: boolean;
  documentReadyState: string | null;
}) => PostOpenStateDecisionSchema.parse({
  status: input.status,
  classification: input.classification,
  reason: input.reason,
  openedUrl: input.openedUrl,
  pageTitleAfter: input.pageTitleAfter,
  pageStateHandoffRequired: input.pageStateHandoffRequired,
  pageStateHandoffRef: input.pageStateHandoffRef,
  authoritative: input.authoritative,
  documentReadyState: input.documentReadyState,
});

const buildPostOpenStateEvaluationResult = (input: {
  status: "success" | "failed" | "review_required";
  failureCode: "post_open_state_failed" | null;
  reason: string | null;
  decision: PostOpenStateDecision;
  dataQualityFlags: OpenDataQualityFlag[];
}): PostOpenStateEvaluationResult => input;

export const buildFailedPostOpenStateResult = (input: {
  classification: "unknown" | "blank_page" | "wrong_domain";
  reason: string;
  openedUrl: string | null;
  pageTitleAfter: string | null;
  flagCode: string;
}): PostOpenStateEvaluationResult => buildPostOpenStateEvaluationResult({
  status: "failed",
  failureCode: "post_open_state_failed",
  reason: input.reason,
  decision: buildPostOpenStateDecision({
    status: "failed",
    classification: input.classification,
    reason: input.reason,
    openedUrl: input.openedUrl,
    pageTitleAfter: input.pageTitleAfter,
    pageStateHandoffRequired: false,
    pageStateHandoffRef: null,
    authoritative: false,
    documentReadyState: null,
  }),
  dataQualityFlags: [{ code: input.flagCode, severity: "error", reason: input.reason }],
});

export const buildReviewRequiredPostOpenStateResult = (input: {
  classification: "login_wall" | "captcha_wall" | "permission_wall" | "security_wall" | "blank_page";
  reason: string;
  openedUrl: string | null;
  pageTitleAfter: string | null;
  flagCode: string;
}): PostOpenStateEvaluationResult => buildPostOpenStateEvaluationResult({
  status: "review_required",
  failureCode: null,
  reason: input.reason,
  decision: buildPostOpenStateDecision({
    status: "review_required",
    classification: input.classification,
    reason: input.reason,
    openedUrl: input.openedUrl,
    pageTitleAfter: input.pageTitleAfter,
    pageStateHandoffRequired: false,
    pageStateHandoffRef: null,
    authoritative: false,
    documentReadyState: null,
  }),
  dataQualityFlags: [{ code: input.flagCode, severity: "warn", reason: input.reason }],
});

export const buildSuccessfulPostOpenStateResult = (input: {
  classification: "local_workbench" | "platform_feed";
  openedUrl: string | null;
  pageTitleAfter: string | null;
  pageStateHandoffRef: string | null;
  currentSessionUrl: string | null;
}): PostOpenStateEvaluationResult => buildPostOpenStateEvaluationResult({
  status: "success",
  failureCode: null,
  reason: null,
  decision: buildPostOpenStateDecision({
    status: "success",
    classification: input.classification,
    reason: null,
    openedUrl: input.openedUrl,
    pageTitleAfter: input.pageTitleAfter,
    pageStateHandoffRequired: true,
    pageStateHandoffRef: input.pageStateHandoffRef,
    authoritative: false,
    documentReadyState: null,
  }),
  dataQualityFlags: input.currentSessionUrl === input.openedUrl
    ? [{ code: "already_on_target", severity: "info", reason: "browser session already pointed at target url" }]
    : [],
});
