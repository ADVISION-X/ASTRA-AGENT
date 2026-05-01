import type { ParsedVisualTargetAbilityInput, VisualTargetDataQualityFlag, VisualTargetFailureReason } from "../contract.js";
import { parseVisualTargetIsoTimestamp } from "./visual-target-clock.js";

export function createAiProofBindingFailure(
  input: {
    request: ParsedVisualTargetAbilityInput;
    nowEpochMs: number;
    freshnessTtlMs: number;
    minimumConfidence: number;
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

  return createAiProofSessionMismatchFailure(input, aiProof);
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

export function createAiProofQualityReview(
  input: {
    request: ParsedVisualTargetAbilityInput;
    nowEpochMs: number;
    freshnessTtlMs: number;
    minimumConfidence: number;
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
  if (!aiProof) {
    return null;
  }

  const ageMs = Math.max(0, input.nowEpochMs - parseVisualTargetIsoTimestamp(aiProof.capturedAt));
  const flags: VisualTargetDataQualityFlag[] = [];
  if (ageMs > input.freshnessTtlMs) {
    flags.push("stale_candidate");
  }
  if (aiProof.confidence < input.minimumConfidence) {
    flags.push("low_confidence");
  }
  if (flags.length === 0) {
    return null;
  }

  return {
    ok: false,
    status: "review_required",
    decision: "review_required",
    failureReason: "confidence_below_threshold",
    statusMessage: "AI proof is present but its freshness or confidence requires review.",
    reviewRequiredReason: "Visual Target requires review because AI proof freshness or confidence is below policy.",
    aiInputHash: aiProof.aiInputHash,
    aiOutputPayloadHash: aiProof.outputPayloadHash,
    dataQualityFlags: flags,
  };
}
