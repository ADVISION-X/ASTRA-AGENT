import type {
  BrowserSessionSnapshot,
  OpenDataQualityFlag,
  OpenNavigationDecision,
  OpenTargetProfile,
  PostOpenStateDecision,
} from "../contract.js";
import { PostOpenStateDecisionSchema } from "../schema.js";
import { matchesAllowedHostname, normalizeOpenUrl } from "../shared/open-url.js";

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

const buildFailedPostOpenStateResult = (input: {
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

const buildReviewRequiredPostOpenStateResult = (input: {
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

const buildSuccessfulPostOpenStateResult = (input: {
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

const classifyReviewRequiredWall = (reason: string): "captcha_wall" | "permission_wall" | "security_wall" => {
  const lowercaseReason = reason.toLowerCase();
  if (lowercaseReason.includes("captcha") || lowercaseReason.includes("challenge")) {
    return "captcha_wall";
  }

  if (lowercaseReason.includes("permission")) {
    return "permission_wall";
  }

  return "security_wall";
};

const resolveNavigationWallResult = (input: {
  navigationDecision: OpenNavigationDecision;
  afterSession: BrowserSessionSnapshot;
}): PostOpenStateEvaluationResult | null => {
  if (input.navigationDecision.status === "timed_out" || input.navigationDecision.status === "failed") {
    const reason = input.navigationDecision.reason ?? "open navigation failed before a trusted page state could be established";
    return buildFailedPostOpenStateResult({
      classification: "unknown",
      reason,
      openedUrl: input.afterSession.currentUrl,
      pageTitleAfter: input.afterSession.currentTitle,
      flagCode: "navigation_failed",
    });
  }

  if (input.afterSession.loginState === "login_required") {
    const reason = input.afterSession.loginRequiredReason ?? "platform login is required after governed open";
    return buildReviewRequiredPostOpenStateResult({
      classification: "login_wall",
      reason,
      openedUrl: input.afterSession.currentUrl,
      pageTitleAfter: input.afterSession.currentTitle,
      flagCode: "login_required",
    });
  }

  if (input.afterSession.loginState === "review_required" || input.navigationDecision.status === "review_required") {
    const reviewReason = input.afterSession.reviewRequiredReason ?? input.navigationDecision.reason ?? "security or review wall detected after governed open";
    const classification = classifyReviewRequiredWall(reviewReason);
    return buildReviewRequiredPostOpenStateResult({
      classification,
      reason: reviewReason,
      openedUrl: input.afterSession.currentUrl,
      pageTitleAfter: input.afterSession.currentTitle,
      flagCode: classification,
    });
  }

  return null;
};

const resolveOpenedUrlResult = (input: {
  currentUrl: string | null;
  pageTitleAfter: string | null;
}): PostOpenStateEvaluationResult | { openedUrl: URL } => {
  if (!input.currentUrl || input.currentUrl === "about:blank") {
    return buildFailedPostOpenStateResult({
      classification: "blank_page",
      reason: "opened url is blank after governed open",
      openedUrl: input.currentUrl,
      pageTitleAfter: input.pageTitleAfter,
      flagCode: "blank_page",
    });
  }

  try {
    return { openedUrl: normalizeOpenUrl(input.currentUrl) };
  } catch {
    return buildFailedPostOpenStateResult({
      classification: "unknown",
      reason: "opened url is not a valid absolute url",
      openedUrl: input.currentUrl,
      pageTitleAfter: input.pageTitleAfter,
      flagCode: "invalid_opened_url",
    });
  }
};

const resolveAllowedHostnameResult = (input: {
  profile: OpenTargetProfile;
  openedUrl: URL;
  afterSession: BrowserSessionSnapshot;
}): PostOpenStateEvaluationResult | null => {
  if (matchesAllowedHostname(input.openedUrl.hostname, input.profile.allowedHostnames)) {
    return null;
  }

  return buildFailedPostOpenStateResult({
    classification: "wrong_domain",
    reason: `opened url host ${input.openedUrl.hostname} does not match the governed allowlist`,
    openedUrl: input.afterSession.currentUrl,
    pageTitleAfter: input.afterSession.currentTitle,
    flagCode: "wrong_domain_redirect",
  });
};

const resolveEmptyTitleResult = (input: {
  profile: OpenTargetProfile;
  afterSession: BrowserSessionSnapshot;
}): PostOpenStateEvaluationResult | null => {
  if (!input.profile.postOpenStatePolicy.requirePageTitle || input.afterSession.currentTitle) {
    return null;
  }

  return buildReviewRequiredPostOpenStateResult({
    classification: "blank_page",
    reason: "page title is empty after governed open",
    openedUrl: input.afterSession.currentUrl,
    pageTitleAfter: input.afterSession.currentTitle,
    flagCode: "empty_title",
  });
};

export function evaluatePostOpenStateSnapshot(input: {
  profile: OpenTargetProfile;
  beforeSession: BrowserSessionSnapshot;
  afterSession: BrowserSessionSnapshot;
  navigationDecision: OpenNavigationDecision;
  pageStateHandoffRef: string | null;
}): PostOpenStateEvaluationResult {
  const wallResult = resolveNavigationWallResult({
    navigationDecision: input.navigationDecision,
    afterSession: input.afterSession,
  });
  if (wallResult) {
    return wallResult;
  }

  const openedUrlResult = resolveOpenedUrlResult({
    currentUrl: input.afterSession.currentUrl,
    pageTitleAfter: input.afterSession.currentTitle,
  });
  if (!("openedUrl" in openedUrlResult)) {
    return openedUrlResult;
  }

  const allowedHostnameResult = resolveAllowedHostnameResult({
    profile: input.profile,
    openedUrl: openedUrlResult.openedUrl,
    afterSession: input.afterSession,
  });
  if (allowedHostnameResult) {
    return allowedHostnameResult;
  }

  const emptyTitleResult = resolveEmptyTitleResult({
    profile: input.profile,
    afterSession: input.afterSession,
  });
  if (emptyTitleResult) {
    return emptyTitleResult;
  }

  return buildSuccessfulPostOpenStateResult({
    classification: input.profile.targetKind === "local-workbench" ? "local_workbench" : "platform_feed",
    openedUrl: input.afterSession.currentUrl,
    pageTitleAfter: input.afterSession.currentTitle,
    pageStateHandoffRef: input.pageStateHandoffRef,
    currentSessionUrl: input.beforeSession.currentUrl,
  });
}