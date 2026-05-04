import { PostActionVerificationAbilityResultSchema } from "../schema.js";
import type { ParsedPostActionVerificationAbilityInput, PostActionRuntimeProof, PostActionVerificationAbilityResult } from "../contract.js";
import type { PostActionChildAssessment } from "./post-action-verification-runtime-context.js";

function buildVerificationOutput(input: {
  request: ParsedPostActionVerificationAbilityInput | null;
  assessment: PostActionChildAssessment | null;
  status: PostActionVerificationAbilityResult["status"];
  runtimeProof: PostActionRuntimeProof;
}) {
  return input.status === "success" && input.request !== null && input.assessment !== null
    ? {
        observedOutcome: input.assessment.observedOutcome,
        verificationDecision: "verified" as const,
        confidence: input.assessment.confidence,
        evidenceRefs: [...input.assessment.supportingEvidenceRefs],
        observationRefs: [...input.assessment.supportingObservationRefs],
        actionResultVerifiedRef: input.runtimeProof.outputRef ?? `${input.request.inputRef}:verified`,
        confidenceSource: input.assessment.confidenceSource,
        verifiedByEvidenceKinds: [...input.assessment.verifiedByEvidenceKinds],
        supportingSourceProofRefs: [...input.assessment.supportingSourceProofRefs],
      }
    : null;
}

export function buildPostActionVerificationResult(input: {
  request: ParsedPostActionVerificationAbilityInput | null;
  assessment: PostActionChildAssessment | null;
  status: PostActionVerificationAbilityResult["status"];
  verificationDecision: PostActionVerificationAbilityResult["verificationDecision"];
  failureReason: PostActionVerificationAbilityResult["failureReason"];
  reviewRequiredReason: string | null;
  statusMessage: string;
  runtimeProof: PostActionRuntimeProof;
  diagnosticPayloadRef: string | null;
  dataQualityFlags: string[];
}): PostActionVerificationAbilityResult {
  const output = buildVerificationOutput(input);

  return PostActionVerificationAbilityResultSchema.parse({
    status: input.status,
    abilityGroupId: input.request?.abilityGroupId ?? "post-action-verification",
    childCapabilityId: input.request?.childCapabilityId ?? null,
    missionId: input.request?.missionId ?? null,
    runId: input.request?.runId ?? null,
    sessionId: input.request?.sessionId ?? null,
    roundId: input.request?.roundId ?? null,
    videoVisitId: input.request?.videoVisitId ?? null,
    stepId: input.request?.stepId ?? null,
    mapPackageId: input.request?.mapPackageId ?? null,
    mapPackageVersion: input.request?.mapPackageVersion ?? null,
    selectedMapId: input.request?.selectedMapId ?? null,
    selectedMapVersion: input.request?.selectedMapVersion ?? null,
    activationSnapshotRef: input.request?.activationSnapshotRef ?? null,
    capabilityCallId: input.request?.capabilityCallId ?? null,
    nerveBusEnvelopeId: input.request?.nerveBusEnvelopeId ?? null,
    actionProofRef: input.request?.actionProof.actionProofRef ?? null,
    expectedOutcome: input.request?.expectedOutcome ?? null,
    output,
    verificationDecision: input.verificationDecision,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    statusMessage: input.statusMessage,
    debugLogRef: input.runtimeProof.debugLogRef,
    structuredRuntimeEventRef: input.runtimeProof.structuredRuntimeEventRef,
    diagnosticPayloadRef: input.diagnosticPayloadRef,
    policyDecision: input.runtimeProof.policyDecision,
    runtimeProof: input.runtimeProof,
    dataQualityFlags: input.dataQualityFlags,
  });
}
