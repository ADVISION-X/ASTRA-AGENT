import type {
  PostActionFailureReason,
  PostActionVerificationAbilityInput,
} from "../contract.js";

function requiresAfterEvidence(input: PostActionVerificationAbilityInput): boolean {
  return input.expectedOutcome.requiresVisualEvidence
    && !input.afterEvidenceRef
    && input.observationRefs.length === 0;
}

function requiresBeforeAfterEvidence(input: PostActionVerificationAbilityInput): boolean {
  return input.expectedOutcome.requiresBeforeAfterComparison
    && (!input.beforeEvidenceRef || !input.afterEvidenceRef);
}

function isSelfReportedOnly(input: PostActionVerificationAbilityInput): boolean {
  return !input.verificationPolicy.allowSelfReportedSuccess
    && input.observationRefs.every((observation) => observation.kind === "action_completion");
}

export function validateVerificationInput(input: PostActionVerificationAbilityInput): PostActionFailureReason | null {
  if (!input.actionLogRef) {
    return "missing_action_log_ref";
  }

  if (!input.expectedOutcome) {
    return "missing_expected_outcome";
  }

  if (!input.verificationPolicy) {
    return "missing_verification_policy";
  }

  if (requiresAfterEvidence(input)) {
    return "missing_after_evidence";
  }

  if (requiresBeforeAfterEvidence(input)) {
    return "missing_before_after_evidence";
  }

  if (isSelfReportedOnly(input)) {
    return "self_reported_success_only";
  }

  return null;
}