import { createHash } from "node:crypto";

import { PostActionRuntimeProofSchema } from "../schema.js";
import type { PostActionRuntimeProof, ParsedPostActionVerificationAbilityInput } from "../contract.js";
import type { PostActionVerificationRuntimeContext } from "./post-action-verification-runtime-context.js";
function buildPostActionRuntimeProofHashes(input: {
  request: ParsedPostActionVerificationAbilityInput | null;
  inputRef: string;
  status: PostActionRuntimeProof["status"];
  verificationDecision: PostActionRuntimeProof["verificationDecision"];
  startedAt: string;
  endedAt: string;
}) {
  const request = input.request;
  const beforeEvidence = request?.beforeAfterEvidence.beforeEvidence ?? null;
  const afterEvidence = request?.beforeAfterEvidence.afterEvidence ?? null;
  const inputPayloadHash = createHash("sha256").update(JSON.stringify(request ?? { inputRef: input.inputRef, status: input.status })).digest("hex");
  const actionProofHash = request?.actionProof ? createHash("sha256").update(JSON.stringify(request.actionProof)).digest("hex") : null;
  const expectedOutcomeHash = request?.expectedOutcome ? createHash("sha256").update(JSON.stringify(request.expectedOutcome)).digest("hex") : null;
  const beforeEvidenceHash = beforeEvidence ? createHash("sha256").update(JSON.stringify(beforeEvidence)).digest("hex") : null;
  const afterEvidenceHash = afterEvidence ? createHash("sha256").update(JSON.stringify(afterEvidence)).digest("hex") : null;
  const observationSetHash = createHash("sha256").update(JSON.stringify(request?.observationSet.observations ?? [])).digest("hex");
  const proofFingerprint = createHash("sha256").update([input.inputRef, request?.childCapabilityId ?? "invalid-input", input.startedAt, input.endedAt, input.status, input.verificationDecision].join("|")).digest("hex").slice(0, 24);

  return {
    proofFingerprint,
    inputPayloadHash,
    actionProofHash,
    expectedOutcomeHash,
    beforeEvidenceHash,
    afterEvidenceHash,
    observationSetHash,
  };
}

function buildPostActionRuntimeProofIdentityFields(input: {
  request: ParsedPostActionVerificationAbilityInput | null;
  proofFingerprint: string;
  inputRef: string;
}) {
  const request = input.request;
  return {
    proofId: `post-action-verification-proof:${input.proofFingerprint}`,
    missionId: request?.missionId ?? null,
    runId: request?.runId ?? input.inputRef,
    sessionId: request?.sessionId ?? null,
    roundId: request?.roundId ?? null, videoVisitId: request?.videoVisitId ?? null,
    stepId: request?.stepId ?? null,
    mapPackageId: request?.mapPackageId ?? null, mapPackageVersion: request?.mapPackageVersion ?? null,
    selectedMapId: request?.selectedMapId ?? null, selectedMapVersion: request?.selectedMapVersion ?? null,
    activationSnapshotRef: request?.activationSnapshotRef ?? null, capabilityCallId: request?.capabilityCallId ?? null, nerveBusEnvelopeId: request?.nerveBusEnvelopeId ?? null,
    abilityGroupId: request?.abilityGroupId ?? "post-action-verification",
    childCapabilityId: request?.childCapabilityId ?? null,
  };
}

function buildPostActionRuntimeProofReferenceFields(input: {
  request: ParsedPostActionVerificationAbilityInput | null;
  inputRef: string;
  outputRef: string | null;
  diagnosticPayloadRef: string | null;
  inputPayloadHash: string;
  actionProofHash: string | null;
  expectedOutcomeHash: string | null;
  beforeEvidenceHash: string | null;
  afterEvidenceHash: string | null;
  observationSetHash: string;
  proofFingerprint: string;
}) {
  const request = input.request;
  const beforeEvidence = request?.beforeAfterEvidence.beforeEvidence ?? null;
  const afterEvidence = request?.beforeAfterEvidence.afterEvidence ?? null;
  return {
    actionProofRef: request?.actionProof.actionProofRef ?? null,
    actionLogRef: request?.actionProof.actionLogRef ?? request?.actionProof.actionRecordRef ?? null,
    sourceActionRuntimeProofRef: request?.actionProof.sourceRuntimeProofRef ?? null,
    sourceActionResultRef: request?.actionProof.sourceActionResultRef ?? null,
    sourceActionOutputRef: request?.actionProof.sourceActionOutputRef ?? null,
    sourceActionAbilityGroupId: request?.actionProof.sourceAbilityGroupId ?? null,
    sourceActionChildCapabilityId: request?.actionProof.sourceChildCapabilityId ?? null,
    actionType: request?.actionProof.actionType ?? null,
    actionStatus: request?.actionProof.actionStatus ?? null,
    expectedOutcomeType: request?.expectedOutcome.outcomeType ?? null,
    beforeEvidenceRefs: beforeEvidence ? [beforeEvidence.evidenceRef] : [],
    afterEvidenceRefs: afterEvidence ? [afterEvidence.evidenceRef] : [],
    observationRefs: request?.observationSet.observations.map((observation) => observation.ref) ?? [],
    evidenceSourceRefs: [
      ...(beforeEvidence ? [beforeEvidence.source.sourceProofRef] : []),
      ...(afterEvidence ? [afterEvidence.source.sourceProofRef] : []),
      ...(request?.observationSet.observations.map((observation) => observation.source.sourceProofRef) ?? []),
    ],
    inputRef: input.inputRef,
    outputRef: input.outputRef,
    diagnosticPayloadRef: input.diagnosticPayloadRef,
    debugLogRef: `post-action-verification:debug:${input.proofFingerprint}`,
    structuredRuntimeEventRef: null,
    inputPayloadHash: input.inputPayloadHash,
    actionProofHash: input.actionProofHash,
    expectedOutcomeHash: input.expectedOutcomeHash,
    beforeEvidenceHash: input.beforeEvidenceHash,
    afterEvidenceHash: input.afterEvidenceHash,
    observationSetHash: input.observationSetHash,
    receivedShapeHash: null,
  };
}

function buildPostActionRuntimeProofDecisionFields(input: {
  context: PostActionVerificationRuntimeContext;
  startedAt: string;
  endedAt: string;
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
  outputBoundaryDecision: string;
  criticalDataQualityDecision: string;
  observationBindingDecision: string;
  beforeAfterPairDecision: string;
  verificationDecisionTrace: string[];
  dataQualityFlags: string[];
  startedMonotonicMs: number;
  endedMonotonicMs: number;
}) {
  return {
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
    outputBoundaryDecision: input.outputBoundaryDecision,
    criticalDataQualityDecision: input.criticalDataQualityDecision,
    observationBindingDecision: input.observationBindingDecision,
    beforeAfterPairDecision: input.beforeAfterPairDecision,
    verificationDecisionTrace: input.verificationDecisionTrace,
    dataQualityFlags: input.dataQualityFlags,
    clock: {
      portKind: input.context.clock.portKind,
      startedMonotonicMs: input.startedMonotonicMs,
      endedMonotonicMs: input.endedMonotonicMs,
    },
  };
}

function buildPostActionRuntimeProofCoreFields(input: {
  request: ParsedPostActionVerificationAbilityInput | null;
  inputRef: string;
  outputRef: string | null;
  diagnosticPayloadRef: string | null;
  proofFingerprint: string;
  inputPayloadHash: string;
  actionProofHash: string | null;
  expectedOutcomeHash: string | null;
  beforeEvidenceHash: string | null;
  afterEvidenceHash: string | null;
  observationSetHash: string;
  startedAt: string;
  endedAt: string;
  status: PostActionRuntimeProof["status"];
  verificationDecision: PostActionRuntimeProof["verificationDecision"];
  confidence: number;
  failureReason: string | null;
  reviewRequiredReason: string | null;
  dataQualityFlags: string[];
  inputDecision: string;
  actionProofDecision: string;
  evidenceSourceDecision: string;
  beforeAfterDecision: string;
  policyDecision: string;
  outputBoundaryDecision: string;
  criticalDataQualityDecision: string;
  observationBindingDecision: string;
  beforeAfterPairDecision: string;
  verificationDecisionTrace: string[];
  context: PostActionVerificationRuntimeContext;
  startedMonotonicMs: number;
  endedMonotonicMs: number;
}) {
  return {
    ...buildPostActionRuntimeProofIdentityFields({ request: input.request, proofFingerprint: input.proofFingerprint, inputRef: input.inputRef }),
    ...buildPostActionRuntimeProofReferenceFields({
      request: input.request,
      inputRef: input.inputRef,
      outputRef: input.outputRef,
      diagnosticPayloadRef: input.diagnosticPayloadRef,
      inputPayloadHash: input.inputPayloadHash,
      actionProofHash: input.actionProofHash,
      expectedOutcomeHash: input.expectedOutcomeHash,
      beforeEvidenceHash: input.beforeEvidenceHash,
      afterEvidenceHash: input.afterEvidenceHash,
      observationSetHash: input.observationSetHash,
      proofFingerprint: input.proofFingerprint,
    }),
    ...buildPostActionRuntimeProofDecisionFields({
      context: input.context,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
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
      outputBoundaryDecision: input.outputBoundaryDecision,
      criticalDataQualityDecision: input.criticalDataQualityDecision,
      observationBindingDecision: input.observationBindingDecision,
      beforeAfterPairDecision: input.beforeAfterPairDecision,
      verificationDecisionTrace: input.verificationDecisionTrace,
      dataQualityFlags: input.dataQualityFlags,
      startedMonotonicMs: input.startedMonotonicMs,
      endedMonotonicMs: input.endedMonotonicMs,
    }),
  };
}

export function buildPostActionRuntimeProof(input: {
  request: ParsedPostActionVerificationAbilityInput | null;
  context: PostActionVerificationRuntimeContext;
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
  outputBoundaryDecision: string;
  criticalDataQualityDecision: string;
  observationBindingDecision: string;
  beforeAfterPairDecision: string;
  verificationDecisionTrace: string[];
  dataQualityFlags: string[];
  inputRef: string;
  outputRef: string | null;
  diagnosticPayloadRef: string | null;
  receivedShapeHash?: string | null;
}): PostActionRuntimeProof {
  const hashes = buildPostActionRuntimeProofHashes({ request: input.request, inputRef: input.inputRef, status: input.status, verificationDecision: input.verificationDecision, startedAt: input.startedAt, endedAt: input.endedAt });
  return PostActionRuntimeProofSchema.parse({
    ...buildPostActionRuntimeProofCoreFields({
      request: input.request,
      inputRef: input.inputRef,
      outputRef: input.outputRef,
      diagnosticPayloadRef: input.diagnosticPayloadRef,
      proofFingerprint: hashes.proofFingerprint,
      inputPayloadHash: hashes.inputPayloadHash,
      actionProofHash: hashes.actionProofHash,
      expectedOutcomeHash: hashes.expectedOutcomeHash,
      beforeEvidenceHash: hashes.beforeEvidenceHash,
      afterEvidenceHash: hashes.afterEvidenceHash,
      observationSetHash: hashes.observationSetHash,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      status: input.status,
      verificationDecision: input.verificationDecision,
      confidence: input.confidence,
      failureReason: input.failureReason,
      reviewRequiredReason: input.reviewRequiredReason,
      dataQualityFlags: input.dataQualityFlags,
      inputDecision: input.inputDecision,
      actionProofDecision: input.actionProofDecision,
      evidenceSourceDecision: input.evidenceSourceDecision,
      beforeAfterDecision: input.beforeAfterDecision,
      policyDecision: input.policyDecision,
      outputBoundaryDecision: input.outputBoundaryDecision,
      criticalDataQualityDecision: input.criticalDataQualityDecision,
      observationBindingDecision: input.observationBindingDecision,
      beforeAfterPairDecision: input.beforeAfterPairDecision,
      verificationDecisionTrace: input.verificationDecisionTrace,
      context: input.context,
      startedMonotonicMs: input.startedMonotonicMs,
      endedMonotonicMs: input.endedMonotonicMs,
    }),
    receivedShapeHash: input.receivedShapeHash ?? null,
  });
}
