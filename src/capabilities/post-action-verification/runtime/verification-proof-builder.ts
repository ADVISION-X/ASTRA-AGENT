import { createId } from "../../../lib/local-runtime/ids.js";
import { PostActionRuntimeProofSchema } from "../schema.js";
import type { PostActionRuntimeProof, ParsedPostActionVerificationAbilityInput, PostActionVerificationAbilityContext } from "../contract.js";

export function buildPostActionRuntimeProof(input: {
  request: ParsedPostActionVerificationAbilityInput;
  context: PostActionVerificationAbilityContext;
  startedAt: string;
  endedAt: string;
  startedMonotonicMs: number;
  endedMonotonicMs: number;
  status: PostActionRuntimeProof["status"];
  verificationDecision: PostActionRuntimeProof["verificationDecision"];
  confidence: number;
  failureReason: string | null;
  reviewRequiredReason: string | null;
  inputDecision: string;
  actionProofDecision: string;
  evidenceSourceDecision: string;
  beforeAfterDecision: string;
  policyDecision: string;
  verificationDecisionTrace: string;
  dataQualityFlags: string[];
  inputRef: string;
  outputRef: string;
}): PostActionRuntimeProof {
  const beforeEvidence = input.request.beforeAfterEvidence.beforeEvidence;
  const afterEvidence = input.request.beforeAfterEvidence.afterEvidence;

  return PostActionRuntimeProofSchema.parse({
    proofId: createId("post_action_verification_proof"),
    runId: createId("post_action_verification_run"),
    missionId: input.request.sessionId,
    sessionId: input.request.sessionId,
    roundId: input.request.roundId,
    videoVisitId: input.request.videoVisitId,
    abilityGroupId: input.request.abilityGroupId,
    childCapabilityId: input.request.childCapabilityId,
    actionProofRef: input.request.actionProof.actionProofRef,
    sourceActionAbilityGroupId: input.request.actionProof.sourceAbilityGroupId,
    sourceActionChildCapabilityId: input.request.actionProof.sourceChildCapabilityId,
    actionType: input.request.actionProof.actionType,
    actionStatus: input.request.actionProof.actionStatus,
    expectedOutcomeType: input.request.expectedOutcome.outcomeType,
    beforeEvidenceRefs: beforeEvidence ? [beforeEvidence.evidenceRef] : [],
    afterEvidenceRefs: afterEvidence ? [afterEvidence.evidenceRef] : [],
    observationRefs: input.request.observationSet.observations.map((observation) => observation.ref),
    evidenceSourceRefs: [
      ...(beforeEvidence ? [beforeEvidence.source.sourceProofRef] : []),
      ...(afterEvidence ? [afterEvidence.source.sourceProofRef] : []),
      ...input.request.observationSet.observations.map((observation) => observation.source.sourceProofRef),
    ],
    inputRef: input.inputRef,
    outputRef: input.outputRef,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: Math.max(0, Math.round(input.endedMonotonicMs - input.startedMonotonicMs)),
    status: input.status,
    verificationDecision: input.verificationDecision,
    confidence: input.confidence,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    inputDecision: input.inputDecision,
    actionProofDecision: input.actionProofDecision,
    evidenceSourceDecision: input.evidenceSourceDecision,
    beforeAfterDecision: input.beforeAfterDecision,
    policyDecision: input.policyDecision,
    verificationDecisionTrace: input.verificationDecisionTrace,
    dataQualityFlags: input.dataQualityFlags,
    clock: {
      portKind: input.context.clock.portKind,
      startedMonotonicMs: input.startedMonotonicMs,
      endedMonotonicMs: input.endedMonotonicMs,
    },
  });
}
