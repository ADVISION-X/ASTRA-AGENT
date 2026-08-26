import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import type {
  StagedWebChatAttachment,
  WebChatAttachmentTransportInput,
  WebChatAttachmentTransportResult,
} from "./web-chat-attachment-transport.js";

const assertStagedFileIntegrity = async (file: StagedWebChatAttachment): Promise<void> => {
  const bytes = await readFile(file.stagedFilePath);
  const sha256 = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  if (bytes.byteLength !== file.byteCount || sha256 !== file.sha256) {
    throw new Error(`AI_ATTACHMENT_STAGING_INTEGRITY_MISMATCH:${file.inputRefId}`);
  }
};

/** Filesystem paths remain inside the Browser authority boundary. The provider
 * receives only short-lived opaque grants and performs one fixed-selector batch.
 */
export const attachByExactTargetFileInputBatch = async (
  input: WebChatAttachmentTransportInput,
): Promise<WebChatAttachmentTransportResult> => {
  if (input.request.providerKind !== "gpt-web-chat") {
    throw new Error("review_required: EXACT_TARGET_FILE_INPUT_PROVIDER_NOT_APPROVED");
  }
  if (!input.context.registerBrowserFileArtifact
    || !input.context.issueBrowserFileArtifactGrant) {
    throw new Error("review_required: BROWSER_FILE_GRANT_INVALID");
  }
  await Promise.all(input.files.map(assertStagedFileIntegrity));
  if (input.files.length === 0) {
    return {
      transportKind: "exact_target_file_input_batch",
      mutationSent: false,
      detectedFileCount: 0,
    };
  }
  for (const file of input.files) {
    await input.context.registerBrowserFileArtifact({
      artifactRef: file.artifactRef,
      filePath: file.stagedFilePath,
      contentHash: file.sha256,
      sizeBytes: file.byteCount,
    });
  }
  const grants = await Promise.all(input.files.map((file) =>
    input.context.issueBrowserFileArtifactGrant!({
      artifactRef: file.artifactRef,
      expectedSha256: file.sha256,
      maxBytes: file.byteCount,
    })));
  await input.browser.attachFile({ selector: "#upload-files", grants });
  return {
    transportKind: "exact_target_file_input_batch",
    mutationSent: true,
    detectedFileCount: 0,
  };
};
