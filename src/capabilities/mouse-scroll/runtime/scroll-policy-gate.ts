import type { MouseScrollCoordinateSpace, ParsedMouseScrollAbilityInput } from "../contract.js";
import {
  MOUSE_SCROLL_ALLOWED_PURPOSE_PREFIXES,
  MOUSE_SCROLL_SENSITIVE_TARGET_TOKENS,
} from "../shared/mouse-scroll-policy.js";

function purposeAllowed(purpose: string): boolean {
  return MOUSE_SCROLL_ALLOWED_PURPOSE_PREFIXES.some((prefix) => purpose.startsWith(prefix));
}

function containsSensitiveToken(value: string | null): boolean {
  if (!value) {
    return false;
  }
  const normalized = value.toLowerCase();
  return MOUSE_SCROLL_SENSITIVE_TARGET_TOKENS.some((token) => normalized.includes(token));
}

type ScrollPolicyInput = {
  request: ParsedMouseScrollAbilityInput;
  expectedCoordinateSpace: MouseScrollCoordinateSpace;
  nowIsoTimestamp: string;
};

type ScrollPolicyFailureReason =
  | "missing_requested_by"
  | "missing_purpose"
  | "forbidden_purpose"
  | "missing_source_ref"
  | "operator_manual_approval_required"
  | "desktop_screen_disabled_by_policy"
  | "desktop_screen_phase_blocked"
  | "desktop_screen_profile_blocked"
  | "desktop_screen_operator_approval_required"
  | "desktop_screen_operator_approval_stale"
  | "sensitive_target_blocked";

type ScrollPolicyFailure = {
  ok: false;
  status: "failed" | "review_required";
  failureReason: ScrollPolicyFailureReason;
  reviewRequiredReason: string | null;
  statusMessage: string;
  policyDecision: "block" | "review_required";
  policyDecisionReason: string;
  dataQualityFlags: string[];
};

const createScrollPolicyFailure = (input: {
  status: "failed" | "review_required";
  failureReason: ScrollPolicyFailureReason;
  reviewRequiredReason: string | null;
  statusMessage: string;
  policyDecision: "block" | "review_required";
  policyDecisionReason: string;
  dataQualityFlags: string[];
}): ScrollPolicyFailure => ({
  ok: false,
  status: input.status,
  failureReason: input.failureReason,
  reviewRequiredReason: input.reviewRequiredReason,
  statusMessage: input.statusMessage,
  policyDecision: input.policyDecision,
  policyDecisionReason: input.policyDecisionReason,
  dataQualityFlags: input.dataQualityFlags,
});

const validateScrollRequesterFields = (request: ParsedMouseScrollAbilityInput): ScrollPolicyFailure | null => {
  if (!request.requestedBy.trim()) {
    return createScrollPolicyFailure({
      status: "failed",
      failureReason: "missing_requested_by",
      reviewRequiredReason: null,
      statusMessage: "Mouse Scroll requires requestedBy.",
      policyDecision: "block",
      policyDecisionReason: "requested_by_missing",
      dataQualityFlags: ["requested_by_missing"],
    });
  }

  return !request.purpose.trim()
    ? createScrollPolicyFailure({
        status: "failed",
        failureReason: "missing_purpose",
        reviewRequiredReason: null,
        statusMessage: "Mouse Scroll requires purpose.",
        policyDecision: "block",
        policyDecisionReason: "purpose_missing",
        dataQualityFlags: ["purpose_missing"],
      })
    : null;
};

const validateScrollPurposePolicy = (request: ParsedMouseScrollAbilityInput): ScrollPolicyFailure | null => {
  if (!purposeAllowed(request.purpose)) {
    return createScrollPolicyFailure({
      status: "failed",
      failureReason: "forbidden_purpose",
      reviewRequiredReason: null,
      statusMessage: "Mouse Scroll purpose is outside the governed scroll intent set.",
      policyDecision: "block",
      policyDecisionReason: "purpose_allowlist_blocked",
      dataQualityFlags: ["forbidden_purpose"],
    });
  }

  return containsSensitiveToken(request.sourceTargetRef) || containsSensitiveToken(request.purpose)
    ? createScrollPolicyFailure({
        status: "failed",
        failureReason: "sensitive_target_blocked",
        reviewRequiredReason: null,
        statusMessage: "Mouse Scroll cannot target sensitive login, captcha, permission, payment, or destructive surfaces.",
        policyDecision: "block",
        policyDecisionReason: "sensitive_target_blocked",
        dataQualityFlags: ["sensitive_target_blocked"],
      })
    : null;
};

const validateScrollSourceRefs = (request: ParsedMouseScrollAbilityInput): ScrollPolicyFailure | null => {
  const hasSourceRef = Boolean(request.sourceEvidenceRef) || Boolean(request.sourceTargetRef);
  if (hasSourceRef) {
    return null;
  }
  if (request.safetyPolicy.allowOperatorManual && request.safetyPolicy.operatorManualApprovalRef) {
    return createScrollPolicyFailure({
      status: "review_required",
      failureReason: "operator_manual_approval_required",
      reviewRequiredReason: "Mouse Scroll requires operator review because source refs are absent.",
      statusMessage: "Mouse Scroll requires source refs or explicit operator review.",
      policyDecision: "review_required",
      policyDecisionReason: "source_ref_missing_review",
      dataQualityFlags: ["source_ref_missing"],
    });
  }

  return createScrollPolicyFailure({
    status: "failed",
    failureReason: "missing_source_ref",
    reviewRequiredReason: null,
    statusMessage: "Mouse Scroll requires sourceEvidenceRef or sourceTargetRef.",
    policyDecision: "block",
    policyDecisionReason: "source_ref_missing",
    dataQualityFlags: ["source_ref_missing"],
  });
};

const validateDesktopScreenRolloutPolicy = (request: ParsedMouseScrollAbilityInput): ScrollPolicyFailure | null => {
  if (!request.safetyPolicy.currentPhaseAllowsDesktopScroll) {
    return createScrollPolicyFailure({
      status: "review_required",
      failureReason: "desktop_screen_phase_blocked",
      reviewRequiredReason: "Desktop-screen scroll is phase-gated until explicit rollout approval.",
      statusMessage: "Mouse Scroll desktopScreen path is blocked by the current phase gate.",
      policyDecision: "review_required",
      policyDecisionReason: "desktop_phase_gate_blocked",
      dataQualityFlags: ["desktop_phase_gate_blocked"],
    });
  }

  return !request.safetyPolicy.platformProfileAllowsDesktopScroll
    ? createScrollPolicyFailure({
        status: "review_required",
        failureReason: "desktop_screen_profile_blocked",
        reviewRequiredReason: "Desktop-screen scroll is blocked by the active platform profile.",
        statusMessage: "Mouse Scroll desktopScreen path is blocked by the platform profile.",
        policyDecision: "review_required",
        policyDecisionReason: "desktop_platform_profile_blocked",
        dataQualityFlags: ["desktop_platform_profile_blocked"],
      })
    : null;
};

const validateDesktopScreenApprovalPolicy = (input: ScrollPolicyInput): ScrollPolicyFailure | null => {
  if (!input.request.safetyPolicy.allowDesktopScreenScroll) {
    return createScrollPolicyFailure({
      status: "review_required",
      failureReason: "desktop_screen_disabled_by_policy",
      reviewRequiredReason: "Desktop-screen scroll requires explicit allowDesktopScreenScroll policy.",
      statusMessage: "Mouse Scroll desktopScreen path requires explicit policy approval.",
      policyDecision: "review_required",
      policyDecisionReason: "desktop_policy_disabled",
      dataQualityFlags: ["desktop_policy_disabled"],
    });
  }
  if (input.request.safetyPolicy.desktopScreenOperatorApprovalRef === null) {
    return createScrollPolicyFailure({
      status: "review_required",
      failureReason: "desktop_screen_operator_approval_required",
      reviewRequiredReason: "Desktop-screen scroll requires desktopScreenOperatorApprovalRef.",
      statusMessage: "Mouse Scroll desktopScreen path requires operator approval ref.",
      policyDecision: "review_required",
      policyDecisionReason: "desktop_operator_approval_missing",
      dataQualityFlags: ["desktop_operator_approval_missing"],
    });
  }

  return input.request.safetyPolicy.desktopOperatorApprovalValidUntil !== null
    && input.request.safetyPolicy.desktopOperatorApprovalValidUntil <= input.nowIsoTimestamp
    ? createScrollPolicyFailure({
        status: "review_required",
        failureReason: "desktop_screen_operator_approval_stale",
        reviewRequiredReason: "Desktop-screen scroll operator approval is stale and must be refreshed.",
        statusMessage: "Mouse Scroll desktopScreen operator approval has expired.",
        policyDecision: "review_required",
        policyDecisionReason: "desktop_operator_approval_stale",
        dataQualityFlags: ["desktop_operator_approval_stale"],
      })
    : null;
};

const validateDesktopScreenScrollPolicy = (input: ScrollPolicyInput): ScrollPolicyFailure | null => {
  if (input.expectedCoordinateSpace !== "desktopScreen") {
    return null;
  }

  return validateDesktopScreenRolloutPolicy(input.request)
    ?? validateDesktopScreenApprovalPolicy(input);
};

export function validateScrollPolicy(input: ScrollPolicyInput):
  | { ok: true; policyDecision: "allow"; policyDecisionReason: string }
  | ScrollPolicyFailure {
  const failure = validateScrollRequesterFields(input.request)
    ?? validateScrollPurposePolicy(input.request)
    ?? validateScrollSourceRefs(input.request)
    ?? validateDesktopScreenScrollPolicy(input);
  if (failure) {
    return failure;
  }

  return { ok: true, policyDecision: "allow", policyDecisionReason: "policy_gate_passed" };
}