import type { ParsedVisualTargetAbilityInput, VisualTargetDataQualityFlag, VisualTargetFailureReason } from "../contract.js";
import { calculateVisualTargetAgeMs } from "./visual-target-time.js";

function isGovernedPromptContract(promptContractId: string): boolean {
  return /vision|target|ocr|ui/i.test(promptContractId);
}

export function validateAiResultProof(input: {
  request: ParsedVisualTargetAbilityInput;
  nowIso: string;
  freshnessTtlMs: number;
  minimumConfidence: number;
}):
  | { ok: true; decision: "allow" | "not_required"; dataQualityFlags: VisualTargetDataQualityFlag[] }
  | {
      ok: false;
      status: "failed" | "review_required";
      decision: "block" | "review_required";
      failureReason: VisualTargetFailureReason;
      statusMessage: string;
      reviewRequiredReason: string | null;
      dataQualityFlags: VisualTargetDataQualityFlag[];
    } {
  const aiCandidates = input.request.candidates.filter((candidate) => candidate.candidateKind === "ai_candidate");
  if (aiCandidates.length === 0) {
    return { ok: true, decision: "not_required", dataQualityFlags: [] };
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
      dataQualityFlags: [],
    };
  }
  if (!isGovernedPromptContract(aiProof.promptContractId)) {
    return {
      ok: false,
      status: "failed",
      decision: "block",
      failureReason: "invalid_ai_prompt_contract",
      statusMessage: "AI proof promptContractId is outside the governed visual target contract set.",
      reviewRequiredReason: null,
      dataQualityFlags: [],
    };
  }
  if (!aiProof.outputSchemaRef.trim()) {
    return {
      ok: false,
      status: "failed",
      decision: "block",
      failureReason: "invalid_ai_output_schema",
      statusMessage: "AI proof must bind to a governed output schema reference.",
      reviewRequiredReason: null,
      dataQualityFlags: [],
    };
  }

  const ageMs = calculateVisualTargetAgeMs({ nowIso: input.nowIso, observedIso: aiProof.capturedAt });
  const flags: VisualTargetDataQualityFlag[] = [];
  if (ageMs > input.freshnessTtlMs) {
    flags.push("stale_candidate");
  }
  if (aiProof.confidence < input.minimumConfidence) {
    flags.push("ai_confidence_low");
  }
  if (flags.length > 0) {
    return {
      ok: false,
      status: "review_required",
      decision: "review_required",
      failureReason: "confidence_below_threshold",
      statusMessage: "AI proof is present but its freshness or confidence requires review.",
      reviewRequiredReason: "Visual Target requires review because AI proof freshness or confidence is below policy.",
      dataQualityFlags: flags,
    };
  }

  return { ok: true, decision: "allow", dataQualityFlags: [] };
}