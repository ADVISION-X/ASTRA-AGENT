import type { DeepResearchGatewayInputRef } from "./deep-research-analysis.analysis-runner.js";
import type { DeepResearchInputAttachment } from "./deep-research-analysis.schema.js";

export const buildDeepResearchGatewayInputRefs = (input: {
  baseRefs: readonly string[];
  attachments: readonly DeepResearchInputAttachment[];
}): DeepResearchGatewayInputRef[] => [
  ...input.baseRefs,
  ...input.attachments.map((attachment) => ({
    id: attachment.id,
    kind: "user-attachment",
    summary: attachment.summary,
    filePath: attachment.filePath,
    ...(attachment.mimeType ? { mimeType: attachment.mimeType } : {}),
  })),
];

export const getDeepResearchInputAttachmentLimits = (
  attachments: readonly DeepResearchInputAttachment[],
): { maxFileCount: number; maxFileBytes: number } => ({
  maxFileCount: attachments.length,
  maxFileBytes: attachments.length > 0 ? 200_000_000 : 1,
});
