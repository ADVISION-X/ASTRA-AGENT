export {
  recordAiInputProofSummary,
  resolveAiInputProofSummary,
  type AiInputProofSummary,
} from "./shared/ai-input-proof-registry.js";

export {
  recordAiOutputSummaryAlias,
  resolveAiCommentSignalOutputSummary,
  resolveAiOcrCleanupOutputSummary,
  resolveAiPagePreparationOutputSummary,
  resolveAiProductPresenceOutputSummary,
  resolveAiVisualTargetCandidateOutputSummary,
  type AiCommentSignalOutputSummary,
  type AiOcrCleanupOutputSummary,
  type AiPagePreparationOutputSummary,
  type AiProductPresenceOutputSummary,
  type AiVisualTargetCandidateOutputSummary,
} from "./runtime/ai-output-summary-registry.js";