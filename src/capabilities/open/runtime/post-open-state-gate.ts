import type { BrowserSessionSnapshot, OpenNavigationDecision, OpenTargetProfile } from "../contract.js";
import type { PostOpenStateEvaluationResult } from "./post-open-state-gate-helpers.js";
import { evaluatePostOpenStateSnapshot } from "./post-open-state-gate-helpers.js";

export function evaluatePostOpenState(input: {
  profile: OpenTargetProfile;
  beforeSession: BrowserSessionSnapshot;
  afterSession: BrowserSessionSnapshot;
  navigationDecision: OpenNavigationDecision;
  pageStateHandoffRef: string | null;
}): PostOpenStateEvaluationResult {
  return evaluatePostOpenStateSnapshot(input);
}import type { BrowserSessionSnapshot, OpenNavigationDecision, OpenTargetProfile } from "../contract.js";
import type { PostOpenStateEvaluationResult } from "./post-open-state-gate-helpers.js";
import { evaluatePostOpenStateSnapshot } from "./post-open-state-gate-helpers.js";

export function evaluatePostOpenState(input: {
  profile: OpenTargetProfile;
  beforeSession: BrowserSessionSnapshot;
  afterSession: BrowserSessionSnapshot;
  navigationDecision: OpenNavigationDecision;
  pageStateHandoffRef: string | null;
}): PostOpenStateEvaluationResult {
  return evaluatePostOpenStateSnapshot(input);
}import type {
  BrowserSessionSnapshot,
  OpenNavigationDecision,
  OpenDataQualityFlag,
  OpenTargetProfile,
  PostOpenStateDecision,
} from "../contract.js";
import { PostOpenStateDecisionSchema } from "../schema.js";
import { matchesAllowedHostname, normalizeOpenUrl } from "../shared/open-url.js";

type PostOpenStateEvaluationResult = {
  status: "success" | "failed" | "review_required";
  failureCode: "post_open_state_failed" | null;
  reason: string | null;
  decision: PostOpenStateDecision;
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
    pageStateHandoffRef: null,
    authoritative: false,
    documentReadyState: null,
  dataQualityFlags: [{ code: input.flagCode, severity: "warn", reason: input.reason }],
    import type { PostOpenStateEvaluationResult } from "./post-open-state-result-builders.js";
    import {
      buildFailedPostOpenStateResult,
      buildReviewRequiredPostOpenStateResult,
      buildSuccessfulPostOpenStateResult,
    } from "./post-open-state-result-builders.js";
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

const resolveAllowedHostnamePostOpenStateResult = (input: {
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

const resolveEmptyTitlePostOpenStateResult = (input: {
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

const resolvePostOpenStateContentResult = (input: {
  profile: OpenTargetProfile;
  afterSession: BrowserSessionSnapshot;
  pageStateHandoffRef: string | null;
  currentSessionUrl: string | null;
}): PostOpenStateEvaluationResult | null => {
  const openedUrlResult = resolveNormalizedOpenedUrlPostOpenStateResult({
    currentUrl: input.afterSession.currentUrl,
    pageTitleAfter: input.afterSession.currentTitle,
  });
  if (!("openedUrl" in openedUrlResult)) {
    return openedUrlResult;
  }

  const allowedHostnameResult = resolveAllowedHostnamePostOpenStateResult({
    profile: input.profile,
    openedUrl: openedUrlResult.openedUrl,
    afterSession: input.afterSession,
  });
  if (allowedHostnameResult) {
    return allowedHostnameResult;
  }

  const emptyTitleResult = resolveEmptyTitlePostOpenStateResult({
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
    currentSessionUrl: input.currentSessionUrl,
  });
};

const evaluatePostOpenStateSnapshot = (input: {
  profile: OpenTargetProfile;
  beforeSession: BrowserSessionSnapshot;
  afterSession: BrowserSessionSnapshot;
  navigationDecision: OpenNavigationDecision;
  pageStateHandoffRef: string | null;
}): PostOpenStateEvaluationResult => {
  const wallResult = resolvePostOpenStateWallResult({
    navigationDecision: input.navigationDecision,
    afterSession: input.afterSession,
  });
  if (wallResult) {
    return wallResult;
  }
  return resolvePostOpenStateContentResult({
    profile: input.profile,
    afterSession: input.afterSession,
    pageStateHandoffRef: input.pageStateHandoffRef,
    currentSessionUrl: input.beforeSession.currentUrl,
  }) as PostOpenStateEvaluationResult;
};

export function evaluatePostOpenState(input: {
  profile: OpenTargetProfile;
  beforeSession: BrowserSessionSnapshot;
  afterSession: BrowserSessionSnapshot;
  navigationDecision: OpenNavigationDecision;
  pageStateHandoffRef: string | null;
}): PostOpenStateEvaluationResult {
  return evaluatePostOpenStateSnapshot(input);
}