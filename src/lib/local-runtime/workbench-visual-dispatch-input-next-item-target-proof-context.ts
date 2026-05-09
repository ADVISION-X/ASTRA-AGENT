import { resolveAiVisualTargetCandidateOutputSummary } from "../../capabilities/ai/index.js";
import { resolveAbilityResultProofSummary } from "../../capabilities/orchestration/index.js";
import { payloadValueToString } from "./workbench-payload.js";
import type { DispatchPayloadRecord } from "./workbench-action-dispatch-shared.js";
import { buildAiInputScaleMapping } from "./workbench-visual-dispatch-input-next-item-target-support.js";

const resolveNextItemAiSummary = (aiTargetCandidateRef: string | null) =>
  resolveAiVisualTargetCandidateOutputSummary(aiTargetCandidateRef);

const resolveNextItemAiInputContext = (input: {
  aiSummary: NonNullable<ReturnType<typeof resolveNextItemAiSummary>>;
  payload: DispatchPayloadRecord;
}) => {
  const aiInputArtifactRef = input.aiSummary.aiInputArtifactRef
    ?? payloadValueToString(input.payload.promptInputRef)
    ?? payloadValueToString(input.payload.nextItemVerificationPromptInputRef)
    ?? `${input.aiSummary.aiResultRef}:prompt-input`;
  const aiInputProofSummary = resolveAbilityResultProofSummary(aiInputArtifactRef);
  return {
    aiInputArtifactRef,
    aiInputScaleMapping: buildAiInputScaleMapping(aiInputProofSummary),
  };
};

export { resolveNextItemAiInputContext, resolveNextItemAiSummary };