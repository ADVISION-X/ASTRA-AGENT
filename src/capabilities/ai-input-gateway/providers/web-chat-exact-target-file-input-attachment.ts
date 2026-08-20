import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { readExactAttachmentState } from "./web-chat-upload-page-actions.js";
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

/**
 * The public contract never carries a filesystem path.  Until attachment
 * chips, file names and the required stability window are observed in a real
 * production session, this candidate admits no file-selection side effect.
 */
export const attachByExactTargetFileInputBatch = async (
  input: WebChatAttachmentTransportInput,
): Promise<WebChatAttachmentTransportResult> => {
  if (input.request.providerKind !== "gpt-web-chat") {
    throw new Error("review_required: EXACT_TARGET_FILE_INPUT_PROVIDER_NOT_APPROVED");
  }
  if (!input.context.issueBrowserFileArtifactGrant) {
    throw new Error("review_required: BROWSER_FILE_GRANT_INVALID");
  }
  await Promise.all(input.files.map(assertStagedFileIntegrity));
  const preflight = await readExactAttachmentState(
    input.browser,
    input.context,
    0,
    [],
    { expectedPageUrl: input.expectedPageUrl, requireComposerTextEmpty: true },
  );
  if (preflight.status !== "success") throw new Error(`review_required: ${preflight.message}`);
  if (input.files.length === 0) {
    return {
      transportKind: "exact_target_file_input_batch",
      uploadedFiles: [],
      detectedFileCount: 0,
    };
  }
  throw new Error(
    "review_required: NOT_PRODUCTION_VERIFIED: exact ChatGPT attachment chips, names and thirty-second stability must be observed before any file-selection side effect is admitted",
  );
};
