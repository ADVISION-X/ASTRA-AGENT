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
}):
  | { ok: true }
  | {
      ok: false;
      status: "failed" | "review_required";
      failureReason:
        | "forbidden_purpose"
        | "missing_source_ref"
        | "operator_manual_approval_required"
        | "desktop_screen_policy_required"
        | "sensitive_target_blocked";
      reviewRequiredReason: string | null;
      statusMessage: string;
      policyDecision: "block" | "review_required";
      dataQualityFlags: string[];
    } {
  if (!purposeAllowed(input.request.purpose)) {
    return {
      ok: false,
      status: "failed",
      failureReason: "forbidden_purpose",
      reviewRequiredReason: null,
      statusMessage: "Mouse Scroll purpose is outside the governed scroll intent set.",
      policyDecision: "block",
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
      dataQualityFlags: ["source_ref_missing"],
    };
  }

  if (input.expectedCoordinateSpace === "desktopScreen" && !input.request.safetyPolicy.allowDesktopScreenScroll) {
    if (input.request.safetyPolicy.desktopScreenOperatorApprovalRef) {
      return {
        ok: false,
        status: "review_required",
        failureReason: "desktop_screen_policy_required",
        reviewRequiredReason: "Desktop-screen scroll requires operator review under the current policy.",
        statusMessage: "Mouse Scroll desktopScreen path requires stricter operator approval.",
        policyDecision: "review_required",
        dataQualityFlags: ["desktop_screen_scroll_requires_review"],
      };
    }

    return {
      ok: false,
      status: "failed",
      failureReason: "desktop_screen_policy_required",
      reviewRequiredReason: null,
      statusMessage: "Mouse Scroll desktopScreen path is blocked without explicit desktop policy enablement.",
      policyDecision: "block",
      dataQualityFlags: ["desktop_screen_scroll_blocked"],
    };
  }

  return { ok: true };
}