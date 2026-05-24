import { parseDecompositionResponse } from "./deep-research-analysis.decomposition-parser.js";
import {
	DEEP_RESEARCH_DECOMPOSITION_PROMPT,
	renderDecompositionPrompt,
} from "./deep-research-analysis.decomposition-prompt.js";
import { runDeepResearchDecompositionPhase as runDeepResearchDecompositionPhaseCore } from "./deep-research-analysis.decomposition-phase.js";
import { buildDeepResearchPromptHash } from "./deep-research-analysis.prompt-hash.js";
import { scoreDecompositionQuality } from "./deep-research-analysis.prompt-quality.js";

export type { DeepResearchAnalysisContext } from "./deep-research-analysis.flow-shared.js";
export { runDeepResearchAnalysis } from "./deep-research-analysis.analysis-runner.js";

const captureLawfulDecompositionEvidence = (
	input: Parameters<typeof runDeepResearchDecompositionPhaseCore>[0],
	result: Awaited<ReturnType<typeof runDeepResearchDecompositionPhaseCore>>,
): { promptHash: string; rawResponseHash: string } => {
	const renderedPromptText = renderDecompositionPrompt(input);
	const promptHash = buildDeepResearchPromptHash({
		promptId: DEEP_RESEARCH_DECOMPOSITION_PROMPT.promptId,
		promptVersion: DEEP_RESEARCH_DECOMPOSITION_PROMPT.promptVersion,
		phase: DEEP_RESEARCH_DECOMPOSITION_PROMPT.phase,
		promptText: renderedPromptText,
		outputContractId: DEEP_RESEARCH_DECOMPOSITION_PROMPT.outputContractId,
	});
	const parsedResponse = parseDecompositionResponse({
		rawText: result.interaction.normalizedText,
		maxSubQuestions: input.maxSubQuestions,
	});
	const rawResponseHash = parsedResponse.rawResponseHash;
	if (parsedResponse.parseStatus === "parsed") {
		scoreDecompositionQuality(parsedResponse.parsed);
	}
	return { promptHash, rawResponseHash };
};

export const runDeepResearchDecompositionPhase = async (
	input: Parameters<typeof runDeepResearchDecompositionPhaseCore>[0],
): Promise<Awaited<ReturnType<typeof runDeepResearchDecompositionPhaseCore>>> => {
	const result = await runDeepResearchDecompositionPhaseCore(input);
	captureLawfulDecompositionEvidence(input, result);
	return result;
};
