import type { ParsedAiAbilityInput } from "../contract.js";
import {
  AiCommentSignalSummaryInputSchema,
  AiEvidencePacketAnalysisInputSchema,
  AiOcrCleanupInputSchema,
  AiProductSignalSummaryInputSchema,
  AiVisionRequestInputSchema,
} from "../schema.js";

const MAX_INPUT_REFS = 50;
const MAX_FRAME_REFS = 10;
const MAX_COMMENT_BLOCKS = 200;
const MAX_COMMENT_LENGTH = 1000;
const MAX_PACKET_SUMMARY_LENGTH = 5000;
const MAX_NOTES = 50;
const MAX_NOTE_LENGTH = 500;

type PayloadBudgetDecision = {
  decision: "allow" | "blocked";
  reason: string | null;
  flags: string[];
};

function allow(): PayloadBudgetDecision {
  return { decision: "allow", reason: null, flags: [] };
}

function blocked(reason: string): PayloadBudgetDecision {
  return { decision: "blocked", reason, flags: [reason] };
}

function hasOversizedText(items: string[], maxLength: number): boolean {
  return items.some((item) => item.length > maxLength);
}

function evaluateVisionPayloadBudget(request: ParsedAiAbilityInput): PayloadBudgetDecision {
  const visionInput = AiVisionRequestInputSchema.parse(request.input);
  if (visionInput.frameEvidenceIds.length > MAX_FRAME_REFS || visionInput.missingFrames.length > MAX_FRAME_REFS) {
    return blocked("payload_budget_frame_refs_exceeded");
  }
  if (visionInput.summary.length > MAX_PACKET_SUMMARY_LENGTH) {
    return blocked("payload_budget_summary_exceeded");
  }
  return allow();
}

function evaluateCommentPayloadBudget(comments: string[]): PayloadBudgetDecision {
  if (comments.length > MAX_COMMENT_BLOCKS) {
    return blocked("payload_budget_comments_exceeded");
  }
  if (hasOversizedText(comments, MAX_COMMENT_LENGTH)) {
    return blocked("payload_budget_comment_length_exceeded");
  }
  return allow();
}

function evaluateEvidencePacketBudget(request: ParsedAiAbilityInput): PayloadBudgetDecision {
  const packetInput = AiEvidencePacketAnalysisInputSchema.parse(request.input);
  if (packetInput.packetSummary.length > MAX_PACKET_SUMMARY_LENGTH || packetInput.evidenceIds.length > MAX_INPUT_REFS) {
    return blocked("payload_budget_packet_exceeded");
  }
  if (packetInput.notes.length > MAX_NOTES || hasOversizedText(packetInput.notes, MAX_NOTE_LENGTH)) {
    return blocked("payload_budget_notes_exceeded");
  }
  return allow();
}

function evaluateProductSignalPayloadBudget(request: ParsedAiAbilityInput): PayloadBudgetDecision {
  const productSignalInput = AiProductSignalSummaryInputSchema.parse(request.input);
  return productSignalInput.videoSummary.length > MAX_PACKET_SUMMARY_LENGTH
    ? blocked("payload_budget_summary_exceeded")
    : allow();
}

function evaluateObservationTaskPayloadBudget(request: ParsedAiAbilityInput): PayloadBudgetDecision | null {
  return request.taskType === "product_presence_judgment"
    || request.taskType === "visual_observation"
    || request.taskType === "visual_target_candidate_analysis"
    ? evaluateVisionPayloadBudget(request)
    : null;
}

function evaluateCommentTaskPayloadBudget(request: ParsedAiAbilityInput): PayloadBudgetDecision | null {
  if (request.taskType === "ocr_cleanup") {
    return evaluateCommentPayloadBudget(AiOcrCleanupInputSchema.parse(request.input).rawCommentBlocks);
  }
  return request.taskType === "comment_signal_summary"
    ? evaluateCommentPayloadBudget(AiCommentSignalSummaryInputSchema.parse(request.input).cleanedComments)
    : null;
}

function evaluateTaskPayloadBudget(request: ParsedAiAbilityInput): PayloadBudgetDecision {
  const observationDecision = evaluateObservationTaskPayloadBudget(request);
  if (observationDecision) {
    return observationDecision;
  }
  const commentDecision = evaluateCommentTaskPayloadBudget(request);
  if (commentDecision) {
    return commentDecision;
  }
  if (request.taskType === "product_signal_summary") {
    return evaluateProductSignalPayloadBudget(request);
  }
  if (request.taskType === "evidence_packet_analysis") {
    return evaluateEvidencePacketBudget(request);
  }
  return allow();
}

export function evaluateAiPayloadBudgetGate(request: ParsedAiAbilityInput): PayloadBudgetDecision {
  if (request.inputRefs.length > MAX_INPUT_REFS) {
    return blocked("payload_budget_input_refs_exceeded");
  }
  return evaluateTaskPayloadBudget(request);
}
