import {
  DeepResearchInputSchema,
  DeepResearchInterventionRequestSchema,
  cancelDeepResearch,
  pauseDeepResearch,
  resumeDeepResearch,
  runDeepResearchAnalysis,
  takeoverDeepResearch,
  type DeepResearchAnalysisStartInput,
} from "../plugins/deep-research-analysis/deep-research-analysis.public.js";

export const runPauseDeepResearchRoute = (rawInput: Parameters<typeof pauseDeepResearch>[1], dataDir: string) =>
  pauseDeepResearch(dataDir, DeepResearchInterventionRequestSchema.parse(rawInput));
export const runCancelDeepResearchRoute = (rawInput: Parameters<typeof cancelDeepResearch>[1], dataDir: string) =>
  cancelDeepResearch(dataDir, DeepResearchInterventionRequestSchema.parse(rawInput));
export const runTakeoverDeepResearchRoute = (rawInput: Parameters<typeof takeoverDeepResearch>[1], dataDir: string) =>
  takeoverDeepResearch(dataDir, DeepResearchInterventionRequestSchema.parse(rawInput));
export const runResumeDeepResearchRoute = (rawInput: Parameters<typeof resumeDeepResearch>[1], dataDir: string) =>
  resumeDeepResearch(dataDir, DeepResearchInterventionRequestSchema.parse(rawInput));

type DeepResearchRuntime = Omit<
  Parameters<typeof runDeepResearchAnalysis>[1],
  "providerKind"
>;

export const runDeepResearchAnalysisRoute = (
  input: DeepResearchAnalysisStartInput,
  runtime: DeepResearchRuntime,
) => {
  const {
    providerKind,
    ...rawInput
  } = input;
  return runDeepResearchAnalysis(
    DeepResearchInputSchema.parse(rawInput),
    { ...runtime, providerKind },
  );
};
