import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import type { WebChatEvaluation } from "./web-chat-evaluation-contract.js";
import { waitForExactAttachmentCount } from "./web-chat-page-actions.js";
import type {
  StagedWebChatAttachment,
  WebChatAttachmentTransportInput,
  WebChatAttachmentTransportResult,
} from "./web-chat-attachment-transport.js";

const CHATGPT_DOCUMENT_FILE_INPUT_SELECTOR = "#upload-files";

const assertStagedFileIntegrity = async (file: StagedWebChatAttachment): Promise<void> => {
  const bytes = await readFile(file.stagedFilePath);
  const sha256 = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  if (bytes.byteLength !== file.byteCount || sha256 !== file.sha256) {
    throw new Error(`AI_ATTACHMENT_STAGING_INTEGRITY_MISMATCH:${file.inputRefId}`);
  }
};

const buildLocateChatGptDocumentFileInputScript = (expectedPageUrl: string): string => `
const expectedPageUrl = ${JSON.stringify(expectedPageUrl)};
if (location.href !== expectedPageUrl) {
  return {status: "review_required", message: "WEB_CHAT_PROVIDER_IDENTITY_DRIFT", pageUrl: location.href};
}
const candidates = Array.from(document.querySelectorAll(${JSON.stringify(CHATGPT_DOCUMENT_FILE_INPUT_SELECTOR)}));
if (candidates.length !== 1) {
  return {status: "review_required", message: "CHATGPT_DOCUMENT_FILE_INPUT_AMBIGUOUS", pageUrl: location.href, candidateCount: candidates.length};
}
const input = candidates[0];
if (!(input instanceof HTMLInputElement) || input.type !== "file" || input.disabled || !input.isConnected) {
  return {status: "review_required", message: "CHATGPT_DOCUMENT_FILE_INPUT_INVALID", pageUrl: location.href, candidateCount: candidates.length};
}
if (!input.multiple) {
  return {status: "review_required", message: "CHATGPT_DOCUMENT_FILE_INPUT_NOT_MULTIPLE", pageUrl: location.href, candidateCount: candidates.length};
}
const accept = (input.getAttribute("accept") || "").trim().toLowerCase();
if (accept && accept.split(",").every((value) => value.trim().startsWith("image/"))) {
  return {status: "review_required", message: "CHATGPT_DOCUMENT_FILE_INPUT_IMAGE_ONLY", pageUrl: location.href, candidateCount: candidates.length};
}
return {
  status: "success",
  message: "ChatGPT exact document file input ready",
  pageUrl: location.href,
  candidateCount: candidates.length,
};
`;

export const attachByExactTargetFileInputBatch = async (
  input: WebChatAttachmentTransportInput,
): Promise<WebChatAttachmentTransportResult> => {
  if (input.request.providerKind !== "gpt-web-chat") {
    throw new Error("review_required: EXACT_TARGET_FILE_INPUT_PROVIDER_NOT_APPROVED");
  }
  await Promise.all(input.files.map(assertStagedFileIntegrity));
  const topology = await input.browser.evaluate<WebChatEvaluation & { candidateCount?: number }>({
    description: "locate the unique ChatGPT document file input",
    script: buildLocateChatGptDocumentFileInputScript(input.expectedPageUrl),
    ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
  });
  if (topology.status !== "success" || topology.candidateCount !== 1) {
    throw new Error(`review_required: ${topology.message}`);
  }
  const uploadedFiles: WebChatAttachmentTransportResult["uploadedFiles"] = [];
  let detectedFileCount = 0;
  for (const file of input.files) {
    const mutation = await input.browser.setFileInputFiles({
      elementRef: {
        selector: CHATGPT_DOCUMENT_FILE_INPUT_SELECTOR,
        targetKind: "file-input",
      },
      filePath: file.stagedFilePath,
      description: `set approved attachment ${file.displayFileName} on the ChatGPT document file input`,
      ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
    });
    if (!mutation.ok) {
      throw new Error(`review_required: CHATGPT_DOCUMENT_FILE_INPUT_MUTATION_FAILED; ${mutation.message}`);
    }
    const expectedNames = input.files.slice(0, file.order).map((item) => item.displayFileName);
    const evaluation = await waitForExactAttachmentCount(
      input.browser,
      input.context,
      file.order,
      expectedNames,
      120_000,
      {
        expectedPageUrl: input.expectedPageUrl,
        baselineAttachmentCount: 0,
        requireReady: true,
      },
    );
    detectedFileCount = evaluation.attachmentCount ?? file.order;
    uploadedFiles.push({
      inputRefId: file.inputRefId,
      step: file.order,
      expectedAttachmentCount: file.order,
      detectedAttachmentCount: detectedFileCount,
      fileName: file.displayFileName,
      sha256: file.sha256,
      byteCount: file.byteCount,
    });
  }
  return {
    transportKind: "exact_target_file_input_batch",
    detectedFileCount,
    uploadedFiles,
  };
};
