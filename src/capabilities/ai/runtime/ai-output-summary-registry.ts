export type {
  AiCommentSignalOutputSummary,
  AiOcrCleanupOutputSummary,
  AiPagePreparationOutputSummary,
  AiProductPresenceOutputSummary,
  AiVisualTargetCandidateOutputSummary,
} from "./ai-output-summary-types.js";

export {
  recordAiOutputSummary,
  recordAiOutputSummaryAlias,
} from "./ai-output-summary-recorders.js";

export {
  resolveAiVisualTargetCandidateOutputSummary,
  resolveAiPagePreparationOutputSummary,
  resolveAiOcrCleanupOutputSummary,
  resolveAiProductPresenceOutputSummary,
  resolveAiCommentSignalOutputSummary,
} from "./ai-output-summary-resolvers.js";