import {
  PAGE_STATE_ABILITY_GROUP_ID,
  type PageStateChildCapability,
  type PageStateFailureReason,
} from "../../contract.js";
import { getObservationByKind, readBooleanPayload, readStringArrayPayload, readStringPayload } from "../../shared/observation-utils.js";
import { buildPageStateFailure, buildPageStateResult } from "../../shared/page-state-result.js";
import { validatePageStateInput } from "../../shared/state-policy.js";

function collectRuntimeSignals(input: Parameters<PageStateChildCapability["execute"]>[0]) {
  return [...getObservationByKind(input, "runtime_signal"), ...getObservationByKind(input, "page_marker")];
}

function hasSignalState(observation: ReturnType<typeof collectRuntimeSignals>[number], key: "stable" | "unstable", expectedState: "stable" | "unstable") {
  const state = readStringPayload(observation, "state");
  const stateFlag = readBooleanPayload(observation, key);
  const tags = readStringArrayPayload(observation, "tags");
  return stateFlag === true || state === expectedState || tags.includes(expectedState);
}

function buildInvalidInputFailure(input: Parameters<PageStateChildCapability["execute"]>[0], startedAt: string, failureReason: PageStateFailureReason) {
  return buildPageStateFailure({ abilityInput: input, failureReason, stateSummary: "page-state video-stable detection input is incomplete", startedAt, endedAt: new Date().toISOString() });
}

function resolveVideoStableResult(input: Parameters<PageStateChildCapability["execute"]>[0], startedAt: string, endedAt: string) {
  const runtimeSignals = collectRuntimeSignals(input);
  const unstable = runtimeSignals.some((observation) => hasSignalState(observation, "unstable", "unstable"));
  if (unstable) {
    return buildPageStateResult({ abilityInput: input, pageStateType: "video_unstable", stateSummary: "current video is still unstable and should not be sampled yet", confidence: 0.92, startedAt, endedAt });
  }

  const stable = runtimeSignals.some((observation) => hasSignalState(observation, "stable", "stable"));
  if (stable) {
    return buildPageStateResult({ abilityInput: input, pageStateType: "video_stable", stateSummary: "current video appears stable enough for observation", confidence: 0.92, startedAt, endedAt });
  }

  return buildPageStateFailure({ abilityInput: input, failureReason: "insufficient_signal", stateSummary: "video stability signals are missing or conflicting", startedAt, endedAt, reviewRequiredReason: input.statePolicy.allowReviewRequired ? "video stability could not be classified from current observations" : null });
}

async function executeDetectVideoStable(input: Parameters<PageStateChildCapability["execute"]>[0]) {
  const startedAt = new Date().toISOString();
  const failureReason = validatePageStateInput(input);
  if (failureReason) {
    return buildInvalidInputFailure(input, startedAt, failureReason);
  }

  return resolveVideoStableResult(input, startedAt, new Date().toISOString());
}

export function createDetectVideoStableCapability(): PageStateChildCapability {
  return {
    abilityGroupId: PAGE_STATE_ABILITY_GROUP_ID,
    childCapabilityId: "detect-video-stable",
    execute: executeDetectVideoStable,
  };
}