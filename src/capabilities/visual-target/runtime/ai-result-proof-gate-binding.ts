import type { ParsedVisualTargetAbilityInput, VisualTargetDataQualityFlag, VisualTargetFailureReason } from "../contract.js";

function matchesRequestedBinding(expected: string | null, actual: string | null): boolean {
  return expected === null || actual === expected;
}

function hasSharedBindingConflict(left: string | null, right: string | null): boolean {
  return left !== null && right !== null && left !== right;
}

export function createAiProofBindingFailure(
  input: {
    request: ParsedVisualTargetAbilityInput;
  },
  aiProof: NonNullable<ParsedVisualTargetAbilityInput["sourceProof"]["ai"]> | null,
):
  | {
      ok: false;
      status: "failed";
      decision: "block";
      failureReason: VisualTargetFailureReason;
      statusMessage: string;
      reviewRequiredReason: null;
      aiInputHash: string | null;
      aiOutputPayloadHash: string | null;
      dataQualityFlags: VisualTargetDataQualityFlag[];
    }
  | null {
  if (!aiProof) {
    return null;
  }

  const sourceBindingFailure = createAiProofSourceBindingMismatchFailure(input, aiProof);
  if (sourceBindingFailure) {
    return sourceBindingFailure;
  }

  const artifactFailure = createAiProofArtifactBindingFailure(aiProof);
  if (artifactFailure) {
    return artifactFailure;
  }

  const sessionFailure = createAiProofSessionMismatchFailure(input, aiProof);
  if (sessionFailure) {
    return sessionFailure;
  }

  return createAiProofTraceBindingMismatchFailure(input, aiProof);
}

function createAiProofSourceBindingMismatchFailure(
  input: {
    request: ParsedVisualTargetAbilityInput;
  },
  aiProof: NonNullable<ParsedVisualTargetAbilityInput["sourceProof"]["ai"]>,
):
  | {
      ok: false;
      status: "failed";
      decision: "block";
      failureReason: VisualTargetFailureReason;
      statusMessage: string;
      reviewRequiredReason: null;
      aiInputHash: string | null;
      aiOutputPayloadHash: string | null;
      dataQualityFlags: VisualTargetDataQualityFlag[];
    }
  | null {
  if (
    aiProof.sourceScreenshotEvidenceId === input.request.sourceProof.screenshot.screenshotEvidenceId
    && aiProof.sourceScreenshotProofRef === input.request.sourceProof.screenshot.screenshotProofRef
    && aiProof.sourceImageHash === input.request.sourceProof.screenshot.imageHash
  ) {
    return null;
  }

  return {
    ok: false,
    status: "failed",
    decision: "block",
    failureReason: "ai_proof_binding_mismatch",
    statusMessage: "AI proof must bind back to the same screenshot proof and image hash.",
    reviewRequiredReason: null,
    aiInputHash: aiProof.aiInputHash,
    aiOutputPayloadHash: aiProof.outputPayloadHash,
    dataQualityFlags: ["candidate_source_binding_mismatch"],
  };
}

function createAiProofArtifactBindingFailure(
  aiProof: NonNullable<ParsedVisualTargetAbilityInput["sourceProof"]["ai"]>,
):
  | {
      ok: false;
      status: "failed";
      decision: "block";
      failureReason: VisualTargetFailureReason;
      statusMessage: string;
      reviewRequiredReason: null;
      aiInputHash: string | null;
      aiOutputPayloadHash: string | null;
      dataQualityFlags: VisualTargetDataQualityFlag[];
    }
  | null {
  if (aiProof.aiInputArtifactRef && aiProof.aiInputHash && aiProof.outputPayloadHash) {
    return null;
  }

  return {
    ok: false,
    status: "failed",
    decision: "block",
    failureReason: "ai_artifact_binding_missing",
    statusMessage: "AI proof must carry input artifact and payload hashes.",
    reviewRequiredReason: null,
    aiInputHash: aiProof.aiInputHash,
    aiOutputPayloadHash: aiProof.outputPayloadHash,
    dataQualityFlags: ["candidate_source_binding_mismatch"],
  };
}

function createAiProofSessionMismatchFailure(
  input: {
    request: ParsedVisualTargetAbilityInput;
  },
  aiProof: NonNullable<ParsedVisualTargetAbilityInput["sourceProof"]["ai"]>,
):
  | {
      ok: false;
      status: "failed";
      decision: "block";
      failureReason: VisualTargetFailureReason;
      statusMessage: string;
      reviewRequiredReason: null;
      aiInputHash: string | null;
      aiOutputPayloadHash: string | null;
      dataQualityFlags: VisualTargetDataQualityFlag[];
    }
  | null {
  if (aiProof.sessionId === input.request.sessionId) {
    return null;
  }

  return {
    ok: false,
    status: "failed",
    decision: "block",
    failureReason: "ai_proof_binding_mismatch",
    statusMessage: "AI proof session binding must match the Visual Target request.",
    reviewRequiredReason: null,
    aiInputHash: aiProof.aiInputHash,
    aiOutputPayloadHash: aiProof.outputPayloadHash,
    dataQualityFlags: ["candidate_source_binding_mismatch"],
  };
}

function createAiProofTraceBindingMismatchFailure(
  input: {
    request: ParsedVisualTargetAbilityInput;
  },
  aiProof: NonNullable<ParsedVisualTargetAbilityInput["sourceProof"]["ai"]>,
):
  | {
      ok: false;
      status: "failed";
      decision: "block";
      failureReason: VisualTargetFailureReason;
      statusMessage: string;
      reviewRequiredReason: null;
      aiInputHash: string | null;
      aiOutputPayloadHash: string | null;
      dataQualityFlags: VisualTargetDataQualityFlag[];
    }
  | null {
  const screenshotProof = input.request.sourceProof.screenshot;
  if (aiProof.missionId !== input.request.missionId) {
    return {
      ok: false,
      status: "failed",
      decision: "block",
      failureReason: "ai_proof_binding_mismatch",
      statusMessage: "AI proof missionId must match the Visual Target request.",
      reviewRequiredReason: null,
      aiInputHash: aiProof.aiInputHash,
      aiOutputPayloadHash: aiProof.outputPayloadHash,
      dataQualityFlags: ["candidate_source_binding_mismatch"],
    };
  }
  if (aiProof.runId !== input.request.runId) {
    return {
      ok: false,
      status: "failed",
      decision: "block",
      failureReason: "ai_proof_binding_mismatch",
      statusMessage: "AI proof runId must match the Visual Target request.",
      reviewRequiredReason: null,
      aiInputHash: aiProof.aiInputHash,
      aiOutputPayloadHash: aiProof.outputPayloadHash,
      dataQualityFlags: ["candidate_source_binding_mismatch"],
    };
  }
  if (!matchesRequestedBinding(input.request.roundId, aiProof.roundId)) {
    return {
      ok: false,
      status: "failed",
      decision: "block",
      failureReason: "ai_proof_binding_mismatch",
      statusMessage: "AI proof roundId must match the Visual Target request.",
      reviewRequiredReason: null,
      aiInputHash: aiProof.aiInputHash,
      aiOutputPayloadHash: aiProof.outputPayloadHash,
      dataQualityFlags: ["candidate_source_binding_mismatch"],
    };
  }
  if (!matchesRequestedBinding(input.request.videoVisitId, aiProof.videoVisitId)) {
    return {
      ok: false,
      status: "failed",
      decision: "block",
      failureReason: "ai_proof_binding_mismatch",
      statusMessage: "AI proof videoVisitId must match the Visual Target request.",
      reviewRequiredReason: null,
      aiInputHash: aiProof.aiInputHash,
      aiOutputPayloadHash: aiProof.outputPayloadHash,
      dataQualityFlags: ["candidate_source_binding_mismatch"],
    };
  }
  if (hasSharedBindingConflict(screenshotProof.roundId, aiProof.roundId)) {
    return {
      ok: false,
      status: "failed",
      decision: "block",
      failureReason: "ai_proof_binding_mismatch",
      statusMessage: "AI proof roundId must stay aligned with screenshot proof.",
      reviewRequiredReason: null,
      aiInputHash: aiProof.aiInputHash,
      aiOutputPayloadHash: aiProof.outputPayloadHash,
      dataQualityFlags: ["candidate_source_binding_mismatch"],
    };
  }
  if (hasSharedBindingConflict(screenshotProof.missionId, aiProof.missionId)) {
    return {
      ok: false,
      status: "failed",
      decision: "block",
      failureReason: "ai_proof_binding_mismatch",
      statusMessage: "AI proof missionId must stay aligned with screenshot proof.",
      reviewRequiredReason: null,
      aiInputHash: aiProof.aiInputHash,
      aiOutputPayloadHash: aiProof.outputPayloadHash,
      dataQualityFlags: ["candidate_source_binding_mismatch"],
    };
  }
  if (hasSharedBindingConflict(screenshotProof.runId, aiProof.runId)) {
    return {
      ok: false,
      status: "failed",
      decision: "block",
      failureReason: "ai_proof_binding_mismatch",
      statusMessage: "AI proof runId must stay aligned with screenshot proof.",
      reviewRequiredReason: null,
      aiInputHash: aiProof.aiInputHash,
      aiOutputPayloadHash: aiProof.outputPayloadHash,
      dataQualityFlags: ["candidate_source_binding_mismatch"],
    };
  }
  return hasSharedBindingConflict(screenshotProof.videoVisitId, aiProof.videoVisitId)
    ? {
        ok: false,
        status: "failed",
        decision: "block",
        failureReason: "ai_proof_binding_mismatch",
        statusMessage: "AI proof videoVisitId must stay aligned with screenshot proof.",
        reviewRequiredReason: null,
        aiInputHash: aiProof.aiInputHash,
        aiOutputPayloadHash: aiProof.outputPayloadHash,
        dataQualityFlags: ["candidate_source_binding_mismatch"],
      }
    : null;
}

export function createAiProofQualityReview(
  input: {
    request: ParsedVisualTargetAbilityInput;
  },
  aiProof: NonNullable<ParsedVisualTargetAbilityInput["sourceProof"]["ai"]> | null,
):
  | {
      ok: false;
      status: "review_required";
      decision: "review_required";
      failureReason: VisualTargetFailureReason;
      statusMessage: string;
      reviewRequiredReason: string | null;
      aiInputHash: string | null;
      aiOutputPayloadHash: string | null;
      dataQualityFlags: VisualTargetDataQualityFlag[];
    }
  | null {
  return null;
}
