import { POST_ACTION_VERIFICATION_ABILITY_GROUP_ID, type PostActionObservation } from "../../contract.js";
import { parsePostActionTimestampMs } from "../../runtime/verification-clock.js";
import type { PostActionVerificationChildCapability, PostActionVerificationRuntimeContext } from "../../runtime/post-action-verification-runtime-context.js";
import { VerifyVideoChangedAfterScrollOutputSchema } from "./schema.js";

function getObservationsByKind<K extends PostActionObservation["kind"]>(
  observations: PostActionObservation[],
  kind: K,
): Array<PostActionObservation & { kind: K; payload: Extract<PostActionObservation["payload"], { kind: K }> }> {
  return observations.filter(
    (observation): observation is PostActionObservation & { kind: K; payload: Extract<PostActionObservation["payload"], { kind: K }> } =>
      observation.kind === kind && observation.payload.kind === kind,
  );
}

function buildVideoChangedAfterScrollIncompleteResult(input: {
  observationRefs: string[];
  sourceProofRefs: string[];
}) {
  return VerifyVideoChangedAfterScrollOutputSchema.parse({
    observedOutcome: "video_identity_incomplete",
    verificationDecision: "review_required",
    confidence: 0,
    failureReason: "missing_before_after_evidence",
    reviewRequiredReason: "Video-change verification requires governed before and after identity observations.",
    statusMessage: "Before and after video identity observations are incomplete.",
    dataQualityFlags: ["video_identity_incomplete"],
    supportingEvidenceRefs: [],
    supportingObservationRefs: input.observationRefs,
    supportingSourceProofRefs: input.sourceProofRefs,
    verifiedByEvidenceKinds: ["video_identity"],
    confidenceSource: "video_identity_pair",
  });
}

function buildVideoChangedAfterScrollWindowConflictResult(input: {
  beforeRef: string;
  afterRef: string;
  beforeSourceProofRef: string;
  afterSourceProofRef: string;
}) {
  return VerifyVideoChangedAfterScrollOutputSchema.parse({
    observedOutcome: "video_identity_out_of_window",
    verificationDecision: "review_required",
    confidence: 0.2,
    failureReason: "before_after_conflict",
    reviewRequiredReason: "Video identity observations must straddle the scroll execution window.",
    statusMessage: "Video identity observation timing is not valid for governed scroll verification.",
    dataQualityFlags: ["before_after_conflict"],
    supportingEvidenceRefs: [],
    supportingObservationRefs: [input.beforeRef, input.afterRef],
    supportingSourceProofRefs: [input.beforeSourceProofRef, input.afterSourceProofRef],
    verifiedByEvidenceKinds: ["video_identity"],
    confidenceSource: "video_identity_pair",
  });
}

function buildVideoChangedAfterScrollUnknownResult(input: {
  beforeRef: string;
  afterRef: string;
  beforeSourceProofRef: string;
  afterSourceProofRef: string;
}) {
  return VerifyVideoChangedAfterScrollOutputSchema.parse({
    observedOutcome: "video_identity_unknown",
    verificationDecision: "review_required",
    confidence: 0,
    failureReason: "insufficient_evidence",
    reviewRequiredReason: "Video-change verification could not establish before/after identity.",
    statusMessage: "Video identity evidence is insufficient for scroll verification.",
    dataQualityFlags: ["video_identity_unknown"],
    supportingEvidenceRefs: [],
    supportingObservationRefs: [input.beforeRef, input.afterRef],
    supportingSourceProofRefs: [input.beforeSourceProofRef, input.afterSourceProofRef],
    verifiedByEvidenceKinds: ["video_identity"],
    confidenceSource: "video_identity_pair",
  });
}

function buildVideoChangedAfterScrollUnconfirmedResult(input: {
  beforeRef: string;
  afterRef: string;
  beforeSourceProofRef: string;
  afterSourceProofRef: string;
  afterEvidenceRef: string | null;
}) {
  return VerifyVideoChangedAfterScrollOutputSchema.parse({
    observedOutcome: "video_change_unconfirmed",
    verificationDecision: "review_required",
    confidence: 0.35,
    failureReason: "conflicting_observation",
    reviewRequiredReason: "A new video appeared, but the after observation could not confirm the feed settled on it.",
    statusMessage: "Video-change verification requires a confirmed post-scroll landing state.",
    dataQualityFlags: ["after_unconfirmed"],
    supportingEvidenceRefs: input.afterEvidenceRef ? [input.afterEvidenceRef] : [],
    supportingObservationRefs: [input.beforeRef, input.afterRef],
    supportingSourceProofRefs: [input.beforeSourceProofRef, input.afterSourceProofRef],
    verifiedByEvidenceKinds: ["video_identity"],
    confidenceSource: "video_identity_pair",
  });
}

function buildVideoChangedAfterScrollResult(input: {
  changed: boolean;
  beforeRef: string;
  afterRef: string;
  beforeSourceProofRef: string;
  afterSourceProofRef: string;
  beforeEvidenceRef: string | null;
  afterEvidenceRef: string | null;
}) {
  return VerifyVideoChangedAfterScrollOutputSchema.parse({
    observedOutcome: input.changed ? "video_changed" : "video_unchanged",
    verificationDecision: input.changed ? "verified" : "failed",
    confidence: input.changed ? 0.97 : 0.93,
    failureReason: input.changed ? null : "unexpected_state",
    reviewRequiredReason: null,
    statusMessage: input.changed ? "Feed advanced to a different video." : "Feed remained on the same video after scroll.",
    dataQualityFlags: [],
    supportingEvidenceRefs: [input.beforeEvidenceRef, input.afterEvidenceRef].filter((value): value is string => value !== null),
    supportingObservationRefs: [input.beforeRef, input.afterRef],
    supportingSourceProofRefs: [input.beforeSourceProofRef, input.afterSourceProofRef],
    verifiedByEvidenceKinds: ["video_identity"],
    confidenceSource: "video_identity_pair",
  });
}

function resolveVideoChangedAfterScrollObservationPair(input: {
  observations: PostActionObservation[];
}) {
  const videoIdentityObservations = getObservationsByKind(input.observations, "video_identity");
  const beforeObservation = videoIdentityObservations.find((observation) => observation.payload.role === "before") ?? null;
  const afterObservation = videoIdentityObservations.find((observation) => observation.payload.role === "after") ?? null;
  if (beforeObservation === null || afterObservation === null) {
    return {
      ok: false as const,
      result: buildVideoChangedAfterScrollIncompleteResult({
        observationRefs: videoIdentityObservations.map((observation) => observation.ref),
        sourceProofRefs: videoIdentityObservations.map((observation) => observation.source.sourceProofRef),
      }),
    };
  }

  return {
    ok: true as const,
    beforeObservation,
    afterObservation,
  };
}

function resolveVideoChangedAfterScrollOutcome(input: {
  beforeObservation: NonNullable<ReturnType<typeof resolveVideoChangedAfterScrollObservationPair>["beforeObservation"]>;
  afterObservation: NonNullable<ReturnType<typeof resolveVideoChangedAfterScrollObservationPair>["afterObservation"]>;
  actionStartedAtMs: number;
  actionEndedAtMs: number;
  beforeEvidenceRef: string | null;
  afterEvidenceRef: string | null;
}) {
  if (
    parsePostActionTimestampMs(input.beforeObservation.capturedAt) >= input.actionStartedAtMs ||
    parsePostActionTimestampMs(input.afterObservation.capturedAt) <= input.actionEndedAtMs
  ) {
    return buildVideoChangedAfterScrollWindowConflictResult({
      beforeRef: input.beforeObservation.ref,
      afterRef: input.afterObservation.ref,
      beforeSourceProofRef: input.beforeObservation.source.sourceProofRef,
      afterSourceProofRef: input.afterObservation.source.sourceProofRef,
    });
  }

  const beforeVideoId = input.beforeObservation.payload.videoId;
  const afterVideoId = input.afterObservation.payload.videoId;
  const beforeSignature = input.beforeObservation.payload.visualSignature;
  const afterSignature = input.afterObservation.payload.visualSignature;
  const changed =
    beforeVideoId !== null && afterVideoId !== null
      ? beforeVideoId !== afterVideoId
      : beforeSignature !== null && afterSignature !== null
        ? beforeSignature !== afterSignature
        : null;

  if (changed === null) {
    return buildVideoChangedAfterScrollUnknownResult({
      beforeRef: input.beforeObservation.ref,
      afterRef: input.afterObservation.ref,
      beforeSourceProofRef: input.beforeObservation.source.sourceProofRef,
      afterSourceProofRef: input.afterObservation.source.sourceProofRef,
    });
  }

  if (changed && input.afterObservation.payload.confirmed === false) {
    return buildVideoChangedAfterScrollUnconfirmedResult({
      beforeRef: input.beforeObservation.ref,
      afterRef: input.afterObservation.ref,
      beforeSourceProofRef: input.beforeObservation.source.sourceProofRef,
      afterSourceProofRef: input.afterObservation.source.sourceProofRef,
      afterEvidenceRef: input.afterEvidenceRef,
    });
  }

  return buildVideoChangedAfterScrollResult({
    changed,
    beforeRef: input.beforeObservation.ref,
    afterRef: input.afterObservation.ref,
    beforeSourceProofRef: input.beforeObservation.source.sourceProofRef,
    afterSourceProofRef: input.afterObservation.source.sourceProofRef,
    beforeEvidenceRef: input.beforeEvidenceRef,
    afterEvidenceRef: input.afterEvidenceRef,
  });
}

function resolveVideoChangedAfterScrollResult(input: {
  observations: PostActionObservation[];
  actionStartedAtMs: number;
  actionEndedAtMs: number;
  beforeEvidenceRef: string | null;
  afterEvidenceRef: string | null;
}) {
  const observationPair = resolveVideoChangedAfterScrollObservationPair({ observations: input.observations });
  if (!observationPair.ok) {
    return observationPair.result;
  }

  return resolveVideoChangedAfterScrollOutcome({
    beforeObservation: observationPair.beforeObservation,
    afterObservation: observationPair.afterObservation,
    actionStartedAtMs: input.actionStartedAtMs,
    actionEndedAtMs: input.actionEndedAtMs,
    beforeEvidenceRef: input.beforeEvidenceRef,
    afterEvidenceRef: input.afterEvidenceRef,
  });
}

export function createVerifyVideoChangedAfterScrollCapability(): PostActionVerificationChildCapability {
  return {
    abilityGroupId: POST_ACTION_VERIFICATION_ABILITY_GROUP_ID,
    childCapabilityId: "verify-video-changed-after-scroll" as const,
    async execute(input, context: PostActionVerificationRuntimeContext) {
      return resolveVideoChangedAfterScrollResult({
        observations: context.evidenceReadPort.listObservations(input),
        actionStartedAtMs: parsePostActionTimestampMs(input.actionProof.startedAt),
        actionEndedAtMs: parsePostActionTimestampMs(input.actionProof.endedAt),
        beforeEvidenceRef: input.beforeAfterEvidence.beforeEvidence?.evidenceRef ?? null,
        afterEvidenceRef: input.beforeAfterEvidence.afterEvidence?.evidenceRef ?? null,
      });
    },
  };
}