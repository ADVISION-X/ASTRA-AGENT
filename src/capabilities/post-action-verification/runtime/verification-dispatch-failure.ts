import { createId } from "../../../lib/local-runtime/ids.js";
import { POST_ACTION_VERIFICATION_ABILITY_GROUP_ID, POST_ACTION_VERIFICATION_CHILD_CAPABILITY_IDS } from "../shared/post-action-types.js";
import { buildPostActionRuntimeProof } from "./verification-proof-builder.js";
import { buildPostActionVerificationResult } from "./verification-result-builder.js";
import type { PostActionFailureReason, PostActionVerificationAbilityContext, PostActionVerificationAbilityInput, ParsedPostActionVerificationAbilityInput } from "../contract.js";

function toFallbackRequest(rawInput: PostActionVerificationAbilityInput, context: PostActionVerificationAbilityContext): ParsedPostActionVerificationAbilityInput {
  const childCapabilityId = POST_ACTION_VERIFICATION_CHILD_CAPABILITY_IDS.includes(rawInput.childCapabilityId)
    ? rawInput.childCapabilityId
    : "verify-page-opened";
  const now = context.clock.now().isoTimestamp;

  return {
    abilityGroupId: POST_ACTION_VERIFICATION_ABILITY_GROUP_ID,
    childCapabilityId,
    requestedBy: rawInput.requestedBy ?? "unknown",
    sessionId: rawInput.sessionId ?? "unknown-session",
    roundId: rawInput.roundId ?? null,
    videoVisitId: rawInput.videoVisitId ?? null,
    expectedOutcome: {
      outcomeType: rawInput.expectedOutcome?.outcomeType ?? "page_opened",
      description: rawInput.expectedOutcome?.description ?? "fallback post-action verification expectation",
      expectedUrlHost: rawInput.expectedOutcome?.expectedUrlHost ?? null,
      expectedUrlPrefix: rawInput.expectedOutcome?.expectedUrlPrefix ?? null,
      expectedState: rawInput.expectedOutcome?.expectedState ?? null,
      expectedTargetType: rawInput.expectedOutcome?.expectedTargetType ?? null,
      requiresBeforeAfterComparison: rawInput.expectedOutcome?.requiresBeforeAfterComparison ?? false,
      requiresVisualEvidence: rawInput.expectedOutcome?.requiresVisualEvidence ?? false,
    },
    actionProof: {
      actionProofRef: rawInput.actionProof?.actionProofRef ?? createId("missing_action_proof"),
      sourceAbilityGroupId: rawInput.actionProof?.sourceAbilityGroupId ?? "open",
      sourceChildCapabilityId: rawInput.actionProof?.sourceChildCapabilityId ?? "open-local-workbench",
      actionType: rawInput.actionProof?.actionType ?? "unknown",
      actionStatus: rawInput.actionProof?.actionStatus ?? "blocked",
      primitiveExecutionRef: rawInput.actionProof?.primitiveExecutionRef ?? null,
      navigationAttemptRef: rawInput.actionProof?.navigationAttemptRef ?? null,
      scrollExecutionRef: rawInput.actionProof?.scrollExecutionRef ?? null,
      sessionId: rawInput.actionProof?.sessionId ?? rawInput.sessionId ?? "unknown-session",
      roundId: rawInput.actionProof?.roundId ?? rawInput.roundId ?? null,
      videoVisitId: rawInput.actionProof?.videoVisitId ?? rawInput.videoVisitId ?? null,
      startedAt: rawInput.actionProof?.startedAt ?? now,
      endedAt: rawInput.actionProof?.endedAt ?? now,
      selfReportedOnly: rawInput.actionProof?.selfReportedOnly ?? false,
    },
    beforeAfterEvidence: {
      beforeEvidence: rawInput.beforeAfterEvidence?.beforeEvidence
        ? {
          evidenceRef: rawInput.beforeAfterEvidence.beforeEvidence.evidenceRef,
          evidenceKind: rawInput.beforeAfterEvidence.beforeEvidence.evidenceKind,
          source: rawInput.beforeAfterEvidence.beforeEvidence.source,
          capturedAt: rawInput.beforeAfterEvidence.beforeEvidence.capturedAt,
          sessionId: rawInput.beforeAfterEvidence.beforeEvidence.sessionId,
          roundId: rawInput.beforeAfterEvidence.beforeEvidence.roundId ?? null,
          videoVisitId: rawInput.beforeAfterEvidence.beforeEvidence.videoVisitId ?? null,
        }
        : null,
      afterEvidence: rawInput.beforeAfterEvidence?.afterEvidence
        ? {
          evidenceRef: rawInput.beforeAfterEvidence.afterEvidence.evidenceRef,
          evidenceKind: rawInput.beforeAfterEvidence.afterEvidence.evidenceKind,
          source: rawInput.beforeAfterEvidence.afterEvidence.source,
          capturedAt: rawInput.beforeAfterEvidence.afterEvidence.capturedAt,
          sessionId: rawInput.beforeAfterEvidence.afterEvidence.sessionId,
          roundId: rawInput.beforeAfterEvidence.afterEvidence.roundId ?? null,
          videoVisitId: rawInput.beforeAfterEvidence.afterEvidence.videoVisitId ?? null,
        }
        : null,
    },
    observationSet: {
      observations: [],
    },
    verificationPolicy: {
      verificationMode: rawInput.verificationPolicy?.verificationMode ?? "observation_only",
      requireAfterEvidence: rawInput.verificationPolicy?.requireAfterEvidence ?? false,
      requireBeforeAfterComparison: rawInput.verificationPolicy?.requireBeforeAfterComparison ?? false,
      allowSelfReportedSuccess: rawInput.verificationPolicy?.allowSelfReportedSuccess ?? false,
    },
    confidencePolicy: {
      minimumConfidence: rawInput.confidencePolicy?.minimumConfidence ?? 0.8,
      allowReviewRequired: rawInput.confidencePolicy?.allowReviewRequired ?? true,
    },
    inputRef: rawInput.inputRef ?? createId("post_action_verification_input"),
  };
}

export function dispatchPostActionVerificationFailure(input: {
  rawInput: PostActionVerificationAbilityInput;
  context: PostActionVerificationAbilityContext;
  childCapabilityId?: ParsedPostActionVerificationAbilityInput["childCapabilityId"];
  status?: "failed" | "review_required" | "blocked";
  failureReason: PostActionFailureReason;
  reviewRequiredReason?: string | null;
  statusMessage: string;
}) {
  const request = toFallbackRequest(input.rawInput, input.context);
  const started = input.context.clock.now();
  const ended = input.context.clock.now();
  const status = input.status ?? "failed";
  const verificationDecision = status === "blocked" ? "blocked" : status === "review_required" ? "review_required" : "failed";
  const runtimeProof = buildPostActionRuntimeProof({
    request: {
      ...request,
      childCapabilityId: input.childCapabilityId ?? request.childCapabilityId,
    },
    context: input.context,
    startedAt: started.isoTimestamp,
    endedAt: ended.isoTimestamp,
    startedMonotonicMs: started.monotonicMs,
    endedMonotonicMs: ended.monotonicMs,
    status,
    verificationDecision,
    confidence: 0,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason ?? null,
    inputDecision: "dispatch_failure",
    actionProofDecision: "dispatch_failure",
    evidenceSourceDecision: "dispatch_failure",
    beforeAfterDecision: "dispatch_failure",
    policyDecision: "dispatch_failure",
    verificationDecisionTrace: "dispatch_failure",
    dataQualityFlags: ["dispatch_failure"],
    inputRef: request.inputRef,
    outputRef: createId("post_action_verification_output"),
  });

  return buildPostActionVerificationResult({
    request: {
      ...request,
      childCapabilityId: input.childCapabilityId ?? request.childCapabilityId,
    },
    observedOutcome: "dispatch_failure",
    confidence: 0,
    status,
    verificationDecision,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason ?? null,
    statusMessage: input.statusMessage,
    runtimeProof,
    startedAt: started.isoTimestamp,
    endedAt: ended.isoTimestamp,
    startedMonotonicMs: started.monotonicMs,
    endedMonotonicMs: ended.monotonicMs,
    dataQualityFlags: ["dispatch_failure"],
  });
}
