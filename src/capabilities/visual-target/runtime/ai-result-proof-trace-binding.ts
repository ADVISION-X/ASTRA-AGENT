import type { ParsedVisualTargetAbilityInput, VisualTargetDataQualityFlag, VisualTargetFailureReason } from "../contract.js";

type AiProofBindingFailure = {
  ok: false;
  status: "failed";
  decision: "block";
  failureReason: VisualTargetFailureReason;
  statusMessage: string;
  reviewRequiredReason: null;
  aiInputHash: string | null;
  aiOutputPayloadHash: string | null;
  dataQualityFlags: VisualTargetDataQualityFlag[];
};

const buildAiProofBindingMismatchFailure = (input: {
  aiProof: NonNullable<ParsedVisualTargetAbilityInput["sourceProof"]["ai"]>;
  statusMessage: string;
}): AiProofBindingFailure => ({
  ok: false,
  status: "failed",
  decision: "block",
  failureReason: "ai_proof_binding_mismatch",
  statusMessage: input.statusMessage,
  reviewRequiredReason: null,
  aiInputHash: input.aiProof.aiInputHash,
  aiOutputPayloadHash: input.aiProof.outputPayloadHash,
  dataQualityFlags: ["candidate_source_binding_mismatch"],
});

const matchesRequestedBinding = (expected: string | null, actual: string | null): boolean => (
  expected === null || actual === expected
);

const hasSharedBindingConflict = (left: string | null, right: string | null): boolean => (
  left !== null && right !== null && left !== right
);

const resolveRequestTraceBindingFailure = (input: {
  request: ParsedVisualTargetAbilityInput;
  aiProof: NonNullable<ParsedVisualTargetAbilityInput["sourceProof"]["ai"]>;
}): AiProofBindingFailure | null => {
  if (input.aiProof.missionId !== input.request.missionId) {
    return buildAiProofBindingMismatchFailure({ aiProof: input.aiProof, statusMessage: "AI proof missionId must match the Visual Target request." });
  }
  if (input.aiProof.runId !== input.request.runId) {
    return buildAiProofBindingMismatchFailure({ aiProof: input.aiProof, statusMessage: "AI proof runId must match the Visual Target request." });
  }
  if (!matchesRequestedBinding(input.request.roundId, input.aiProof.roundId)) {
    return buildAiProofBindingMismatchFailure({ aiProof: input.aiProof, statusMessage: "AI proof roundId must match the Visual Target request." });
  }
  return !matchesRequestedBinding(input.request.videoVisitId, input.aiProof.videoVisitId)
    ? buildAiProofBindingMismatchFailure({ aiProof: input.aiProof, statusMessage: "AI proof videoVisitId must match the Visual Target request." })
    : null;
};

const resolveScreenshotTraceBindingFailure = (input: {
  screenshotProof: ParsedVisualTargetAbilityInput["sourceProof"]["screenshot"];
  aiProof: NonNullable<ParsedVisualTargetAbilityInput["sourceProof"]["ai"]>;
}): AiProofBindingFailure | null => {
  if (hasSharedBindingConflict(input.screenshotProof.roundId, input.aiProof.roundId)) {
    return buildAiProofBindingMismatchFailure({ aiProof: input.aiProof, statusMessage: "AI proof roundId must stay aligned with screenshot proof." });
  }
  if (hasSharedBindingConflict(input.screenshotProof.missionId, input.aiProof.missionId)) {
    return buildAiProofBindingMismatchFailure({ aiProof: input.aiProof, statusMessage: "AI proof missionId must stay aligned with screenshot proof." });
  }
  if (hasSharedBindingConflict(input.screenshotProof.runId, input.aiProof.runId)) {
    return buildAiProofBindingMismatchFailure({ aiProof: input.aiProof, statusMessage: "AI proof runId must stay aligned with screenshot proof." });
  }
  return hasSharedBindingConflict(input.screenshotProof.videoVisitId, input.aiProof.videoVisitId)
    ? buildAiProofBindingMismatchFailure({ aiProof: input.aiProof, statusMessage: "AI proof videoVisitId must stay aligned with screenshot proof." })
    : null;
};

export function createAiProofTraceBindingMismatchFailure(
  input: {
    request: ParsedVisualTargetAbilityInput;
  },
  aiProof: NonNullable<ParsedVisualTargetAbilityInput["sourceProof"]["ai"]>,
): AiProofBindingFailure | null {
  return resolveRequestTraceBindingFailure({ request: input.request, aiProof })
    ?? resolveScreenshotTraceBindingFailure({ screenshotProof: input.request.sourceProof.screenshot, aiProof });
}