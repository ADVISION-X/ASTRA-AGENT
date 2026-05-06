export type AiInputProofSummary = {
  promptInputRef: string;
  aiInputArtifactRef: string;
  sourceScreenshotEvidenceId: string;
  sourceStorageRef: string;
  preparedImageHash: string;
  preparedImageWidth: number;
  preparedImageHeight: number;
  coordinateSpace: "ai_input_pixels";
};

const aiInputProofs = new Map<string, AiInputProofSummary>();

export function recordAiInputProofSummary(summary: AiInputProofSummary): void {
  aiInputProofs.set(summary.promptInputRef, summary);
}

export function resolveAiInputProofSummary(promptInputRef: string | null | undefined): AiInputProofSummary | null {
  return promptInputRef ? aiInputProofs.get(promptInputRef) ?? null : null;
}
