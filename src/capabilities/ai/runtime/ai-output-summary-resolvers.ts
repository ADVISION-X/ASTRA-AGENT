import { resolveAiOutputSummary } from "./ai-output-summary-store.js";
import type {
  AiCommentSignalOutputSummary,
  AiOcrCleanupOutputSummary,
  AiPagePreparationOutputSummary,
  AiProductPresenceOutputSummary,
  AiVisualTargetCandidateOutputSummary,
} from "./ai-output-summary-types.js";

const readAiOutputSummary = (ref: string | null | undefined) =>
  ref ? resolveAiOutputSummary(ref) : null;

export function resolveAiVisualTargetCandidateOutputSummary(
  ref: string | null | undefined,
): AiVisualTargetCandidateOutputSummary | null {
  const summary = readAiOutputSummary(ref);
  return summary?.taskType === "visual_target_candidate_analysis" ? summary : null;
}

export function resolveAiPagePreparationOutputSummary(
  ref: string | null | undefined,
): AiPagePreparationOutputSummary | null {
  const summary = readAiOutputSummary(ref);
  return summary?.taskType === "page_preparation_judgment" ? summary : null;
}

export function resolveAiOcrCleanupOutputSummary(
  ref: string | null | undefined,
): AiOcrCleanupOutputSummary | null {
  const summary = readAiOutputSummary(ref);
  return summary?.taskType === "ocr_cleanup" ? summary : null;
}

export function resolveAiProductPresenceOutputSummary(
  ref: string | null | undefined,
): AiProductPresenceOutputSummary | null {
  const summary = readAiOutputSummary(ref);
  return summary?.taskType === "product_presence_judgment" ? summary : null;
}

export function resolveAiCommentSignalOutputSummary(
  ref: string | null | undefined,
): AiCommentSignalOutputSummary | null {
  const summary = readAiOutputSummary(ref);
  return summary?.taskType === "comment_signal_summary" ? summary : null;
}