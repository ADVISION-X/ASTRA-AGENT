import type { ParsedVisualTargetAbilityInput, VisualTargetDataQualityFlag, VisualTargetFailureReason } from "../contract.js";
import { isAllowedAiOutputSchemaRef, isAllowedAiPromptContract } from "../shared/visual-target-policy.js";
import { parseVisualTargetIsoTimestamp } from "./visual-target-clock.js";

export function validateAiResultProof(input: {
  request: ParsedVisualTargetAbilityInput;
  nowEpochMs: number;
  freshnessTtlMs: number;
  minimumConfidence: number;
}):
  | { ok: true; decision: "allow" | "not_required"; aiInputHash: string | null; aiOutputPayloadHash: string | null; dataQualityFlags: VisualTargetDataQualityFlag[] }
  | {
      ok: false;
      status: "failed" | "review_required";
      decision: "block" | "review_required";
      failureReason: VisualTargetFailureReason;
      statusMessage: string;
      reviewRequiredReason: string | null;
      aiInputHash: string | null;
      aiOutputPayloadHash: string | null;
      dataQualityFlags: VisualTargetDataQualityFlag[];
    } {
  const aiCandidates = input.request.candidates.filter((candidate) => candidate.candidateKind === "ai_candidate");
  if (aiCandidates.length === 0) {
    return { ok: true, decision: "not_required", aiInputHash: null, aiOutputPayloadHash: null, dataQualityFlags: [] };
  }

  const aiProof = input.request.sourceProof.ai;
  if (!aiProof) {
    return {
      ok: false,
      status: "failed",
      decision: "block",
      failureReason: "missing_ai_proof",
      statusMessage: "AI-generated visual target candidates require governed AI proof.",
      reviewRequiredReason: null,
      aiInputHash: null,
      aiOutputPayloadHash: null,
      dataQualityFlags: [],
    };
  }
  if (!isAllowedAiPromptContract(aiProof.promptContractId)) {
    return {
      ok: false,
      status: "failed",
      decision: "block",
      failureReason: "invalid_ai_prompt_contract",
      statusMessage: "AI proof promptContractId is outside the governed visual target contract set.",
      reviewRequiredReason: null,
      aiInputHash: aiProof.aiInputHash,
      aiOutputPayloadHash: aiProof.outputPayloadHash,
      dataQualityFlags: [],
    };
  }
  if (!isAllowedAiOutputSchemaRef(aiProof.outputSchemaRef)) {
    return {
      ok: false,
      status: "failed",
      decision: "block",
      failureReason: "invalid_ai_output_schema",
      statusMessage: "AI proof must bind to a governed output schema reference.",
      reviewRequiredReason: null,
      aiInputHash: aiProof.aiInputHash,
      aiOutputPayloadHash: aiProof.outputPayloadHash,
      dataQualityFlags: [],
    };
  }

  if (
    aiProof.sourceScreenshotEvidenceId !== input.request.sourceProof.screenshot.screenshotEvidenceId
    || aiProof.sourceScreenshotProofRef !== input.request.sourceProof.screenshot.screenshotProofRef
    || aiProof.sourceImageHash !== input.request.sourceProof.screenshot.imageHash
  ) {
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

  if (!aiProof.aiInputArtifactRef || !aiProof.aiInputHash || !aiProof.outputPayloadHash) {
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

  if (aiProof.sessionId !== input.request.sessionId) {
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

  const ageMs = Math.max(0, input.nowEpochMs - parseVisualTargetIsoTimestamp(aiProof.capturedAt));
  const flags: VisualTargetDataQualityFlag[] = [];
  if (ageMs > input.freshnessTtlMs) {
    flags.push("stale_candidate");
  }
  if (aiProof.confidence < input.minimumConfidence) {
    flags.push("low_confidence");
  }
  if (flags.length > 0) {
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

  return { ok: true, decision: "allow", aiInputHash: aiProof.aiInputHash, aiOutputPayloadHash: aiProof.outputPayloadHash, dataQualityFlags: [] };
}