import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  focusComposer,
  waitForComposerFocused,
  waitForExactAttachmentCount,
} from "./web-chat-page-actions.js";
import type {
  StagedWebChatAttachment,
  WebChatAttachmentTransportInput,
  WebChatAttachmentTransportResult,
} from "./web-chat-attachment-transport.js";

const CLIPBOARD_OPERATION_TIMEOUT_MS = 20_000;

const withTimeout = async <T>(label: string, timeoutMs: number, action: Promise<T>): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      action,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`review_required: ${label} timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const assertStagedFileIntegrity = async (file: StagedWebChatAttachment): Promise<void> => {
  const bytes = await readFile(file.stagedFilePath);
  const sha256 = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  if (bytes.byteLength !== file.byteCount || sha256 !== file.sha256) {
    throw new Error(`AI_ATTACHMENT_STAGING_INTEGRITY_MISMATCH:${file.inputRefId}`);
  }
};

export const attachByOrderedClipboard = async (
  input: WebChatAttachmentTransportInput,
): Promise<WebChatAttachmentTransportResult> => {
  const uploadedFiles: WebChatAttachmentTransportResult["uploadedFiles"] = [];
  for (const file of input.files) {
    await assertStagedFileIntegrity(file);
    await focusComposer(input.browser, input.context);
    await waitForComposerFocused(input.browser, input.context, 5_000);
    const pasteFile = input.browser.pasteFileFromSystemClipboard;
    if (!pasteFile) throw new Error("review_required: SYSTEM_CLIPBOARD_FOCUS_LEASE_UNAVAILABLE");
    await withTimeout(
      "ordered file clipboard paste",
      CLIPBOARD_OPERATION_TIMEOUT_MS,
      pasteFile.call(input.browser, {
        filePath: file.stagedFilePath,
        description: `paste approved attachment ${file.displayFileName}`,
        ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
      }),
    );
    const expectedFiles = input.files
      .slice(0, file.order)
      .map((candidate) => candidate.displayFileName);
    const evaluation = await waitForExactAttachmentCount(
      input.browser,
      input.context,
      file.order,
      expectedFiles,
      90_000,
      {
        expectedPageUrl: input.expectedPageUrl,
        baselineAttachmentCount: 0,
        requireReady: true,
      },
    );
    uploadedFiles.push({
      inputRefId: file.inputRefId,
      step: file.order,
      expectedAttachmentCount: input.files.length,
      detectedAttachmentCount: evaluation.attachmentCount ?? file.order,
      fileName: file.displayFileName,
      sha256: file.sha256,
      byteCount: file.byteCount,
    });
  }
  return {
    transportKind: "ordered_clipboard",
    uploadedFiles,
    detectedFileCount: uploadedFiles.length,
  };
};
