import type {
  BrowserSessionSnapshot,
  OpenNavigationDecision,
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
}): {
  status: "success" | "failed" | "review_required";
  failureCode: "post_open_state_failed" | null;
  reason: string | null;
  decision: PostOpenStateDecision;
  dataQualityFlags: string[];
} {
  if (input.navigationDecision.status === "timeout" || input.navigationDecision.status === "browser_failed") {
    return {
      status: "failed",
      failureCode: "post_open_state_failed",
      reason: input.navigationDecision.reason ?? "open navigation failed before a trusted page state could be established",
      decision: PostOpenStateDecisionSchema.parse({
        status: "failed",
        classification: "unknown",
        reason: input.navigationDecision.reason ?? "open navigation failed before a trusted page state could be established",
        openedUrl: input.afterSession.currentUrl,
        pageTitleAfter: input.afterSession.currentTitle,
        pageStateHandoffRequired: false,
      }),
      dataQualityFlags: ["navigation_failed"],
    };
  }

  if (input.afterSession.loginState === "login_required") {
    return {
      status: "review_required",
      failureCode: null,
      reason: input.afterSession.loginRequiredReason ?? "platform login is required after governed open",
      decision: PostOpenStateDecisionSchema.parse({
        status: "review_required",
        classification: "login_wall",
        reason: input.afterSession.loginRequiredReason ?? "platform login is required after governed open",
        openedUrl: input.afterSession.currentUrl,
        pageTitleAfter: input.afterSession.currentTitle,
        pageStateHandoffRequired: false,
      }),
      dataQualityFlags: ["login_required"],
    };
  }

  if (input.afterSession.loginState === "review_required" || input.navigationDecision.status === "review_required") {
    return {
      status: "review_required",
      failureCode: null,
      reason: input.afterSession.reviewRequiredReason ?? input.navigationDecision.reason ?? "security or review wall detected after governed open",
      decision: PostOpenStateDecisionSchema.parse({
        status: "review_required",
        classification: "security_wall",
        reason: input.afterSession.reviewRequiredReason ?? input.navigationDecision.reason ?? "security or review wall detected after governed open",
        openedUrl: input.afterSession.currentUrl,
        pageTitleAfter: input.afterSession.currentTitle,
        pageStateHandoffRequired: false,
      }),
      dataQualityFlags: ["security_wall"],
    };
  }

  if (!input.afterSession.currentUrl || input.afterSession.currentUrl === "about:blank") {
    return {
      status: "failed",
      failureCode: "post_open_state_failed",
      reason: "opened url is blank after governed open",
      decision: PostOpenStateDecisionSchema.parse({
        status: "failed",
        classification: "blank_page",
        reason: "opened url is blank after governed open",
        openedUrl: input.afterSession.currentUrl,
        pageTitleAfter: input.afterSession.currentTitle,
        pageStateHandoffRequired: false,
      }),
      dataQualityFlags: ["blank_page"],
    };
  }

  let openedUrl: URL;
  try {
    openedUrl = normalizeOpenUrl(input.afterSession.currentUrl);
  } catch {
    return {
      status: "failed",
      failureCode: "post_open_state_failed",
      reason: "opened url is not a valid absolute url",
      decision: PostOpenStateDecisionSchema.parse({
        status: "failed",
        classification: "unknown",
        reason: "opened url is not a valid absolute url",
        openedUrl: input.afterSession.currentUrl,
        pageTitleAfter: input.afterSession.currentTitle,
        pageStateHandoffRequired: false,
      }),
      dataQualityFlags: ["invalid_opened_url"],
    };
  }

  if (!matchesAllowedHostname(openedUrl.hostname, input.profile.allowedHostnames)) {
    return {
      status: "failed",
      failureCode: "post_open_state_failed",
      reason: `opened url host ${openedUrl.hostname} does not match the governed allowlist`,
      decision: PostOpenStateDecisionSchema.parse({
        status: "failed",
        classification: "wrong_domain",
        reason: `opened url host ${openedUrl.hostname} does not match the governed allowlist`,
        openedUrl: input.afterSession.currentUrl,
        pageTitleAfter: input.afterSession.currentTitle,
        pageStateHandoffRequired: false,
      }),
      dataQualityFlags: ["wrong_domain_redirect"],
    };
  }

  if (input.profile.postOpenStatePolicy.requirePageTitle && !input.afterSession.currentTitle) {
    return {
      status: "review_required",
      failureCode: null,
      reason: "page title is empty after governed open",
      decision: PostOpenStateDecisionSchema.parse({
        status: "review_required",
        classification: "blank_page",
        reason: "page title is empty after governed open",
        openedUrl: input.afterSession.currentUrl,
        pageTitleAfter: input.afterSession.currentTitle,
        pageStateHandoffRequired: false,
      }),
      dataQualityFlags: ["empty_title"],
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
    }),
    dataQualityFlags: input.beforeSession.currentUrl === input.afterSession.currentUrl ? ["already_on_target"] : [],
  };
}