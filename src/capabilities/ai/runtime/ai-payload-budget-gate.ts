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
  if (request.input.packetSummary.length > MAX_PACKET_SUMMARY_LENGTH || request.input.evidenceIds.length > MAX_INPUT_REFS) {
    return blocked("payload_budget_packet_exceeded");
  }
  if (request.input.notes.length > MAX_NOTES || hasOversizedText(request.input.notes, MAX_NOTE_LENGTH)) {
    return blocked("payload_budget_notes_exceeded");
  }
  return allow();
}

const PAYLOAD_BUDGET_HANDLERS = {
  product_presence_judgment: evaluateVisionPayloadBudget,
  visual_observation: evaluateVisionPayloadBudget,
  visual_target_candidate_analysis: evaluateVisionPayloadBudget,
  ocr_cleanup: (request: ParsedAiAbilityInput) => evaluateCommentPayloadBudget(request.input.rawCommentBlocks),
  comment_signal_summary: (request: ParsedAiAbilityInput) => evaluateCommentPayloadBudget(request.input.cleanedComments),
  product_signal_summary: (request: ParsedAiAbilityInput) =>
    request.input.videoSummary.length > MAX_PACKET_SUMMARY_LENGTH ? blocked("payload_budget_summary_exceeded") : allow(),
  evidence_packet_analysis: evaluateEvidencePacketBudget,
  schema_validation_only: () => allow(),
} as const;

export function evaluateAiPayloadBudgetGate(request: ParsedAiAbilityInput): PayloadBudgetDecision {
  if (request.inputRefs.length > MAX_INPUT_REFS) {
    return blocked("payload_budget_input_refs_exceeded");
  }

  return PAYLOAD_BUDGET_HANDLERS[request.taskType](request);
}
