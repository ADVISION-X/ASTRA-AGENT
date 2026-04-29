import { POST_ACTION_OBSERVATION_SOURCE_ABILITY_GROUP_IDS } from "../shared/post-action-observation.js";
import { POST_ACTION_EVIDENCE_MAX_AGE_MS } from "../shared/post-action-policy.js";
import type { ParsedPostActionVerificationAbilityInput } from "../contract.js";
import { parsePostActionTimestampMs } from "./verification-clock.js";

export function validateEvidenceSources(input: {
  request: ParsedPostActionVerificationAbilityInput;
  nowIsoTimestamp: string;
}) {
  const request = input.request;
  const observations = request.observationSet.observations;
  if (observations.length === 0) {
    return {
      ok: false,
      status: "review_required" as const,
      failureReason: "missing_observation_support" as const,
      reviewRequiredReason: "Governed observations are required for post-action verification.",
      statusMessage: "No governed observations were provided.",
      dataQualityFlags: ["observation_missing"],
      evidenceSourceDecision: "review_required:missing_observation_support" as const,
    };
  }

  for (const observation of observations) {
    if (!POST_ACTION_OBSERVATION_SOURCE_ABILITY_GROUP_IDS.includes(observation.source.sourceAbilityGroupId)) {
      return {
        ok: false,
        status: "blocked" as const,
        failureReason: "evidence_binding_conflict" as const,
        reviewRequiredReason: null,
        statusMessage: `Observation source ${observation.source.sourceAbilityGroupId} is not allowed.`,
        dataQualityFlags: ["forbidden_observation_source"],
        evidenceSourceDecision: "blocked:forbidden_observation_source" as const,
      };
    }

    if (
      observation.sessionId !== request.sessionId
      || observation.roundId !== request.roundId
      || observation.videoVisitId !== request.videoVisitId
    ) {
      return {
        ok: false,
        status: "blocked" as const,
        failureReason: "evidence_binding_conflict" as const,
        reviewRequiredReason: null,
        statusMessage: `Observation ${observation.ref} does not match the action binding.`,
        dataQualityFlags: ["observation_binding_conflict"],
        evidenceSourceDecision: "blocked:observation_binding_conflict" as const,
      };
    }
  }

  const nowMs = parsePostActionTimestampMs(input.nowIsoTimestamp);
  for (const evidence of [request.beforeAfterEvidence.beforeEvidence, request.beforeAfterEvidence.afterEvidence]) {
    if (evidence === null) {
      continue;
    }

    if (evidence.sessionId !== request.sessionId || evidence.roundId !== request.roundId || evidence.videoVisitId !== request.videoVisitId) {
      return {
        ok: false,
        status: "blocked" as const,
        failureReason: "evidence_binding_conflict" as const,
        reviewRequiredReason: null,
        statusMessage: `Evidence ${evidence.evidenceRef} does not match the action binding.`,
        dataQualityFlags: ["evidence_binding_conflict"],
        evidenceSourceDecision: "blocked:evidence_binding_conflict" as const,
      };
    }

    if (Math.abs(nowMs - parsePostActionTimestampMs(evidence.capturedAt)) > POST_ACTION_EVIDENCE_MAX_AGE_MS) {
      return {
        ok: false,
        status: "review_required" as const,
        failureReason: "stale_evidence" as const,
        reviewRequiredReason: `Evidence ${evidence.evidenceRef} is stale for governed verification.`,
        statusMessage: "Evidence freshness window expired.",
        dataQualityFlags: ["stale_evidence"],
        evidenceSourceDecision: "review_required:stale_evidence" as const,
      };
    }
  }

  return {
    ok: true,
    evidenceSourceDecision: "allow" as const,
  };
}
