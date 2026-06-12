import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { DeepResearchInputAttachment } from "../../plugins/deep-research-analysis/deep-research-analysis.public.js";
import { createId } from "./ids.js";
import type { DeepResearchInputAttachmentStagingFile } from "./workbench-handle.js";

const sanitizeDeepResearchAttachmentFileName = (fileName: string): string => {
  const baseName = path.basename(fileName).trim();
  const sanitized = baseName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  return sanitized.length > 0 ? sanitized : "attachment.bin";
};

const buildDeepResearchAttachmentFileHash = (bytes: Buffer): string =>
  "sha256:" + createHash("sha256").update(bytes).digest("hex");

const stageDeepResearchAttachmentFile = (input: {
  dataDir: string;
  batchId: string;
  index: number;
  file: DeepResearchInputAttachmentStagingFile;
}): DeepResearchInputAttachment => {
  const fileName = sanitizeDeepResearchAttachmentFileName(input.file.fileName);
  const attachmentDir = path.join(input.dataDir, "deep-research-analysis", "input-attachments", input.batchId);
  mkdirSync(attachmentDir, { recursive: true });
  const filePath = path.join(attachmentDir, `${input.index + 1}-${fileName}`);
  writeFileSync(filePath, input.file.bytes);
  return {
    id: createId("deep_research_input_attachment"),
    filePath,
    mimeType: input.file.contentType,
    summary: fileName,
    fileHash: buildDeepResearchAttachmentFileHash(input.file.bytes),
    fileSizeBytes: input.file.bytes.byteLength,
    sourceKind: "app-file-picker",
  };
};

export const buildDeepResearchAttachmentStagingHandle = (dataDir: string) => ({
  async stageDeepResearchAnalysisInputAttachments(input: {
    files: readonly DeepResearchInputAttachmentStagingFile[];
  }) {
    const batchId = createId("deep_research_input_attachment_batch");
    const attachments = input.files.slice(0, 3).map((file, index) =>
      stageDeepResearchAttachmentFile({
        dataDir,
        batchId,
        index,
        file,
      }),
    );
    return { attachments };
  },
});
