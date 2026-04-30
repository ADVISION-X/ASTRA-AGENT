import type { ParsedAiAbilityInput } from "../contract.js";
import { AiVisionRequestInputSchema } from "../schema.js";

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

function blocked(reason: string): PayloadBudgetDecision {
  return { decision: "blocked", reason, flags: [reason] };
}

export function evaluateAiPayloadBudgetGate(request: ParsedAiAbilityInput): PayloadBudgetDecision {
  if (request.inputRefs.length > MAX_INPUT_REFS) {
    return blocked("payload_budget_input_refs_exceeded");
  }

  switch (request.taskType) {
    case "product_presence_judgment":
    case "visual_observation":
    case "visual_target_candidate_analysis":
      {
        const visionInput = AiVisionRequestInputSchema.parse(request.input);
        if (visionInput.frameEvidenceIds.length > MAX_FRAME_REFS || visionInput.missingFrames.length > MAX_FRAME_REFS) {
          return blocked("payload_budget_frame_refs_exceeded");
        }
        if (visionInput.summary.length > MAX_PACKET_SUMMARY_LENGTH) {
          return blocked("payload_budget_summary_exceeded");
        }
        return { decision: "allow", reason: null, flags: [] };
      }
    case "ocr_cleanup":
      if (request.input.rawCommentBlocks.length > MAX_COMMENT_BLOCKS) {
        return blocked("payload_budget_comments_exceeded");
      }
      if (request.input.rawCommentBlocks.some((comment) => comment.length > MAX_COMMENT_LENGTH)) {
        return blocked("payload_budget_comment_length_exceeded");
      }
      return { decision: "allow", reason: null, flags: [] };
    case "comment_signal_summary":
      if (request.input.cleanedComments.length > MAX_COMMENT_BLOCKS) {
        return blocked("payload_budget_comments_exceeded");
      }
      if (request.input.cleanedComments.some((comment) => comment.length > MAX_COMMENT_LENGTH)) {
        return blocked("payload_budget_comment_length_exceeded");
      }
      return { decision: "allow", reason: null, flags: [] };
    case "product_signal_summary":
      if (request.input.videoSummary.length > MAX_PACKET_SUMMARY_LENGTH) {
        return blocked("payload_budget_summary_exceeded");
      }
      return { decision: "allow", reason: null, flags: [] };
    case "evidence_packet_analysis":
      if (request.input.packetSummary.length > MAX_PACKET_SUMMARY_LENGTH || request.input.evidenceIds.length > MAX_INPUT_REFS) {
        return blocked("payload_budget_packet_exceeded");
      }
      if (request.input.notes.length > MAX_NOTES || request.input.notes.some((note) => note.length > MAX_NOTE_LENGTH)) {
        return blocked("payload_budget_notes_exceeded");
      }
      return { decision: "allow", reason: null, flags: [] };
    case "schema_validation_only":
      return { decision: "allow", reason: null, flags: [] };
  }
}
