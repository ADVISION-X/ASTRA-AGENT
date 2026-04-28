import {
  PAGE_STATE_ABILITY_GROUP_ID,
  type PageStateAbilityInput,
  type PageStateAbilityResult,
  type PageStateFailureReason,
  type PageStateType,
} from "../contract.js";
import { applyConfidencePolicy } from "./confidence-policy.js";
import { collectObservationRefIds } from "./observation-utils.js";

export function buildPageStateResult(input: {
  abilityInput: PageStateAbilityInput;
  pageStateType: PageStateType;
  stateSummary: string;
  confidence: number;
  startedAt: string;
  endedAt: string;
  reviewRequiredReason?: string | null;
  dataQualityFlags?: string[];
}): PageStateAbilityResult {
  const confidenceOutcome = applyConfidencePolicy({
    confidence: input.confidence,
    confidencePolicy: input.abilityInput.confidencePolicy,
    ...(input.reviewRequiredReason !== undefined ? { reviewRequiredReason: input.reviewRequiredReason } : {}),
  });

  return {
    status: "success",
    abilityGroupId: PAGE_STATE_ABILITY_GROUP_ID,
    childCapabilityId: input.abilityInput.childCapabilityId,
    sessionId: input.abilityInput.sessionId,
    roundId: input.abilityInput.roundId,
    videoVisitId: input.abilityInput.videoVisitId,
    pageStateType: input.pageStateType,
    stateSummary: input.stateSummary,
    confidence: confidenceOutcome.confidence,
    evidenceRefs: [...input.abilityInput.sourceEvidenceRefs],
    observationRefs: collectObservationRefIds(input.abilityInput),
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: Math.max(0, Date.parse(input.endedAt) - Date.parse(input.startedAt)),
    failureReason: null,
    reviewRequiredReason: confidenceOutcome.reviewRequiredReason,
    dataQualityFlags: [...(input.dataQualityFlags ?? []), ...confidenceOutcome.dataQualityFlags],
    debugLogRef: `${input.abilityInput.sessionId}:page-state:${input.abilityInput.childCapabilityId}`,
  };
}

export function buildPageStateFailure(input: {
  abilityInput: PageStateAbilityInput;
  failureReason: PageStateFailureReason;
  stateSummary: string;
  startedAt: string;
  endedAt: string;
  reviewRequiredReason?: string | null;
  dataQualityFlags?: string[];
}): PageStateAbilityResult {
  return {
    status: "failed",
    abilityGroupId: PAGE_STATE_ABILITY_GROUP_ID,
    childCapabilityId: input.abilityInput.childCapabilityId,
    sessionId: input.abilityInput.sessionId,
    roundId: input.abilityInput.roundId,
    videoVisitId: input.abilityInput.videoVisitId,
    pageStateType: "unknown",
    stateSummary: input.stateSummary,
    confidence: 0,
    evidenceRefs: [...input.abilityInput.sourceEvidenceRefs],
    observationRefs: collectObservationRefIds(input.abilityInput),
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: Math.max(0, Date.parse(input.endedAt) - Date.parse(input.startedAt)),
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason ?? null,
    dataQualityFlags: input.dataQualityFlags ?? [],
    debugLogRef: `${input.abilityInput.sessionId}:page-state:${input.abilityInput.childCapabilityId}`,
  };
}