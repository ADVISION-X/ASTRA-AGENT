import {
  DeepResearchInputSchema,
  runDeepResearchAnalysis,
  type DeepResearchAnalysisStartInput,
} from "../plugins/deep-research-analysis/deep-research-analysis.public.js";

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
