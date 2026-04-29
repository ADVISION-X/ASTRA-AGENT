import type { VisualTargetAbilityContext, VisualTargetChildCapabilityId } from "../contract.js";
import { buildVisualTargetResult } from "./visual-target-result-builder.js";
import { coerceVisualTargetFailureSeed } from "./visual-target-input-gate.js";

export function dispatchVisualTargetFailure(input: {
  rawInput: unknown;
  context: VisualTargetAbilityContext;
  childCapabilityId?: VisualTargetChildCapabilityId;
  failureReason: "input_schema_invalid" | "unknown_child_capability" | "child_execution_failed";
  statusMessage: string;
}) {
  const seed = coerceVisualTargetFailureSeed(input.rawInput);
  const started = input.context.clock.now();
  const ended = input.context.clock.now();
  return buildVisualTargetResult({
    request: {
      abilityGroupId: "visual-target",
      childCapabilityId: input.childCapabilityId ?? seed.childCapabilityId,
      sessionId: seed.sessionId,
      roundId: seed.roundId,
      videoVisitId: seed.videoVisitId,
      requestedBy: "invalid-input",
      sourceAbilityGroupId: seed.sourceAbilityGroupId,
      sourceChildCapabilityId: seed.sourceChildCapabilityId,
      inputRef: seed.inputRef,
      targetType: seed.targetType,
      targetNature: seed.targetNature,
      sourceProof: {
        sourceProofRef: seed.sourceScreenshotProofRef,
        screenshot: {
          screenshotEvidenceId: seed.sourceScreenshotEvidenceId,
          artifactRef: seed.sourceScreenshotEvidenceId,
          screenshotProofRef: seed.sourceScreenshotProofRef,
          imageWidth: 1,
          imageHeight: 1,
          coordinateSpace: "browser_viewport",
          capturedAt: started.isoTimestamp,
          sessionId: seed.sessionId,
          roundId: seed.roundId,
          videoVisitId: seed.videoVisitId,
        },
        ai: seed.sourceAiResultRef && seed.sourceAiProofRef
          ? {
              aiResultRef: seed.sourceAiResultRef,
              aiProofRef: seed.sourceAiProofRef,
              promptContractId: "visual-target.dispatch.failure.v1",
              outputSchemaRef: "visual-target.dispatch.failure.schema.v1",
              capturedAt: started.isoTimestamp,
              sessionId: seed.sessionId,
              roundId: seed.roundId,
              videoVisitId: seed.videoVisitId,
              confidence: 0,
              modelRole: "dispatch-failure",
            }
          : null,
        pageState: {
          pageStateProofRef: seed.sourcePageStateProofRef,
          pageStateType: "unknown",
          pageStateFingerprint: "unknown|unknown|unknown",
          decision: "block",
          currentUrl: "about:blank",
          currentTitle: null,
          observedAt: started.isoTimestamp,
          sessionId: seed.sessionId,
          roundId: seed.roundId,
          videoVisitId: seed.videoVisitId,
        },
        operatorApproval: null,
      },
      candidates: [],
    },
    targetNature: seed.targetNature,
    status: "failed",
    failureReason: input.failureReason,
    reviewRequiredReason: null,
    statusMessage: input.statusMessage,
    selectedCandidate: null,
    rejectedCandidateRefs: [],
    startedAt: started.isoTimestamp,
    endedAt: ended.isoTimestamp,
    durationMs: Math.max(0, Math.round(ended.monotonicMs - started.monotonicMs)),
    decisions: {
      screenshotDecision: "block",
      aiDecision: "not_required",
      pageStateDecision: "block",
      candidateSourceDecision: "block",
      coordinateSpaceDecision: "block",
      targetTypeDecision: "block",
      selectionDecision: "no_candidate",
      ambiguityDecision: "block",
    },
    dataQualityFlags: ["dispatch_failure"],
    clock: { startedMonotonicMs: started.monotonicMs, endedMonotonicMs: ended.monotonicMs },
  });
}