import { DEEP_RESEARCH_DECOMPOSITION_PROMPT, renderDecompositionPrompt } from "./deep-research-analysis.decomposition-prompt.js";
import { parseDecompositionResponse } from "./deep-research-analysis.decomposition-parser.js";
import { buildDeepResearchPromptHash, buildDeepResearchTextHash } from "./deep-research-analysis.prompt-hash.js";
import { scoreDecompositionQuality } from "./deep-research-analysis.prompt-quality.js";
import type { AiInputGatewayAbilityGroup } from "../../capabilities/ai-input-gateway/index.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import type {
  DecompositionOutput,
  DecompositionPromptQualityScore,
  DecompositionPromptRenderInput,
} from "./deep-research-analysis.prompt-contracts.js";
import type { DeepResearchInput } from "./deep-research-analysis.schema.js";
import type { DeepResearchResult } from "./deep-research-analysis.result.js";

type AiGatewayPromptPackage = {
  promptPackageId: string;
  promptContractId: string;
  promptText: string;
  promptHash: string;
  inputRefs: string[];
  providerKind: "gemini-api" | "gemini-web-chat" | "gpt-web-chat";
  timeoutMs: number;
  maxInputChars: number;
  maxFileCount: number;
  maxFileBytes: number;
};

type AiGatewayDecompositionResult = {
  status: "completed" | "review_required" | "failed";
  rawOutputRef: string | null;
  rawOutputHash: string;
  normalizedText: string;
  providerProofJson: string;
};

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

export type DeepResearchDecompositionFlowResult =
  | {
      status: "parsed";
      output: DecompositionOutput;
      quality: DecompositionPromptQualityScore;
      interaction: ResearchInteractionSnapshot;
    }
  | {
      status: "review_required" | "failed";
      reason: string;
      quality: DecompositionPromptQualityScore | null;
      interaction: ResearchInteractionSnapshot;
    };

export type DeepResearchDecompositionFlowInput = DecompositionPromptRenderInput & {
  jobId: string;
  providerKind: AiGatewayPromptPackage["providerKind"];
  sendPromptPackage: (promptPackage: AiGatewayPromptPackage) => Promise<AiGatewayDecompositionResult>;
};

export type DeepResearchAnalysisContext = {
  jobId?: string;
  aiInputGateway?: AiInputGatewayAbilityGroup;
  runtimeLogger?: RuntimeLogger;
  dataDir?: string;
  providerKind: AiGatewayPromptPackage["providerKind"];
  modelName?: string;
  timeoutMs?: number;
  sendPromptPackage?: (promptPackage: AiGatewayPromptPackage) => Promise<AiGatewayDecompositionResult>;
};

const buildGatewaySender = (context: DeepResearchAnalysisContext): DeepResearchDecompositionFlowInput["sendPromptPackage"] => {
  if (context.sendPromptPackage) return context.sendPromptPackage;
  if (!context.aiInputGateway) {
    throw new Error("Deep Research analysis requires sendPromptPackage or aiInputGateway.");
  }
  return async (promptPackage) => {
    const result = await context.aiInputGateway?.execute({
      providerKind: promptPackage.providerKind,
      promptPackageId: promptPackage.promptPackageId,
      promptContractId: promptPackage.promptContractId,
      expectedOutputSchemaRef: promptPackage.promptContractId,
      textPrompt: promptPackage.promptText,
      inputRefs: promptPackage.inputRefs.map((ref) => ({
        id: ref,
        kind: "prompt-input",
        summary: ref,
      })),
      modelName: context.modelName ?? null,
      timeoutMs: context.timeoutMs ?? promptPackage.timeoutMs,
      maxInputChars: promptPackage.maxInputChars,
      maxFileCount: promptPackage.maxFileCount,
      maxFileBytes: promptPackage.maxFileBytes,
      requestedBy: "ai-capability",
      missionId: context.jobId ?? null,
      runId: context.jobId ?? null,
      roundId: null,
    });
    if (!result) {
      throw new Error("AI input gateway did not return a result.");
    }
    const normalizedText = result.normalizedText ?? "";
    return {
      status: result.status === "success" ? "completed" : result.status,
      rawOutputRef: result.rawOutputRef,
      rawOutputHash: result.rawOutputHash ?? buildDeepResearchTextHash(normalizedText),
      normalizedText,
      providerProofJson: JSON.stringify(result.providerProof),
    };
  };
};

const buildPromptPackage = (input: {
  jobId: string;
  providerKind: AiGatewayPromptPackage["providerKind"];
  renderedPrompt: string;
  promptHash: string;
}): AiGatewayPromptPackage => ({
  promptPackageId: `${input.jobId}:decomposition:${DEEP_RESEARCH_DECOMPOSITION_PROMPT.promptVersion}`,
  promptContractId: DEEP_RESEARCH_DECOMPOSITION_PROMPT.outputContractId,
  promptText: input.renderedPrompt,
  promptHash: input.promptHash,
  inputRefs: [`job:${input.jobId}:userQuestion`],
  providerKind: input.providerKind,
  timeoutMs: 120000,
  maxInputChars: 24000,
  maxFileCount: 0,
  maxFileBytes: 200_000_000,
});

const buildInteraction = (input: {
  promptHash: string;
  gatewayResult: AiGatewayDecompositionResult;
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
  const renderedPrompt = renderDecompositionPrompt(input);
  const promptHash = buildDeepResearchPromptHash({
    ...DEEP_RESEARCH_DECOMPOSITION_PROMPT,
    text: renderedPrompt,
  });
  const promptPackage = buildPromptPackage({
    jobId: input.jobId,
    providerKind: input.providerKind,
    renderedPrompt,
    promptHash,
  });
  const gatewayResult = await input.sendPromptPackage(promptPackage);
  const parsed = parseDecompositionResponse({
    rawText: gatewayResult.normalizedText,
    maxSubQuestions: input.maxSubQuestions,
  });
  const interaction = buildInteraction({
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

export const runDeepResearchAnalysis = async (
  input: DeepResearchInput,
  context: DeepResearchAnalysisContext,
): Promise<DeepResearchResult> => {
  const jobId = context.jobId ?? "deep-research-analysis-unpersisted";
  const decomposition = await runDeepResearchDecompositionPhase({
    jobId,
    userQuestion: input.userQuestion,
    maxSubQuestions: input.maxSubQuestions,
    language: input.language,
    questionTypeHint: null,
    providerKind: context.providerKind,
    sendPromptPackage: buildGatewaySender(context),
  });
  if (decomposition.status !== "parsed") {
    return {
      jobId,
      status: decomposition.status === "failed" ? "failed" : "review_required",
      jobStatus: decomposition.status === "failed" ? "failed" : "review_required",
      phase: "DECOMPOSE_PARSE",
      report: null,
      recordHashes: {
        promptHash: decomposition.interaction.promptHash,
        rawResponseHash: decomposition.interaction.rawResponseHash,
      },
      failureReason: decomposition.status === "failed" ? decomposition.reason : null,
      reviewReason: decomposition.status === "review_required" ? decomposition.reason : null,
    };
  }
  return {
    jobId,
    status: "review_required",
    jobStatus: "review_required",
    phase: "DECOMPOSE_PERSIST",
    report: null,
    recordHashes: {
      promptHash: decomposition.interaction.promptHash,
      rawResponseHash: decomposition.interaction.rawResponseHash,
    },
    failureReason: null,
    reviewReason: "decomposition_prompt_asset_ready_positive_phase_not_executed_by_this_specialty",
  };
};