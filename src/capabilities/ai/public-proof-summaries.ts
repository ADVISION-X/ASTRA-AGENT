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
  resolveAiVisualMissionActionPlanOutputSummary,
  resolveAiVisualTargetCandidateOutputSummary,
  type AiCommentSignalOutputSummary,
  type AiOcrCleanupOutputSummary,
  type AiPagePreparationOutputSummary,
  type AiProductPresenceOutputSummary,
  type AiVisualMissionActionPlanOutputSummary,
  type AiVisualTargetCandidateOutputSummary,
} from "./runtime/ai-output-summary-registry.js";