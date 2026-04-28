import type {
  PageStateAbilityInput,
  PageStateChildCapabilityId,
  PageStateFailureReason,
} from "../contract.js";

const OBSERVATION_REQUIRED = new Set<PageStateChildCapabilityId>([
  "detect-video-stable",
  "detect-comment-panel-state",
  "detect-modal-overlay-state",
]);

export function validatePageStateInput(input: PageStateAbilityInput): PageStateFailureReason | null {
  if (!input.currentUrl) {
    return "missing_current_url";
  }

  if (!input.confidencePolicy) {
    return "missing_confidence_policy";
  }

  if (!input.statePolicy) {
    return "missing_state_policy";
  }

  if (OBSERVATION_REQUIRED.has(input.childCapabilityId) && input.observationRefs.length === 0) {
    return "missing_observation_support";
  }

  return null;
}