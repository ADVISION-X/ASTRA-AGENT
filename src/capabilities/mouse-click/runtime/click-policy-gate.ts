import { ALLOWED_MOUSE_CLICK_PURPOSE_PREFIXES } from "../shared/mouse-click-policy.js";
import type { ParsedMouseClickAbilityInput } from "../contract.js";

type MouseClickPolicyFailure = {
  ok: false;
  status: "failed" | "review_required";
  failureReason: "missing_requested_by" | "missing_purpose" | "missing_source_coordinate_proof_ref" | "missing_source_target_ref" | "missing_source_evidence_binding" | "right_click_not_allowed" | "double_click_not_allowed" | "invalid_click_count" | "invalid_duration_limit" | "invalid_primitive_timeout" | "desktop_click_disabled_by_policy" | "desktop_click_phase_blocked" | "desktop_click_profile_blocked" | "desktop_click_operator_approval_required" | "desktop_click_operator_approval_stale" | null;
  reviewRequiredReason: string | null;
  statusMessage: string;
  policyDecision: "block" | "review_required";
  policyDecisionReason: string;
  dataQualityFlags: string[];
};

function resolvePurposePrefix(purpose: string): string {
  const trimmed = purpose.trim();
  if (!trimmed) {
    return "";
  }
  const delimiterIndex = trimmed.indexOf(":");
  return delimiterIndex === -1 ? trimmed : trimmed.slice(0, delimiterIndex);
}

function createPolicyFailure(input: Omit<MouseClickPolicyFailure, "ok">): MouseClickPolicyFailure {
  return { ok: false, ...input };
}

function validateRequiredFields(request: ParsedMouseClickAbilityInput): MouseClickPolicyFailure | null {
  if (!request.requestedBy.trim()) {
    return createPolicyFailure({
      status: "failed",
      failureReason: "missing_requested_by",
      reviewRequiredReason: null,
      statusMessage: "Mouse Click requires requestedBy.",
      policyDecision: "block",
      policyDecisionReason: "requested_by_missing",
      dataQualityFlags: ["requested_by_missing"],
    });
  }

  return !request.purpose.trim()
    ? createPolicyFailure({
        status: "failed",
        failureReason: "missing_purpose",
        reviewRequiredReason: null,
        statusMessage: "Mouse Click requires purpose.",
        policyDecision: "block",
        policyDecisionReason: "purpose_missing",
        dataQualityFlags: ["purpose_missing"],
      })
    : null;
}

function validatePurposePolicy(request: ParsedMouseClickAbilityInput): MouseClickPolicyFailure | null {
  return ALLOWED_MOUSE_CLICK_PURPOSE_PREFIXES.includes(resolvePurposePrefix(request.purpose) as (typeof ALLOWED_MOUSE_CLICK_PURPOSE_PREFIXES)[number])
    ? null
    : createPolicyFailure({
        status: "review_required",
        failureReason: null,
        reviewRequiredReason: `purpose ${request.purpose} is not in the governed allowlist`,
        statusMessage: "Mouse Click purpose is outside the governed allowlist.",
        policyDecision: "review_required",
        policyDecisionReason: "purpose_allowlist_review",
        dataQualityFlags: ["purpose_allowlist_review"],
      });
}

function validateSourceBindings(request: ParsedMouseClickAbilityInput): MouseClickPolicyFailure | null {
  if (!request.sourceCoordinateProofRef.trim()) {
    return createPolicyFailure({
      status: "failed",
      failureReason: "missing_source_coordinate_proof_ref",
      reviewRequiredReason: null,
      statusMessage: "Mouse Click requires sourceCoordinateProofRef.",
      policyDecision: "block",
      policyDecisionReason: "source_coordinate_proof_missing",
      dataQualityFlags: ["source_coordinate_proof_missing"],
    });
  }

  return !request.sourceTargetRef.trim()
    ? createPolicyFailure({
        status: "failed",
        failureReason: "missing_source_target_ref",
        reviewRequiredReason: null,
        statusMessage: "Mouse Click requires sourceTargetRef.",
        policyDecision: "block",
        policyDecisionReason: "source_target_missing",
        dataQualityFlags: ["source_target_missing"],
      })
    : null;
}

function validateEvidenceBinding(request: ParsedMouseClickAbilityInput): MouseClickPolicyFailure | null {
  if (request.sourceEvidenceRef || request.geometryGuardProof.sourceScreenshotEvidenceRef) {
    return null;
  }

  const operatorApproved = request.safetyPolicy.allowOperatorManual && request.safetyPolicy.operatorManualApprovalRef !== null;
  return createPolicyFailure({
    status: operatorApproved ? "review_required" : "failed",
    failureReason: operatorApproved ? null : "missing_source_evidence_binding",
    reviewRequiredReason: operatorApproved ? "sourceEvidenceRef missing; operator approval required before replay-safe click" : null,
    statusMessage: "Mouse Click requires evidence binding before execution.",
    policyDecision: operatorApproved ? "review_required" : "block",
    policyDecisionReason: operatorApproved ? "source_evidence_missing_review" : "source_evidence_missing",
    dataQualityFlags: ["source_evidence_missing"],
  });
}

function validateButtonAndTimingPolicy(request: ParsedMouseClickAbilityInput): MouseClickPolicyFailure | null {
  if (request.button === "right" && !request.safetyPolicy.allowRightClick) {
    return createPolicyFailure({
      status: "failed",
      failureReason: "right_click_not_allowed",
      reviewRequiredReason: null,
      statusMessage: "Right click is blocked unless allowRightClick=true.",
      policyDecision: "block",
      policyDecisionReason: "right_click_blocked",
      dataQualityFlags: ["right_click_blocked"],
    });
  }

  if (request.clickCount === 2 && !request.safetyPolicy.allowDoubleClick) {
    return createPolicyFailure({
      status: "failed",
      failureReason: "double_click_not_allowed",
      reviewRequiredReason: null,
      statusMessage: "Double click is blocked unless allowDoubleClick=true.",
      policyDecision: "block",
      policyDecisionReason: "double_click_blocked",
      dataQualityFlags: ["double_click_blocked"],
    });
  }

  if (request.clickCount !== 1 && request.clickCount !== 2) {
    return createPolicyFailure({
      status: "failed",
      failureReason: "invalid_click_count",
      reviewRequiredReason: null,
      statusMessage: "Mouse Click clickCount must be 1 or 2.",
      policyDecision: "block",
      policyDecisionReason: "invalid_click_count",
      dataQualityFlags: ["invalid_click_count"],
    });
  }

  return !Number.isFinite(request.safetyPolicy.maxDurationMs) || request.safetyPolicy.maxDurationMs <= 0
    ? createPolicyFailure({
        status: "failed",
        failureReason: "invalid_duration_limit",
        reviewRequiredReason: null,
        statusMessage: "Mouse Click maxDurationMs must be a finite positive integer.",
        policyDecision: "block",
        policyDecisionReason: "invalid_max_duration",
        dataQualityFlags: ["invalid_max_duration"],
      })
    : !Number.isFinite(request.safetyPolicy.primitiveTimeoutMs) || request.safetyPolicy.primitiveTimeoutMs <= 0 || request.safetyPolicy.primitiveTimeoutMs > request.safetyPolicy.maxDurationMs
      ? createPolicyFailure({
          status: "failed",
          failureReason: "invalid_primitive_timeout",
          reviewRequiredReason: null,
          statusMessage: "Mouse Click primitiveTimeoutMs must be finite, positive, and <= maxDurationMs.",
          policyDecision: "block",
          policyDecisionReason: "invalid_primitive_timeout",
          dataQualityFlags: ["invalid_primitive_timeout"],
        })
      : null;
}

function validateDesktopClickPolicy(request: ParsedMouseClickAbilityInput, nowIsoTimestamp: string): MouseClickPolicyFailure | null {
  if (request.childCapabilityId !== "click-desktop-coordinate") {
    return null;
  }

  if (!request.safetyPolicy.currentPhaseAllowsDesktopClick) {
    return createPolicyFailure({
      status: "review_required",
      failureReason: null,
      reviewRequiredReason: "desktopScreen click is phase-gated until explicit rollout approval.",
      statusMessage: "Desktop screen click is blocked by the current phase gate.",
      policyDecision: "review_required",
      policyDecisionReason: "desktop_click_phase_blocked",
      dataQualityFlags: ["desktop_click_phase_blocked"],
    });
  }

  if (!request.safetyPolicy.platformProfileAllowsDesktopClick) {
    return createPolicyFailure({
      status: "review_required",
      failureReason: null,
      reviewRequiredReason: "desktopScreen click is blocked by the active platform profile.",
      statusMessage: "Desktop screen click is blocked by the platform profile.",
      policyDecision: "review_required",
      policyDecisionReason: "desktop_click_profile_blocked",
      dataQualityFlags: ["desktop_click_profile_blocked"],
    });
  }

  if (!request.safetyPolicy.allowDesktopScreenClick) {
    return createPolicyFailure({
      status: "review_required",
      failureReason: null,
      reviewRequiredReason: "desktopScreen click requires explicit allowDesktopScreenClick policy.",
      statusMessage: "Desktop screen click requires explicit policy approval.",
      policyDecision: "review_required",
      policyDecisionReason: "desktop_click_disabled_by_policy",
      dataQualityFlags: ["desktop_click_disabled_by_policy"],
    });
  }

  if (request.safetyPolicy.desktopScreenOperatorApprovalRef === null) {
    return createPolicyFailure({
      status: "review_required",
      failureReason: null,
      reviewRequiredReason: "desktopScreen click requires desktopScreenOperatorApprovalRef.",
      statusMessage: "Desktop screen click requires operator approval ref.",
      policyDecision: "review_required",
      policyDecisionReason: "desktop_operator_approval_missing",
      dataQualityFlags: ["desktop_operator_approval_missing"],
    });
  }

  return request.safetyPolicy.desktopOperatorApprovalValidUntil !== null
    && request.safetyPolicy.desktopOperatorApprovalValidUntil <= nowIsoTimestamp
    ? createPolicyFailure({
        status: "review_required",
        failureReason: null,
        reviewRequiredReason: "desktopScreen operator approval is stale and must be refreshed.",
        statusMessage: "Desktop screen click operator approval has expired.",
        policyDecision: "review_required",
        policyDecisionReason: "desktop_operator_approval_stale",
        dataQualityFlags: ["desktop_operator_approval_stale"],
      })
    : null;
}

export function validateClickPolicy(input: { request: ParsedMouseClickAbilityInput; nowIsoTimestamp: string }):
  | { ok: true; policyDecision: "allow"; policyDecisionReason: "policy_gate_passed" }
  | MouseClickPolicyFailure {
  const request = input.request;
  const requiredFieldsFailure = validateRequiredFields(request);
  if (requiredFieldsFailure) {
    return requiredFieldsFailure;
  }

  const purposeFailure = validatePurposePolicy(request);
  if (purposeFailure) {
    return purposeFailure;
  }

  const sourceBindingFailure = validateSourceBindings(request);
  if (sourceBindingFailure) {
    return sourceBindingFailure;
  }

  const evidenceBindingFailure = validateEvidenceBinding(request);
  if (evidenceBindingFailure) {
    return evidenceBindingFailure;
  }

  const buttonTimingFailure = validateButtonAndTimingPolicy(request);
  if (buttonTimingFailure) {
    return buttonTimingFailure;
  }

  const desktopFailure = validateDesktopClickPolicy(request, input.nowIsoTimestamp);
  if (desktopFailure) {
    return desktopFailure;
  }

  return { ok: true, policyDecision: "allow", policyDecisionReason: "policy_gate_passed" };
}