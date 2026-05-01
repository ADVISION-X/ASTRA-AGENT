import { PAGE_STATE_ABILITY_GROUP_ID } from "../../contract.js";
import { findPageMarker, findVisualTargets } from "../../shared/page-state-observation.js";
import type { DetectSafetyPageChildCapability } from "./contract.js";
import { DetectSafetyPageChildInputSchema, DetectSafetyPageChildOutputSchema } from "./schema.js";

function buildSafetyPageCaptchaOutput(request: ReturnType<typeof DetectSafetyPageChildInputSchema.parse>, matchedObservationIds: string[]) {
  return {
    childCapabilityId: "detect-safety-page" as const,
    pageStateType: "captcha_challenge" as const,
    stateSummary: "Captcha or browser review evidence blocks the current page.",
    confidence: 0.97,
    reviewRequiredReason: "Operator review is required because captcha or browser review evidence is present.",
    dataQualityFlags: [],
    matchedObservationIds,
    supportingEvidenceRefs: [...request.sourceEvidenceRefs],
    supportingReasons: ["captcha marker, captcha target, or browser review state detected"],
  };
}

function buildSafetyPageWallOutput(request: ReturnType<typeof DetectSafetyPageChildInputSchema.parse>, matchedObservationIds: string[]) {
  return {
    childCapabilityId: "detect-safety-page" as const,
    pageStateType: "safety_wall" as const,
    stateSummary: "Safety-wall evidence indicates the current page cannot proceed.",
    confidence: 0.94,
    reviewRequiredReason: "Safety wall must be cleared before execution can proceed.",
    dataQualityFlags: [],
    matchedObservationIds,
    supportingEvidenceRefs: [...request.sourceEvidenceRefs],
    supportingReasons: ["safety-wall marker or login-form target detected during safety check"],
  };
}

function buildSafetyPageNormalOutput(request: ReturnType<typeof DetectSafetyPageChildInputSchema.parse>, matchedObservationIds: string[]) {
  return {
    childCapabilityId: "detect-safety-page" as const,
    pageStateType: "page_normal" as const,
    stateSummary: "No governed safety-wall or captcha evidence is present.",
    confidence: matchedObservationIds.length > 0 ? 0.86 : 0.74,
    reviewRequiredReason: null,
    dataQualityFlags: matchedObservationIds.length > 0 ? [] : ["insufficient_signal"],
    matchedObservationIds,
    supportingEvidenceRefs: [...request.sourceEvidenceRefs],
    supportingReasons: ["no safety-wall or captcha evidence detected"],
  };
}

function resolveDetectSafetyPageOutput(request: ReturnType<typeof DetectSafetyPageChildInputSchema.parse>) {
  const safetyMarkers = findPageMarker(request.observations, "safety_wall").filter((observation) => observation.payload.present);
  const captchaMarkers = findPageMarker(request.observations, "captcha").filter((observation) => observation.payload.present);
  const captchaTargets = findVisualTargets(request.observations, "captcha").filter((observation) => observation.payload.matched);
  const loginFormTargets = findVisualTargets(request.observations, "login_form").filter((observation) => observation.payload.matched);
  const matchedObservationIds = [...safetyMarkers, ...captchaMarkers, ...captchaTargets, ...loginFormTargets].map((observation) => observation.observationId);

  if (captchaMarkers.length > 0 || captchaTargets.length > 0 || request.snapshot.browserLoginState === "review_required") {
    return buildSafetyPageCaptchaOutput(request, matchedObservationIds);
  }

  if (safetyMarkers.length > 0 || loginFormTargets.length > 0) {
    return buildSafetyPageWallOutput(request, matchedObservationIds);
  }

  return buildSafetyPageNormalOutput(request, matchedObservationIds);
}

async function executeDetectSafetyPage(input: unknown) {
  const request = DetectSafetyPageChildInputSchema.parse(input);
  return DetectSafetyPageChildOutputSchema.parse(resolveDetectSafetyPageOutput(request));
}

export function createDetectSafetyPageCapability(): DetectSafetyPageChildCapability {
  return {
    abilityGroupId: PAGE_STATE_ABILITY_GROUP_ID,
    childCapabilityId: "detect-safety-page",
    execute: executeDetectSafetyPage,
  };
}
