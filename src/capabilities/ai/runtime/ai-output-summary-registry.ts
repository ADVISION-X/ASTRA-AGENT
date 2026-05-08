import { createHash } from "node:crypto";

import type {
  AiAbilityResult,
  AiVisualTargetCandidateOutput,
  ParsedAiAbilityInput,
} from "../contract.js";

export type AiVisualTargetCandidateOutputSummary = {
  taskType: "visual_target_candidate_analysis";
  aiResultRef: string;
  aiProofRef: string;
  promptContractId: string;
  outputSchemaRef: string;
  aiInputArtifactRef: string | null;
  aiInputHash: string;
  outputPayloadHash: string;
  capturedAt: string;
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  confidence: number;
  modelRole: string;
  targetCandidates: AiVisualTargetCandidateOutput["targetCandidates"];
};

const summaries = new Map<string, AiVisualTargetCandidateOutputSummary>();

const buildOutputPayloadHash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

const isSuccessfulVisualTargetCandidateAnalysis = (
  request: ParsedAiAbilityInput,
  result: AiAbilityResult,
): result is AiAbilityResult & { status: "success"; output: AiVisualTargetCandidateOutput } => {
  return request.taskType === "visual_target_candidate_analysis"
    && result.status === "success"
    && result.output !== null;
};

export function recordAiOutputSummary(input: {
  outputRef: string | null;
  request: ParsedAiAbilityInput;
  result: AiAbilityResult;
}): void {
  if (!input.outputRef || !isSuccessfulVisualTargetCandidateAnalysis(input.request, input.result)) {
    return;
  }

  summaries.set(input.outputRef, {
    taskType: "visual_target_candidate_analysis",
    aiResultRef: input.outputRef,
    aiProofRef: input.result.runtimeProof.proofId,
    promptContractId: input.result.runtimeProof.promptContractId,
    outputSchemaRef: input.result.runtimeProof.expectedOutputSchema,
    aiInputArtifactRef: input.request.inputRefs[0]?.id ?? null,
    aiInputHash: input.result.runtimeProof.inputPayloadHash,
    outputPayloadHash: buildOutputPayloadHash(input.result.output),
    capturedAt: input.result.createdAt,
    sessionId: input.result.runtimeProof.sessionId,
    roundId: input.result.runtimeProof.roundId,
    videoVisitId: input.result.runtimeProof.videoVisitId,
    confidence: input.result.confidence ?? 0,
    modelRole: input.result.modelRole,
    targetCandidates: input.result.output.targetCandidates,
  });
}

export function resolveAiVisualTargetCandidateOutputSummary(
  ref: string | null | undefined,
): AiVisualTargetCandidateOutputSummary | null {
  if (!ref) {
    return null;
  }
  return summaries.get(ref) ?? null;
}