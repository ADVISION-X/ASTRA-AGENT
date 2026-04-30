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

export function validateScrollPolicy(input: {
  request: ParsedMouseScrollAbilityInput;
  expectedCoordinateSpace: MouseScrollCoordinateSpace;
  nowIsoTimestamp: string;
}):
  | { ok: true; policyDecision: "allow"; policyDecisionReason: string }
  | {
      ok: false;
      status: "failed" | "review_required";
      failureReason:
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
      reviewRequiredReason: string | null;
      statusMessage: string;
      policyDecision: "block" | "review_required";
      policyDecisionReason: string;
      dataQualityFlags: string[];
    } {
  if (!input.request.requestedBy.trim()) {
    return {
      ok: false,
      status: "failed",
      failureReason: "missing_requested_by",
      reviewRequiredReason: null,
      statusMessage: "Mouse Scroll requires requestedBy.",
      policyDecision: "block",
      policyDecisionReason: "requested_by_missing",
      dataQualityFlags: ["requested_by_missing"],
    };
  }

  if (!input.request.purpose.trim()) {
    return {
      ok: false,
      status: "failed",
      failureReason: "missing_purpose",
      reviewRequiredReason: null,
      statusMessage: "Mouse Scroll requires purpose.",
      policyDecision: "block",
      policyDecisionReason: "purpose_missing",
      dataQualityFlags: ["purpose_missing"],
    };
  }

  if (!purposeAllowed(input.request.purpose)) {
    return {
      ok: false,
      status: "failed",
      failureReason: "forbidden_purpose",
      reviewRequiredReason: null,
      statusMessage: "Mouse Scroll purpose is outside the governed scroll intent set.",
      policyDecision: "block",
      policyDecisionReason: "purpose_allowlist_blocked",
      dataQualityFlags: ["forbidden_purpose"],
    };
  }

  if (containsSensitiveToken(input.request.sourceTargetRef) || containsSensitiveToken(input.request.purpose)) {
    return {
      ok: false,
      status: "failed",
      failureReason: "sensitive_target_blocked",
      reviewRequiredReason: null,
      statusMessage: "Mouse Scroll cannot target sensitive login, captcha, permission, payment, or destructive surfaces.",
      policyDecision: "block",
      policyDecisionReason: "sensitive_target_blocked",
      dataQualityFlags: ["sensitive_target_blocked"],
    };
  }

  const hasSourceRef = Boolean(input.request.sourceEvidenceRef) || Boolean(input.request.sourceTargetRef);
  if (!hasSourceRef) {
    if (input.request.safetyPolicy.allowOperatorManual && input.request.safetyPolicy.operatorManualApprovalRef) {
      return {
        ok: false,
        status: "review_required",
        failureReason: "operator_manual_approval_required",
        reviewRequiredReason: "Mouse Scroll requires operator review because source refs are absent.",
        statusMessage: "Mouse Scroll requires source refs or explicit operator review.",
        policyDecision: "review_required",
        policyDecisionReason: "source_ref_missing_review",
        dataQualityFlags: ["source_ref_missing"],
      };
    }

    return {
      ok: false,
      status: "failed",
      failureReason: "missing_source_ref",
      reviewRequiredReason: null,
      statusMessage: "Mouse Scroll requires sourceEvidenceRef or sourceTargetRef.",
      policyDecision: "block",
      policyDecisionReason: "source_ref_missing",
      dataQualityFlags: ["source_ref_missing"],
    };
  }

  if (input.expectedCoordinateSpace === "desktopScreen" && !input.request.safetyPolicy.currentPhaseAllowsDesktopScroll) {
    return {
      ok: false,
      status: "review_required",
      failureReason: "desktop_screen_phase_blocked",
      reviewRequiredReason: "Desktop-screen scroll is phase-gated until explicit rollout approval.",
      statusMessage: "Mouse Scroll desktopScreen path is blocked by the current phase gate.",
      policyDecision: "review_required",
      policyDecisionReason: "desktop_phase_gate_blocked",
      dataQualityFlags: ["desktop_phase_gate_blocked"],
    };
  }

  if (input.expectedCoordinateSpace === "desktopScreen" && !input.request.safetyPolicy.platformProfileAllowsDesktopScroll) {
    return {
      ok: false,
      status: "review_required",
      failureReason: "desktop_screen_profile_blocked",
      reviewRequiredReason: "Desktop-screen scroll is blocked by the active platform profile.",
      statusMessage: "Mouse Scroll desktopScreen path is blocked by the platform profile.",
      policyDecision: "review_required",
      policyDecisionReason: "desktop_platform_profile_blocked",
      dataQualityFlags: ["desktop_platform_profile_blocked"],
    };
  }

  if (input.expectedCoordinateSpace === "desktopScreen" && !input.request.safetyPolicy.allowDesktopScreenScroll) {
    return {
      ok: false,
      status: "review_required",
      failureReason: "desktop_screen_disabled_by_policy",
      reviewRequiredReason: "Desktop-screen scroll requires explicit allowDesktopScreenScroll policy.",
      statusMessage: "Mouse Scroll desktopScreen path requires explicit policy approval.",
      policyDecision: "review_required",
      policyDecisionReason: "desktop_policy_disabled",
      dataQualityFlags: ["desktop_policy_disabled"],
    };
  }

  if (input.expectedCoordinateSpace === "desktopScreen" && input.request.safetyPolicy.desktopScreenOperatorApprovalRef === null) {
    return {
      ok: false,
      status: "review_required",
      failureReason: "desktop_screen_operator_approval_required",
      reviewRequiredReason: "Desktop-screen scroll requires desktopScreenOperatorApprovalRef.",
      statusMessage: "Mouse Scroll desktopScreen path requires operator approval ref.",
      policyDecision: "review_required",
      policyDecisionReason: "desktop_operator_approval_missing",
      dataQualityFlags: ["desktop_operator_approval_missing"],
    };
  }

  if (
    input.expectedCoordinateSpace === "desktopScreen"
    && input.request.safetyPolicy.desktopOperatorApprovalValidUntil !== null
    && input.request.safetyPolicy.desktopOperatorApprovalValidUntil <= input.nowIsoTimestamp
  ) {
    return {
      ok: false,
      status: "review_required",
      failureReason: "desktop_screen_operator_approval_stale",
      reviewRequiredReason: "Desktop-screen scroll operator approval is stale and must be refreshed.",
      statusMessage: "Mouse Scroll desktopScreen operator approval has expired.",
      policyDecision: "review_required",
      policyDecisionReason: "desktop_operator_approval_stale",
      dataQualityFlags: ["desktop_operator_approval_stale"],
    };
  }

  return { ok: true, policyDecision: "allow", policyDecisionReason: "policy_gate_passed" };
}