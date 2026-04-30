import type { ScreenshotAbilityInput } from "../contract.js";
import { createScreenshotFailure } from "../shared/screenshot-failure.js";
import type { ScreenshotChildRegistryEntry } from "./screenshot-child-contract.js";

export function runPrivacyPolicyGate(input: {
  request: ScreenshotAbilityInput;
  registryEntry: ScreenshotChildRegistryEntry;
}): {
  decision: { status: "passed" | "blocked" | "review_required" | "not_applicable"; reason: string | null };
  failure: ReturnType<typeof createScreenshotFailure> | null;
} {
  if (!input.registryEntry.requiresPrivacyApproval) {
    return {
      decision: { status: "not_applicable", reason: null },
      failure: null,
    };
  }

  const policy = input.request.privacyPolicy;
  if (!policy.operatorApprovalRef) {
    return {
      decision: { status: "blocked", reason: "operator_approval_required" },
      failure: createScreenshotFailure({
        code: "privacy_policy_blocked",
        message: "Desktop screenshot requires operatorApprovalRef.",
      }),
    };
  }
  if (!policy.screenTarget) {
    return {
      decision: { status: "review_required", reason: "screen_target_required" },
      failure: createScreenshotFailure({
        code: "privacy_policy_blocked",
        message: "Desktop screenshot requires a governed screenTarget.",
      }),
    };
  }
  if (policy.allowFullScreen !== true) {
    return {
      decision: { status: "review_required", reason: "full_screen_default_review" },
      failure: createScreenshotFailure({
        code: "privacy_policy_blocked",
        message: "Desktop full-screen capture defaults to review_required unless explicitly allowed.",
      }),
    };
  }
  if (policy.sensitiveScreenState === "blocked") {
    return {
      decision: { status: "blocked", reason: "sensitive_screen_blocked" },
      failure: createScreenshotFailure({
        code: "privacy_policy_blocked",
        message: "Desktop screenshot is blocked by sensitiveScreenState.",
      }),
    };
  }
  if (policy.sensitiveScreenState === "review_required" || policy.sensitiveScreenState === "unknown") {
    return {
      decision: { status: "review_required", reason: "sensitive_screen_review_required" },
      failure: createScreenshotFailure({
        code: "privacy_policy_blocked",
        message: "Desktop screenshot requires review because sensitiveScreenState is not approved.",
      }),
    };
  }

  return {
    decision: { status: "review_required", reason: "desktop_capture_not_enabled_for_success" },
    failure: createScreenshotFailure({
      code: "privacy_policy_blocked",
      message: "Desktop screenshot remains review_required until bounded desktop capture is implemented.",
    }),
  };
}
