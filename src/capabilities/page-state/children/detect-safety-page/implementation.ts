import { PAGE_STATE_ABILITY_GROUP_ID } from "../../contract.js";
import { findPageMarker, findPlatformCaptures, findVisualTargets } from "../../shared/page-state-observation.js";
import type { DetectSafetyPageChildCapability } from "./contract.js";
import { DetectSafetyPageChildInputSchema, DetectSafetyPageChildOutputSchema } from "./schema.js";

type DetectSafetyPageRequest = ReturnType<typeof DetectSafetyPageChildInputSchema.parse>;
type PageMarkerObservation = ReturnType<typeof findPageMarker>[number];
type SafetyObservation = DetectSafetyPageRequest["observations"][number];

function toObservationIds(observations: readonly SafetyObservation[]) {
  return [...new Set(observations.map((observation) => observation.observationId))];
}

function isPresentPageMarker(observation: PageMarkerObservation) {
  return observation.payload.present;
}

function isAbsentPageMarker(observation: PageMarkerObservation) {
  return !observation.payload.present;
}

function collectPositiveSafetyBlockers(request: DetectSafetyPageRequest) {
  const safetyMarkers = findPageMarker(request.observations, "safety_wall").filter(isPresentPageMarker);
  const captchaMarkers = findPageMarker(request.observations, "captcha").filter(isPresentPageMarker);
  const captchaTargets = findVisualTargets(request.observations, "captcha").filter((observation) => observation.payload.matched);
  const loginFormTargets = findVisualTargets(request.observations, "login_form").filter((observation) => observation.payload.matched);

  return {
    safetyMarkers,
    captchaMarkers,
    captchaTargets,
    loginFormTargets,
    matchedObservationIds: toObservationIds([...safetyMarkers, ...captchaMarkers, ...captchaTargets, ...loginFormTargets]),
  };
}

function collectNormalSafetyEvidence(request: DetectSafetyPageRequest) {
  const absentCaptchaMarkers = findPageMarker(request.observations, "captcha").filter(isAbsentPageMarker);
  const absentSafetyWallMarkers = findPageMarker(request.observations, "safety_wall").filter(isAbsentPageMarker);
  const postOpenCaptures = findPlatformCaptures(request.observations, "post_open_capture");

  return toObservationIds([...absentCaptchaMarkers, ...absentSafetyWallMarkers, ...postOpenCaptures]);
}

function buildSafetyPageCaptchaOutput(request: DetectSafetyPageRequest, matchedObservationIds: string[]) {
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

function buildSafetyPageWallOutput(request: DetectSafetyPageRequest, matchedObservationIds: string[]) {
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

function buildSafetyPageNormalOutput(request: DetectSafetyPageRequest, matchedObservationIds: string[]) {
  return {
    childCapabilityId: "detect-safety-page" as const,
    pageStateType: "page_normal" as const,
    stateSummary: "Governed safety checks found no active safety-wall or captcha evidence.",
    confidence: matchedObservationIds.length >= 2 ? 0.88 : 0.74,
    reviewRequiredReason: null,
    dataQualityFlags: matchedObservationIds.length >= 2 ? [] : ["insufficient_signal"],
    matchedObservationIds,
    supportingEvidenceRefs: [...request.sourceEvidenceRefs],
    supportingReasons: ["negative captcha and safety-wall observations support normal page state"],
  };
}

function resolveDetectSafetyPageOutput(request: DetectSafetyPageRequest) {
  const blockers = collectPositiveSafetyBlockers(request);

  if (blockers.captchaMarkers.length > 0 || blockers.captchaTargets.length > 0 || request.snapshot.browserLoginState === "review_required") {
    return buildSafetyPageCaptchaOutput(request, blockers.matchedObservationIds);
  }

  if (blockers.safetyMarkers.length > 0 || blockers.loginFormTargets.length > 0) {
    return buildSafetyPageWallOutput(request, blockers.matchedObservationIds);
  }

  return buildSafetyPageNormalOutput(request, collectNormalSafetyEvidence(request));
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
