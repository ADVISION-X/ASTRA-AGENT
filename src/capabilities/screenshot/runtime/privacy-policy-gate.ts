import type { ScreenshotAbilityInput } from "../contract.js";
import { createScreenshotFailure } from "../shared/screenshot-failure.js";
import type { ScreenshotChildRegistryEntry } from "./screenshot-child-contract.js";

function buildPrivacyPolicyGateFailure(input: {
  status: "blocked" | "review_required";
  reason: string;
  message: string;
}) {
  return {
    decision: { status: input.status, reason: input.reason },
    failure: createScreenshotFailure({
      code: "privacy_policy_blocked",
      message: input.message,
    }),
  };
}

function resolvePrivacyPolicyApprovalFailure(policy: ScreenshotAbilityInput["privacyPolicy"]) {
  if (policy.operatorApprovalRef) {
    return null;
  }

  return buildPrivacyPolicyGateFailure({
    status: "blocked",
    reason: "operator_approval_required",
    message: "Desktop screenshot requires operatorApprovalRef.",
  });
}

function resolvePrivacyPolicyScreenTargetFailure(policy: ScreenshotAbilityInput["privacyPolicy"]) {
  if (policy.screenTarget) {
    return null;
  }

  return buildPrivacyPolicyGateFailure({
    status: "review_required",
    reason: "screen_target_required",
    message: "Desktop screenshot requires a governed screenTarget.",
  });
}

function resolvePrivacyPolicyFullScreenFailure(policy: ScreenshotAbilityInput["privacyPolicy"]) {
  if (policy.allowFullScreen === true) {
    return null;
  }

  return buildPrivacyPolicyGateFailure({
    status: "review_required",
    reason: "full_screen_default_review",
    message: "Desktop full-screen capture defaults to review_required unless explicitly allowed.",
  });
}

function resolvePrivacyPolicySensitiveStateFailure(policy: ScreenshotAbilityInput["privacyPolicy"]) {
  if (policy.sensitiveScreenState === "blocked") {
    return buildPrivacyPolicyGateFailure({
      status: "blocked",
      reason: "sensitive_screen_blocked",
      message: "Desktop screenshot is blocked by sensitiveScreenState.",
    });
  }

  if (policy.sensitiveScreenState === "review_required" || policy.sensitiveScreenState === "unknown") {
    return buildPrivacyPolicyGateFailure({
      status: "review_required",
      reason: "sensitive_screen_review_required",
      message: "Desktop screenshot requires review because sensitiveScreenState is not approved.",
    });
  }

  return null;
}

function resolvePrivacyPolicyDefaultFailure() {
  return buildPrivacyPolicyGateFailure({
    status: "review_required",
    reason: "desktop_capture_not_enabled_for_success",
    message: "Desktop screenshot remains review_required until bounded desktop capture is implemented.",
  });
}

function resolvePrivacyPolicyGate(input: {
  request: ScreenshotAbilityInput;
  registryEntry: ScreenshotChildRegistryEntry;
}) {
  return !input.registryEntry.requiresPrivacyApproval
    ? {
        decision: { status: "not_applicable" as const, reason: null },
        failure: null,
      }
    : resolvePrivacyPolicyApprovalFailure(input.request.privacyPolicy)
      ?? resolvePrivacyPolicyScreenTargetFailure(input.request.privacyPolicy)
      ?? resolvePrivacyPolicyFullScreenFailure(input.request.privacyPolicy)
      ?? resolvePrivacyPolicySensitiveStateFailure(input.request.privacyPolicy)
      ?? resolvePrivacyPolicyDefaultFailure();
}

export function runPrivacyPolicyGate(input: {
  request: ScreenshotAbilityInput;
  registryEntry: ScreenshotChildRegistryEntry;
}): {
  decision: { status: "passed" | "blocked" | "review_required" | "not_applicable"; reason: string | null };
  failure: ReturnType<typeof createScreenshotFailure> | null;
} {
  return resolvePrivacyPolicyGate(input);
}
