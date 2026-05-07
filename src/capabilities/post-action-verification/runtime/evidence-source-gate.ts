import { POST_ACTION_EVIDENCE_MAX_AGE_MS, POST_ACTION_CHILD_POLICY_MAP } from "../shared/post-action-policy.js";
import type { ParsedPostActionVerificationAbilityInput } from "../contract.js";
import { parsePostActionTimestampMs } from "./verification-clock.js";

function createEvidenceSourceFailure(input: {
  status: "failed" | "review_required";
  failureReason: "missing_observation_support" | "evidence_binding_conflict" | "stale_evidence";
  reviewRequiredReason: string | null;
  statusMessage: string;
  dataQualityFlag: string;
  evidenceSourceDecision: string;
}) {
  return {
    ok: false as const,
    status: input.status,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    statusMessage: input.statusMessage,
    dataQualityFlags: [input.dataQualityFlag],
    evidenceSourceDecision: input.evidenceSourceDecision,
  };
}

function resolveObservationSourceFailure(request: ParsedPostActionVerificationAbilityInput) {
  const observations = request.observationSet.observations;
  const childPolicy = POST_ACTION_CHILD_POLICY_MAP[request.childCapabilityId];
  if (observations.length > 0) return null;

  return createEvidenceSourceFailure(
    {
      status: "review_required",
      failureReason: "missing_observation_support",
      reviewRequiredReason: "Governed observations are required for post-action verification.",
      statusMessage: "No governed observations were provided.",
      dataQualityFlag: "observation_missing",
      evidenceSourceDecision: "review_required:missing_observation_support",
    },
  );
}

function resolveObservationEntryFailure(request: ParsedPostActionVerificationAbilityInput, observation: ParsedPostActionVerificationAbilityInput["observationSet"]["observations"][number]) {
  const allowedObservationKinds: readonly string[] = POST_ACTION_CHILD_POLICY_MAP[request.childCapabilityId].allowedObservationKinds;
  if (!allowedObservationKinds.includes(observation.kind)) {
    return createEvidenceSourceFailure(
      {
        status: "failed",
        failureReason: "missing_observation_support",
        reviewRequiredReason: null,
        statusMessage: `Observation kind ${observation.kind} is not allowed for ${request.childCapabilityId}.`,
        dataQualityFlag: "observation_kind_forbidden",
        evidenceSourceDecision: "failed:forbidden_observation_kind",
      },
    );
  }

  if (observation.sessionId === request.sessionId && observation.roundId === request.roundId && observation.videoVisitId === request.videoVisitId) {
    return null;
  }

  return createEvidenceSourceFailure(
    {
      status: "failed",
      failureReason: "evidence_binding_conflict",
      reviewRequiredReason: null,
      statusMessage: `Observation ${observation.ref} does not match the action binding.`,
      dataQualityFlag: "observation_binding_conflict",
      evidenceSourceDecision: "failed:observation_binding_conflict",
    },
  );
}

function resolveBeforeAfterEvidenceFailure(request: ParsedPostActionVerificationAbilityInput, nowMs: number) {
  const actionStartedAtMs = parsePostActionTimestampMs(request.actionProof.startedAt);
  const evidenceFreshnessChecks = [
    { evidence: request.beforeAfterEvidence.beforeEvidence, comparisonMs: actionStartedAtMs },
    { evidence: request.beforeAfterEvidence.afterEvidence, comparisonMs: nowMs },
  ];

  for (const { evidence, comparisonMs } of evidenceFreshnessChecks) {
    if (evidence === null) continue;

    if (evidence.sessionId !== request.sessionId || evidence.roundId !== request.roundId || evidence.videoVisitId !== request.videoVisitId) {
      return createEvidenceSourceFailure(
        {
          status: "failed",
          failureReason: "evidence_binding_conflict",
          reviewRequiredReason: null,
          statusMessage: `Evidence ${evidence.evidenceRef} does not match the action binding.`,
          dataQualityFlag: "evidence_binding_conflict",
          evidenceSourceDecision: "failed:evidence_binding_conflict",
        },
      );
    }

    if (Math.abs(comparisonMs - parsePostActionTimestampMs(evidence.capturedAt)) > POST_ACTION_EVIDENCE_MAX_AGE_MS) {
      return createEvidenceSourceFailure(
        {
          status: "review_required",
          failureReason: "stale_evidence",
          reviewRequiredReason: `Evidence ${evidence.evidenceRef} is stale for governed verification.`,
          statusMessage: "Evidence freshness window expired.",
          dataQualityFlag: "stale_evidence",
          evidenceSourceDecision: "review_required:stale_evidence",
        },
      );
    }
  }

  return null;
}

export function validateEvidenceSources(input: {
  request: ParsedPostActionVerificationAbilityInput;
  nowIsoTimestamp: string;
}) {
  const request = input.request;
  const observations = request.observationSet.observations;
  const childPolicy = POST_ACTION_CHILD_POLICY_MAP[request.childCapabilityId];
  const allowedObservationKinds: readonly string[] = childPolicy.allowedObservationKinds;

  const nowMs = parsePostActionTimestampMs(input.nowIsoTimestamp);
  const noObservationFailure = resolveObservationSourceFailure(request);
  if (noObservationFailure) {
    return noObservationFailure;
  }

  for (const observation of observations) {
    const observationFailure = resolveObservationEntryFailure(request, observation);
    if (observationFailure) return observationFailure;
  }

  const evidenceFailure = resolveBeforeAfterEvidenceFailure(request, nowMs);
  if (evidenceFailure) return evidenceFailure;

  return {
    ok: true,
    evidenceSourceDecision: "allow" as const,
  };
}
