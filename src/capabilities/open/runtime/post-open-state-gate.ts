import type {
  BrowserSessionSnapshot,
  OpenNavigationDecision,
  OpenDataQualityFlag,
  OpenTargetProfile,
  PostOpenStateDecision,
} from "../contract.js";
import { PostOpenStateDecisionSchema } from "../schema.js";
import { matchesAllowedHostname, normalizeOpenUrl } from "../shared/open-url.js";

export function evaluatePostOpenState(input: {
  profile: OpenTargetProfile;
  beforeSession: BrowserSessionSnapshot;
  afterSession: BrowserSessionSnapshot;
  navigationDecision: OpenNavigationDecision;
  pageStateHandoffRef: string | null;
}): {
  status: "success" | "failed" | "review_required";
  failureCode: "post_open_state_failed" | null;
  reason: string | null;
  decision: PostOpenStateDecision;
  dataQualityFlags: OpenDataQualityFlag[];
} {
  if (input.navigationDecision.status === "timed_out" || input.navigationDecision.status === "failed") {
    const reason = input.navigationDecision.reason ?? "open navigation failed before a trusted page state could be established";
    return {
      status: "failed",
      failureCode: "post_open_state_failed",
      reason,
      decision: PostOpenStateDecisionSchema.parse({
        status: "failed",
        classification: "unknown",
        reason,
        openedUrl: input.afterSession.currentUrl,
        pageTitleAfter: input.afterSession.currentTitle,
        pageStateHandoffRequired: false,
        pageStateHandoffRef: null,
        authoritative: false,
        documentReadyState: null,
      }),
      dataQualityFlags: [{ code: "navigation_failed", severity: "error", reason }],
    };
  }

  if (input.afterSession.loginState === "login_required") {
    const reason = input.afterSession.loginRequiredReason ?? "platform login is required after governed open";
    return {
      status: "review_required",
      failureCode: null,
      reason,
      decision: PostOpenStateDecisionSchema.parse({
        status: "review_required",
        classification: "login_wall",
        reason,
        openedUrl: input.afterSession.currentUrl,
        pageTitleAfter: input.afterSession.currentTitle,
        pageStateHandoffRequired: false,
        pageStateHandoffRef: null,
        authoritative: false,
        documentReadyState: null,
      }),
      dataQualityFlags: [{ code: "login_required", severity: "warn", reason }],
    };
  }

  if (input.afterSession.loginState === "review_required" || input.navigationDecision.status === "review_required") {
    const reviewReason = input.afterSession.reviewRequiredReason ?? input.navigationDecision.reason ?? "security or review wall detected after governed open";
    const lowercaseReason = reviewReason.toLowerCase();
    const classification = lowercaseReason.includes("captcha") || lowercaseReason.includes("challenge")
      ? "captcha_wall"
      : lowercaseReason.includes("permission")
        ? "permission_wall"
        : "security_wall";
    return {
      status: "review_required",
      failureCode: null,
      reason: reviewReason,
      decision: PostOpenStateDecisionSchema.parse({
        status: "review_required",
        classification,
        reason: reviewReason,
        openedUrl: input.afterSession.currentUrl,
        pageTitleAfter: input.afterSession.currentTitle,
        pageStateHandoffRequired: false,
        pageStateHandoffRef: null,
        authoritative: false,
        documentReadyState: null,
      }),
      dataQualityFlags: [{ code: classification, severity: "warn", reason: reviewReason }],
    };
  }

  if (!input.afterSession.currentUrl || input.afterSession.currentUrl === "about:blank") {
    const reason = "opened url is blank after governed open";
    return {
      status: "failed",
      failureCode: "post_open_state_failed",
      reason,
      decision: PostOpenStateDecisionSchema.parse({
        status: "failed",
        classification: "blank_page",
        reason,
        openedUrl: input.afterSession.currentUrl,
        pageTitleAfter: input.afterSession.currentTitle,
        pageStateHandoffRequired: false,
        pageStateHandoffRef: null,
        authoritative: false,
        documentReadyState: null,
      }),
      dataQualityFlags: [{ code: "blank_page", severity: "error", reason }],
    };
  }

  let openedUrl: URL;
  try {
    openedUrl = normalizeOpenUrl(input.afterSession.currentUrl);
  } catch {
    const reason = "opened url is not a valid absolute url";
    return {
      status: "failed",
      failureCode: "post_open_state_failed",
      reason,
      decision: PostOpenStateDecisionSchema.parse({
        status: "failed",
        classification: "unknown",
        reason,
        openedUrl: input.afterSession.currentUrl,
        pageTitleAfter: input.afterSession.currentTitle,
        pageStateHandoffRequired: false,
        pageStateHandoffRef: null,
        authoritative: false,
        documentReadyState: null,
      }),
      dataQualityFlags: [{ code: "invalid_opened_url", severity: "error", reason }],
    };
  }

  if (!matchesAllowedHostname(openedUrl.hostname, input.profile.allowedHostnames)) {
    const reason = `opened url host ${openedUrl.hostname} does not match the governed allowlist`;
    return {
      status: "failed",
      failureCode: "post_open_state_failed",
      reason,
      decision: PostOpenStateDecisionSchema.parse({
        status: "failed",
        classification: "wrong_domain",
        reason,
        openedUrl: input.afterSession.currentUrl,
        pageTitleAfter: input.afterSession.currentTitle,
        pageStateHandoffRequired: false,
        pageStateHandoffRef: null,
        authoritative: false,
        documentReadyState: null,
      }),
      dataQualityFlags: [{ code: "wrong_domain_redirect", severity: "error", reason }],
    };
  }

  if (input.profile.postOpenStatePolicy.requirePageTitle && !input.afterSession.currentTitle) {
    const reason = "page title is empty after governed open";
    return {
      status: "review_required",
      failureCode: null,
      reason,
      decision: PostOpenStateDecisionSchema.parse({
        status: "review_required",
        classification: "blank_page",
        reason,
        openedUrl: input.afterSession.currentUrl,
        pageTitleAfter: input.afterSession.currentTitle,
        pageStateHandoffRequired: false,
        pageStateHandoffRef: null,
        authoritative: false,
        documentReadyState: null,
      }),
      dataQualityFlags: [{ code: "empty_title", severity: "warn", reason }],
    };
  }

  return {
    status: "success",
    failureCode: null,
    reason: null,
    decision: PostOpenStateDecisionSchema.parse({
      status: "success",
      classification: input.profile.targetKind === "local-workbench" ? "local_workbench" : "platform_feed",
      reason: null,
      openedUrl: input.afterSession.currentUrl,
      pageTitleAfter: input.afterSession.currentTitle,
      pageStateHandoffRequired: true,
      pageStateHandoffRef: input.pageStateHandoffRef,
      authoritative: false,
      documentReadyState: null,
    }),
    dataQualityFlags: input.beforeSession.currentUrl === input.afterSession.currentUrl
      ? [{ code: "already_on_target", severity: "info", reason: "browser session already pointed at target url" }]
      : [],
  };
}