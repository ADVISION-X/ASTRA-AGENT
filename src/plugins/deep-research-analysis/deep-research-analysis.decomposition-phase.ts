import { parseDecompositionResponse } from "./deep-research-analysis.decomposition-parser.js";
import {
  DEEP_RESEARCH_DECOMPOSITION_PROMPT,
  renderDecompositionPrompt,
} from "./deep-research-analysis.decomposition-prompt.js";
import type { DeepResearchDecompositionResponse as PromptAssetDecompositionResponse } from "./deep-research-analysis.decomposition-schema.js";
import { buildDeepResearchPromptHash } from "./deep-research-analysis.prompt-hash.js";
import type { DecompositionPromptRenderInput } from "./deep-research-analysis.prompt-contracts.js";
import { scoreDecompositionQuality } from "./deep-research-analysis.prompt-quality.js";
import type {
  DeepResearchGatewayPromptPackage,
  DeepResearchGatewayResult,
  DeepResearchGatewaySender,
  ProviderKind,
} from "./deep-research-analysis.flow-shared.js";

type DecompositionQuality = ReturnType<typeof scoreDecompositionQuality>;

type ResearchInteractionSnapshot = {
  phase: "decomposition";
  promptId: string;
  promptVersion: string;
  promptHash: string;
  rawResponseHash: string;
  normalizedText: string;
  parseStatus: "parsed" | "partial_review_required" | "failed";
  rawOutputRef: string | null;
  providerProofJson: string;
};

type DeepResearchDecompositionFlowResult =
  | {
      status: "parsed";
      output: PromptAssetDecompositionResponse;
      quality: DecompositionQuality;
      interaction: ResearchInteractionSnapshot;
    }
  | {
      status: "review_required" | "failed";
      reason: string;
      quality: DecompositionQuality | null;
      interaction: ResearchInteractionSnapshot;
    };

type DeepResearchDecompositionFlowInput = DecompositionPromptRenderInput & {
  jobId: string;
  providerKind: ProviderKind;
  sendPromptPackage: DeepResearchGatewaySender;
};

const buildDecompositionPromptPackage = (input: {
  jobId: string;
  providerKind: ProviderKind;
  renderedPromptText: string;
  promptHash: string;
}): DeepResearchGatewayPromptPackage => ({
  jobId: input.jobId,
  promptPackageId: `${input.jobId}:decomposition-specialty:${DEEP_RESEARCH_DECOMPOSITION_PROMPT.promptVersion}`,
  promptContractId: DEEP_RESEARCH_DECOMPOSITION_PROMPT.outputContractId,
  promptText: input.renderedPromptText,
  promptHash: input.promptHash,
  inputRefs: [`job:${input.jobId}:userQuestion`],
  providerKind: input.providerKind,
  timeoutMs: 300_000,
  maxInputChars: 24_000,
  maxFileCount: 0,
  maxFileBytes: 1,
});

const buildInteractionSnapshot = (input: {
  promptHash: string;
  gatewayResult: DeepResearchGatewayResult;
  parseStatus: ResearchInteractionSnapshot["parseStatus"];
}): ResearchInteractionSnapshot => ({
  phase: "decomposition",
  promptId: DEEP_RESEARCH_DECOMPOSITION_PROMPT.promptId,
  promptVersion: DEEP_RESEARCH_DECOMPOSITION_PROMPT.promptVersion,
  promptHash: input.promptHash,
  rawResponseHash: input.gatewayResult.rawOutputHash,
  normalizedText: input.gatewayResult.normalizedText,
  parseStatus: input.parseStatus,
  rawOutputRef: input.gatewayResult.rawOutputRef,
  providerProofJson: input.gatewayResult.providerProofJson,
});

export const runDeepResearchDecompositionPhase = async (
  input: DeepResearchDecompositionFlowInput,
): Promise<DeepResearchDecompositionFlowResult> => {
  const renderedPromptText = renderDecompositionPrompt(input);
  const promptHash = buildDeepResearchPromptHash({
    promptId: DEEP_RESEARCH_DECOMPOSITION_PROMPT.promptId,
    promptVersion: DEEP_RESEARCH_DECOMPOSITION_PROMPT.promptVersion,
    phase: DEEP_RESEARCH_DECOMPOSITION_PROMPT.phase,
    promptText: renderedPromptText,
    outputContractId: DEEP_RESEARCH_DECOMPOSITION_PROMPT.outputContractId,
  });
  const gatewayResult = await input.sendPromptPackage(
    buildDecompositionPromptPackage({
      jobId: input.jobId,
      providerKind: input.providerKind,
      renderedPromptText,
      promptHash,
    }),
  );
  const parsed = parseDecompositionResponse({
    rawText: gatewayResult.normalizedText,
    maxSubQuestions: input.maxSubQuestions,
  });
  const interaction = buildInteractionSnapshot({
    promptHash,
    gatewayResult,
    parseStatus: parsed.parseStatus,
  });
  if (gatewayResult.status !== "completed") {
    return {
      status: gatewayResult.status,
      reason: `ai_gateway_${gatewayResult.status}`,
      quality: null,
      interaction,
    };
  }
  if (parsed.parseStatus !== "parsed") {
    return {
      status: parsed.parseStatus === "failed" ? "failed" : "review_required",
      reason: parsed.reason,
      quality: null,
      interaction,
    };
  }
  const quality = scoreDecompositionQuality(parsed.parsed);
  if (quality.status !== "passed") {
    return {
      status: "review_required",
      reason: `quality_score_below_threshold:${quality.score}`,
      quality,
      interaction,
    };
  }
  return {
    status: "parsed",
    output: parsed.parsed,
    quality,
    interaction,
  };
};