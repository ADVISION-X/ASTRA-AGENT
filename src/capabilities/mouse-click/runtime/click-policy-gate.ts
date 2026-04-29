import { ALLOWED_MOUSE_CLICK_PURPOSE_PREFIXES } from "../shared/mouse-click-policy.js";
import type { ParsedMouseClickAbilityInput } from "../contract.js";

function resolvePurposePrefix(purpose: string): string {
  const trimmed = purpose.trim();
  if (!trimmed) {
    return "";
  }
  const delimiterIndex = trimmed.indexOf(":");
  return delimiterIndex === -1 ? trimmed : trimmed.slice(0, delimiterIndex);
}

export function validateClickPolicy(input: { request: ParsedMouseClickAbilityInput }):
  | { ok: true; policyDecision: "allow" }
  | {
      ok: false;
      status: "failed" | "review_required";
  failureReason: "missing_requested_by" | "missing_purpose" | "missing_source_coordinate_proof_ref" | "missing_source_target_ref" | "missing_source_ref" | "right_click_not_allowed" | "double_click_not_allowed" | "invalid_click_count" | "invalid_duration_limit" | "invalid_primitive_timeout" | "desktop_click_not_allowed" | "desktop_click_operator_approval_required" | null;
      reviewRequiredReason: string | null;
      statusMessage: string;
      policyDecision: "block" | "review_required";
      dataQualityFlags: string[];
    } {
  const request = input.request;
  if (!request.requestedBy.trim()) {
    return {
      ok: false,
      status: "failed",
      failureReason: "missing_requested_by",
      reviewRequiredReason: null,
      statusMessage: "Mouse Click requires requestedBy.",
      policyDecision: "block",
      dataQualityFlags: ["requested_by_missing"],
    };
  }
  if (!request.purpose.trim()) {
    return {
      ok: false,
      status: "failed",
      failureReason: "missing_purpose",
      reviewRequiredReason: null,
      statusMessage: "Mouse Click requires purpose.",
      policyDecision: "block",
      dataQualityFlags: ["purpose_missing"],
    };
  }
  if (!ALLOWED_MOUSE_CLICK_PURPOSE_PREFIXES.includes(resolvePurposePrefix(request.purpose) as (typeof ALLOWED_MOUSE_CLICK_PURPOSE_PREFIXES)[number])) {
    return {
      ok: false,
      status: "review_required",
      failureReason: null,
      reviewRequiredReason: `purpose ${request.purpose} is not in the governed allowlist`,
      statusMessage: "Mouse Click purpose is outside the governed allowlist.",
      policyDecision: "review_required",
      dataQualityFlags: ["purpose_allowlist_review"],
    };
  }
  if (!request.sourceCoordinateProofRef.trim()) {
    return {
      ok: false,
      status: "failed",
      failureReason: "missing_source_coordinate_proof_ref",
      reviewRequiredReason: null,
      statusMessage: "Mouse Click requires sourceCoordinateProofRef.",
      policyDecision: "block",
      dataQualityFlags: ["source_coordinate_proof_missing"],
    };
  }
  if (!request.sourceTargetRef.trim()) {
    return {
      ok: false,
      status: "failed",
      failureReason: "missing_source_target_ref",
      reviewRequiredReason: null,
      statusMessage: "Mouse Click requires sourceTargetRef.",
      policyDecision: "block",
      dataQualityFlags: ["source_target_missing"],
    };
  }
  if (!request.sourceEvidenceRef && !request.geometryGuardProof.sourceScreenshotEvidenceRef) {
    const operatorApproved = request.safetyPolicy.allowOperatorManual && request.safetyPolicy.operatorManualApprovalRef !== null;
    return {
      ok: false,
      status: operatorApproved ? "review_required" : "failed",
      failureReason: operatorApproved ? null : "missing_source_ref",
      reviewRequiredReason: operatorApproved ? "sourceEvidenceRef missing; operator approval required before replay-safe click" : null,
      statusMessage: "Mouse Click requires evidence binding before execution.",
      policyDecision: operatorApproved ? "review_required" : "block",
      dataQualityFlags: ["source_evidence_missing"],
    };
  }
  if (request.button === "right" && !request.safetyPolicy.allowRightClick) {
    return {
      ok: false,
      status: "failed",
      failureReason: "right_click_not_allowed",
      reviewRequiredReason: null,
      statusMessage: "Right click is blocked unless allowRightClick=true.",
      policyDecision: "block",
      dataQualityFlags: ["right_click_blocked"],
    };
  }
  if (request.clickCount === 2 && !request.safetyPolicy.allowDoubleClick) {
    return {
      ok: false,
      status: "failed",
      failureReason: "double_click_not_allowed",
      reviewRequiredReason: null,
      statusMessage: "Double click is blocked unless allowDoubleClick=true.",
      policyDecision: "block",
      dataQualityFlags: ["double_click_blocked"],
    };
  }
  if (request.clickCount !== 1 && request.clickCount !== 2) {
    return {
      ok: false,
      status: "failed",
      failureReason: "invalid_click_count",
      reviewRequiredReason: null,
      statusMessage: "Mouse Click clickCount must be 1 or 2.",
      policyDecision: "block",
      dataQualityFlags: ["invalid_click_count"],
    };
  }
  if (!Number.isFinite(request.safetyPolicy.maxDurationMs) || request.safetyPolicy.maxDurationMs <= 0) {
    return {
      ok: false,
      status: "failed",
      failureReason: "invalid_duration_limit",
      reviewRequiredReason: null,
      statusMessage: "Mouse Click maxDurationMs must be a finite positive integer.",
      policyDecision: "block",
      dataQualityFlags: ["invalid_max_duration"],
    };
  }
  if (!Number.isFinite(request.safetyPolicy.primitiveTimeoutMs) || request.safetyPolicy.primitiveTimeoutMs <= 0 || request.safetyPolicy.primitiveTimeoutMs > request.safetyPolicy.maxDurationMs) {
    return {
      ok: false,
      status: "failed",
      failureReason: "invalid_primitive_timeout",
      reviewRequiredReason: null,
      statusMessage: "Mouse Click primitiveTimeoutMs must be finite, positive, and <= maxDurationMs.",
      policyDecision: "block",
      dataQualityFlags: ["invalid_primitive_timeout"],
    };
  }
  if (request.childCapabilityId === "click-desktop-coordinate" && !request.safetyPolicy.allowDesktopScreenClick) {
    return {
      ok: false,
      status: "review_required",
      failureReason: null,
      reviewRequiredReason: "desktopScreen click requires explicit allowDesktopScreenClick policy",
      statusMessage: "Desktop screen click requires explicit policy approval.",
      policyDecision: "review_required",
      dataQualityFlags: ["desktop_click_policy_review"],
    };
  }
  if (request.childCapabilityId === "click-desktop-coordinate" && request.safetyPolicy.desktopScreenOperatorApprovalRef === null) {
    return {
      ok: false,
      status: "review_required",
      failureReason: null,
      reviewRequiredReason: "desktopScreen click requires desktopScreenOperatorApprovalRef",
      statusMessage: "Desktop screen click requires operator approval ref.",
      policyDecision: "review_required",
      dataQualityFlags: ["desktop_operator_approval_missing"],
    };
  }
  return { ok: true, policyDecision: "allow" };
}