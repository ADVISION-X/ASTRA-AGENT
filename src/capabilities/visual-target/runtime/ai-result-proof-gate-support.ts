import type { ParsedVisualTargetAbilityInput, VisualTargetDataQualityFlag, VisualTargetFailureReason } from "../contract.js";
import { isAllowedAiOutputSchemaRef, isAllowedAiPromptContract } from "../shared/visual-target-policy.js";
import { createAiProofBindingFailure, createAiProofQualityReview } from "./ai-result-proof-gate-binding.js";

type AiResultProofInput = {
  request: ParsedVisualTargetAbilityInput;
  nowEpochMs: number;
  freshnessTtlMs: number;
  minimumConfidence: number;
};

type AiProof = NonNullable<ParsedVisualTargetAbilityInput["sourceProof"]["ai"]>;

type AiResultProofBlocked = {
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

type AiResultProofReviewRequired = {
  ok: false;
  status: "review_required";
  decision: "review_required";
  failureReason: VisualTargetFailureReason;
  statusMessage: string;
  reviewRequiredReason: string | null;
  aiInputHash: string | null;
  aiOutputPayloadHash: string | null;
  dataQualityFlags: VisualTargetDataQualityFlag[];
};

type AiResultProofAllowed = {
  ok: true;
  decision: "allow" | "not_required";
  aiInputHash: string | null;
  aiOutputPayloadHash: string | null;
  dataQualityFlags: VisualTargetDataQualityFlag[];
};

type AiResultProofDecision = AiResultProofAllowed | AiResultProofBlocked | AiResultProofReviewRequired;

export function createAiResultProofNotRequired(): { ok: true; decision: "not_required"; aiInputHash: null; aiOutputPayloadHash: null; dataQualityFlags: VisualTargetDataQualityFlag[] } {
  return { ok: true, decision: "not_required", aiInputHash: null, aiOutputPayloadHash: null, dataQualityFlags: [] };
}

export function createMissingAiProofFailure(): AiResultProofBlocked {
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

export function createInvalidAiPromptContractFailure(aiProof: AiProof | null): AiResultProofBlocked | null {
  if (!aiProof || isAllowedAiPromptContract(aiProof.promptContractId)) {
    return null;
  }

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

export function createInvalidAiOutputSchemaFailure(aiProof: AiProof | null): AiResultProofBlocked | null {
  if (!aiProof || isAllowedAiOutputSchemaRef(aiProof.outputSchemaRef)) {
    return null;
  }

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

export function createAiResultProofAllow(aiProof: AiProof): AiResultProofAllowed {
  return { ok: true, decision: "allow", aiInputHash: aiProof.aiInputHash, aiOutputPayloadHash: aiProof.outputPayloadHash, dataQualityFlags: [] };
}

const createAiProofDecision = (input: AiResultProofInput, aiProof: AiProof): AiResultProofBlocked | AiResultProofReviewRequired | null =>
  createInvalidAiPromptContractFailure(aiProof)
  ?? createInvalidAiOutputSchemaFailure(aiProof)
  ?? createAiProofBindingFailure(input, aiProof)
  ?? createAiProofQualityReview(input, aiProof);

export function evaluateAiResultProof(input: AiResultProofInput): AiResultProofDecision {
  const aiCandidates = input.request.candidates.filter((candidate) => candidate.candidateKind === "ai_candidate");
  if (aiCandidates.length === 0) {
    return createAiResultProofNotRequired();
  }

  const aiProof = input.request.sourceProof.ai;
  if (!aiProof) {
    return createMissingAiProofFailure();
  }

  const proofDecision = createAiProofDecision(input, aiProof);
  if (proofDecision) {
    return proofDecision;
  }

  return createAiResultProofAllow(aiProof);
}
