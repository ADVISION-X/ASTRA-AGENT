import {
  PAGE_STATE_ABILITY_GROUP_ID,
  type PageStateChildCapability,
} from "../../contract.js";
import { getObservationByKind, readBooleanPayload, readStringPayload } from "../../shared/observation-utils.js";
import { buildPageStateFailure, buildPageStateResult } from "../../shared/page-state-result.js";
import { validatePageStateInput } from "../../shared/state-policy.js";

function getAbnormalObservation(input: Parameters<PageStateChildCapability["execute"]>[0]) {
  const observations = [...getObservationByKind(input, "runtime_signal"), ...getObservationByKind(input, "page_marker")];
  return observations.find((observation) => readBooleanPayload(observation, "abnormal") !== null || readBooleanPayload(observation, "unknownUi") !== null || readStringPayload(observation, "abnormalKind") !== null) ?? null;
}

function hasAbnormalObservation(observation: ReturnType<typeof getAbnormalObservation>) {
  return Boolean(
    observation
    && (
      readBooleanPayload(observation, "abnormal") === true
      || readBooleanPayload(observation, "unknownUi") === true
      || readStringPayload(observation, "abnormalKind") !== null
    )
  );
}

function isPageAbnormal(input: Parameters<PageStateChildCapability["execute"]>[0]) {
  return input.currentUrl === "about:blank"
    || input.browserLoginState === "login_required"
    || input.browserLoginState === "review_required"
    || hasAbnormalObservation(getAbnormalObservation(input));
}

async function executeDetectPageAbnormality(input: Parameters<PageStateChildCapability["execute"]>[0]) {
  const startedAt = new Date().toISOString();
  const failureReason = validatePageStateInput(input);
  if (failureReason) {
    return buildPageStateFailure({ abilityInput: input, failureReason, stateSummary: "page-state abnormality detection input is incomplete", startedAt, endedAt: new Date().toISOString() });
  }

  const abnormal = isPageAbnormal(input);
  return buildPageStateResult({ abilityInput: input, pageStateType: abnormal ? "page_abnormal" : "page_normal", stateSummary: abnormal ? "current page is abnormal for governed runtime progression" : "current page does not show abnormal runtime blockers", confidence: abnormal ? 0.9 : 0.82, startedAt, endedAt: new Date().toISOString(), reviewRequiredReason: abnormal && input.statePolicy.allowReviewRequired ? "current page state is abnormal and requires operator review" : null });
}

export function createDetectPageAbnormalityCapability(): PageStateChildCapability {
  return {
    abilityGroupId: PAGE_STATE_ABILITY_GROUP_ID,
    childCapabilityId: "detect-page-abnormality",
    execute: executeDetectPageAbnormality,
  };
}