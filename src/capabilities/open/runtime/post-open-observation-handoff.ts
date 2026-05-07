import type {
  BrowserSessionSnapshot,
  OpenDataQualityFlag,
  OpenNavigationDecision,
  OpenTargetProfile,
  PostOpenStateDecision,
} from "../contract.js";
import { PostOpenStateDecisionSchema } from "../schema.js";

type WebOpenTargetProfile = Extract<OpenTargetProfile, { targetKind: "platform-feed" | "local-workbench" }>;

export type PostOpenStateEvaluationResult = {
  status: "success" | "failed" | "review_required";
  failureCode: "post_open_state_failed" | null;
  reason: string | null;
  decision: PostOpenStateDecision;
  dataQualityFlags: OpenDataQualityFlag[];
};

function buildPostOpenDecision(input: {
  status: "success" | "failed" | "review_required";
  classification: "browser_navigation_observation" | "session_reuse_observation" | "local_program_observation" | "navigation_failure_observation";
  reason: string | null;
  openedUrl: string | null;
  pageTitleAfter: string | null;
  pageStateHandoffRequired: boolean;
  pageStateHandoffRef: string | null;
}): PostOpenStateDecision {
  return PostOpenStateDecisionSchema.parse({
    status: input.status,
    classification: input.classification,
    reason: input.reason,
    openedUrl: input.openedUrl,
    pageTitleAfter: input.pageTitleAfter,
    pageStateHandoffRequired: input.pageStateHandoffRequired,
    pageStateHandoffRef: input.pageStateHandoffRef,
    authoritative: false,
  });
}

function buildFailureResult(input: {
  reason: string;
  openedUrl: string | null;
  pageTitleAfter: string | null;
}): PostOpenStateEvaluationResult {
  return {
    status: "failed",
    failureCode: "post_open_state_failed",
    reason: input.reason,
    decision: buildPostOpenDecision({
      status: "failed",
      classification: "navigation_failure_observation",
      reason: input.reason,
      openedUrl: input.openedUrl,
      pageTitleAfter: input.pageTitleAfter,
      pageStateHandoffRequired: false,
      pageStateHandoffRef: null,
    }),
    dataQualityFlags: [{ code: "navigation_failed", severity: "error", reason: input.reason }],
  };
}

function buildObservationSummary(input: {
  profile: WebOpenTargetProfile;
  beforeSession: BrowserSessionSnapshot;
  afterSession: BrowserSessionSnapshot;
  navigationDecision: OpenNavigationDecision;
}): string {
  const transition = input.navigationDecision.status === "already_on_target"
    ? "session reused without a new navigation attempt"
    : "navigation attempt completed and produced a browser-session snapshot";
  const titleState = input.afterSession.currentTitle ? "page title captured" : "page title missing";
  return `${input.profile.targetKind} open produced a post-open observation handoff: ${transition}; observedUrl=${input.afterSession.currentUrl}; loginState=${input.afterSession.loginState}; ${titleState}. AI owns readiness, safety, freshness, and page-kind judgment.`;
}

function buildSuccessResult(input: {
  profile: WebOpenTargetProfile;
  beforeSession: BrowserSessionSnapshot;
  afterSession: BrowserSessionSnapshot;
  navigationDecision: OpenNavigationDecision;
  pageStateHandoffRef: string | null;
}): PostOpenStateEvaluationResult {
  const reason = buildObservationSummary(input);
  return {
    status: "success",
    failureCode: null,
    reason,
    decision: buildPostOpenDecision({
      status: "success",
      classification: input.navigationDecision.status === "already_on_target"
        ? "session_reuse_observation"
        : "browser_navigation_observation",
      reason,
      openedUrl: input.afterSession.currentUrl,
      pageTitleAfter: input.afterSession.currentTitle,
      pageStateHandoffRequired: true,
      pageStateHandoffRef: input.pageStateHandoffRef,
    }),
    dataQualityFlags: input.navigationDecision.status === "already_on_target"
      ? [{ code: "session_reused", severity: "info", reason: "open reused an existing governed browser session" }]
      : [],
  };
}

export function evaluatePostOpenObservationHandoff(input: {
  profile: WebOpenTargetProfile;
  beforeSession: BrowserSessionSnapshot;
  afterSession: BrowserSessionSnapshot;
  navigationDecision: OpenNavigationDecision;
  pageStateHandoffRef: string | null;
}): PostOpenStateEvaluationResult {
  if (input.navigationDecision.status === "timed_out" || input.navigationDecision.status === "failed") {
    return buildFailureResult({
      reason: input.navigationDecision.reason ?? "open navigation failed before a governed post-open observation handoff could be recorded",
      openedUrl: input.afterSession.currentUrl,
      pageTitleAfter: input.afterSession.currentTitle,
    });
  }

  return buildSuccessResult(input);
}