import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { extname, join, parse } from "node:path";

import type {
  AiProviderAdapterContext,
  AiProviderUploadedFileProof,
  WebChatAttachmentUploadProof,
} from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import { buildAiFeedInputPackage } from "../runtime/ai-feed-input-package.js";
import {
  observeExactAttachmentSet,
  readExactAttachmentState,
} from "../providers/web-chat-upload-page-actions.js";
import { attachByExactTargetFileInputBatch } from "../providers/web-chat-exact-target-file-input-attachment.js";
import type {
  AttachmentMutationBrowser,
  StagedWebChatAttachment,
  WebChatAttachmentTransportResult,
} from "../providers/web-chat-attachment-transport.js";
import { clearRecentChatGptBlockingDialog } from "../providers/web-chat-rate-limit-dialog.js";

export type AttachApprovedWebChatFilesResult = {
  uploadedFiles: AiProviderUploadedFileProof[];
  attachmentUploadProof: WebChatAttachmentUploadProof;
};

type AttachmentChildInput = {
  browser: AttachmentMutationBrowser;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
};

type AttachmentAttemptState = {
  startedAt: string;
  uploadAttemptId: string;
  expectedFileCount: number;
  transportKind: WebChatAttachmentUploadProof["transportKind"];
  stagingDirectoryPath: string | null;
  stagingManifestHash: `sha256:${string}` | null;
  files: StagedWebChatAttachment[];
  transportResult: WebChatAttachmentTransportResult | null;
  expectedPageUrl: string | null;
};

export class WebChatAttachmentCapabilityFailure extends Error {
  readonly uploadedFiles: AiProviderUploadedFileProof[];
  readonly attachmentUploadProof: WebChatAttachmentUploadProof;

  constructor(
    message: string,
    attachmentUploadProof: WebChatAttachmentUploadProof,
    uploadedFiles: AiProviderUploadedFileProof[] = [],
  ) {
    super(message);
    this.name = "WebChatAttachmentCapabilityFailure";
    this.uploadedFiles = uploadedFiles;
    this.attachmentUploadProof = attachmentUploadProof;
  }
}

const digest = (value: string | Buffer): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const safeStem = (fileName: string): string => {
  const normalized = parse(fileName).name
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  return (normalized || "attachment").slice(0, 80);
};

const stageApprovedFiles = async (input: {
  request: AiFeedInput;
  dataDir: string;
  uploadAttemptId: string;
}): Promise<{
  stagingDirectoryPath: string;
  stagingManifestHash: `sha256:${string}`;
  files: StagedWebChatAttachment[];
}> => {
  const inputPackage = await buildAiFeedInputPackage(input.request);
  const stagingDirectoryPath = join(
    input.dataDir,
    "runtime-data",
    "ai-input-gateway",
    "upload-attempts",
    input.uploadAttemptId,
  );
  await mkdir(stagingDirectoryPath, { recursive: true });
  const width = Math.max(3, String(inputPackage.uploadableFiles.length).length);
  const files: StagedWebChatAttachment[] = [];
  for (const [index, ref] of inputPackage.uploadableFiles.entries()) {
    const sourceBytes = await readFile(ref.filePath);
    if (sourceBytes.byteLength !== ref.byteCount || digest(sourceBytes) !== ref.sha256) {
      throw new Error(`AI_ATTACHMENT_SOURCE_CHANGED:${ref.id}`);
    }
    const order = index + 1;
    const extension = extname(ref.fileName).toLowerCase();
    const displayFileName = `${String(order).padStart(width, "0")}_${safeStem(ref.fileName)}${extension}`;
    const stagedFilePath = join(stagingDirectoryPath, displayFileName);
    await copyFile(ref.filePath, stagedFilePath, constants.COPYFILE_EXCL);
    const stagedBytes = await readFile(stagedFilePath);
    if (stagedBytes.byteLength !== ref.byteCount || digest(stagedBytes) !== ref.sha256) {
      throw new Error(`AI_ATTACHMENT_STAGING_INTEGRITY_MISMATCH:${ref.id}`);
    }
    files.push({
      inputRefId: ref.id,
      artifactRef: `ai-input:${ref.id}:${ref.sha256}`,
      order,
      sourceFileName: ref.fileName,
      displayFileName,
      stagedFilePath,
      sha256: ref.sha256,
      byteCount: ref.byteCount,
    });
  }
  const observedNames = (await readdir(stagingDirectoryPath)).sort();
  const expectedNames = files.map((file) => file.displayFileName).sort();
  if (JSON.stringify(observedNames) !== JSON.stringify(expectedNames)) {
    throw new Error(`AI_ATTACHMENT_STAGING_SET_MISMATCH; expected=${expectedNames.join("|")}; observed=${observedNames.join("|")}`);
  }
  const stagingManifestHash = digest(JSON.stringify(files.map((file) => ({
    inputRefId: file.inputRefId,
    artifactRef: file.artifactRef,
    order: file.order,
    sourceFileName: file.sourceFileName,
    displayFileName: file.displayFileName,
    sha256: file.sha256,
    byteCount: file.byteCount,
  }))));
  return { stagingDirectoryPath, stagingManifestHash, files };
};

const toProofFiles = (files: StagedWebChatAttachment[]): WebChatAttachmentUploadProof["files"] =>
  files.map((file) => ({
    inputRefId: file.inputRefId,
    order: file.order,
    sourceFileName: file.sourceFileName,
    displayFileName: file.displayFileName,
    sha256: file.sha256,
    byteCount: file.byteCount,
  }));

const isReviewRequired = (error: unknown): boolean =>
  error instanceof Error
  && /review_required|AMBIGUOUS|UNAVAILABLE|NOT_READY|NOT_FOCUSED|SELECTION_UNPROVEN|BROWSER_OUTCOME_UNKNOWN/iu.test(error.message);

export const resolveWebChatAttachmentTransportKind = (input: {
  providerKind: AiFeedInput["providerKind"];
  fileCount: number;
}): "skipped" | "exact_target_file_input_batch" => {
  if (input.fileCount === 0) return "skipped";
  if (input.providerKind !== "gpt-web-chat") {
    throw new Error("review_required: EXACT_TARGET_FILE_INPUT_PROVIDER_NOT_APPROVED");
  }
  return "exact_target_file_input_batch";
};

const completeSkippedAttempt = async (
  input: AttachmentChildInput,
  state: AttachmentAttemptState,
): Promise<AttachApprovedWebChatFilesResult> => {
  const attachmentUploadProof: WebChatAttachmentUploadProof = {
    childCapabilityId: "attach-approved-web-chat-files-once",
    uploadAttemptId: state.uploadAttemptId,
    transportKind: "skipped",
    expectedFileCount: 0,
    detectedFileCount: 0,
    mutationSent: false,
    stagingManifestHash: null,
    files: [],
    startedAt: state.startedAt,
    endedAt: new Date().toISOString(),
    status: "skipped",
    failureReason: null,
    reviewRequiredReason: null,
  };
  await input.context.onAttachmentUploadCompleted?.(attachmentUploadProof);
  return { uploadedFiles: [], attachmentUploadProof };
};

const performAttachmentTransport = async (
  input: AttachmentChildInput,
  state: AttachmentAttemptState,
): Promise<number> => {
  const staged = await stageApprovedFiles({
    request: input.request,
    dataDir: input.context.dataDir,
    uploadAttemptId: state.uploadAttemptId,
  });
  state.stagingDirectoryPath = staged.stagingDirectoryPath;
  state.stagingManifestHash = staged.stagingManifestHash;
  state.files = staged.files;
  clearRecentChatGptBlockingDialog();
  const expectedNames = staged.files.map((file) => file.displayFileName);
  const prepared = await readExactAttachmentState(
    input.browser,
    input.context,
    staged.files.length,
    expectedNames,
    { requireComposerTextEmpty: true },
  );
  if (prepared.status === "success" && prepared.pageUrl) {
    state.expectedPageUrl = prepared.pageUrl;
      state.transportResult = {
        transportKind: "exact_target_file_input_batch",
        mutationSent: false,
        detectedFileCount: staged.files.length,
    };
    return staged.files.length;
  }
  if (prepared.status !== "pending"
    || prepared.message !== "CHATGPT_ATTACHMENT_SURFACE_EMPTY"
    || !prepared.pageUrl) {
    throw new Error(`review_required: WEB_CHAT_ATTACHMENT_PRECONDITION_UNPROVEN; ${prepared.message}`);
  }
  state.expectedPageUrl = prepared.pageUrl;
  state.transportResult = await attachByExactTargetFileInputBatch({
    ...input,
    stagingDirectoryPath: staged.stagingDirectoryPath,
    files: staged.files,
    expectedPageUrl: state.expectedPageUrl,
  });
  const postcondition = await observeExactAttachmentSet(
    input.browser,
    input.context,
    staged.files.length,
    expectedNames,
    {
      expectedPageUrl: state.expectedPageUrl,
    },
  );
  return postcondition.attachmentCount ?? staged.files.length;
};

const completeSuccessfulAttempt = async (
  input: AttachmentChildInput,
  state: AttachmentAttemptState,
  detectedFileCount: number,
): Promise<AttachApprovedWebChatFilesResult> => {
  if (!state.transportResult) throw new Error("AI_ATTACHMENT_TRANSPORT_RESULT_MISSING");
  const attachmentUploadProof: WebChatAttachmentUploadProof = {
    childCapabilityId: "attach-approved-web-chat-files-once",
    uploadAttemptId: state.uploadAttemptId,
    transportKind: state.transportResult.transportKind,
    expectedFileCount: state.files.length,
    detectedFileCount,
    mutationSent: state.transportResult.mutationSent,
    stagingManifestHash: state.stagingManifestHash,
    files: toProofFiles(state.files),
    startedAt: state.startedAt,
    endedAt: new Date().toISOString(),
    status: "attachments_stable",
    failureReason: null,
    reviewRequiredReason: null,
  };
  await input.context.onAttachmentUploadCompleted?.(attachmentUploadProof);
  return {
    uploadedFiles: state.files.map((file) => ({
      inputRefId: file.inputRefId,
      step: file.order,
      fileName: file.displayFileName,
      sha256: file.sha256,
      byteCount: file.byteCount,
      expectedAttachmentCount: state.files.length,
      detectedAttachmentCount: detectedFileCount,
    })),
    attachmentUploadProof,
  };
};

const failAttachmentAttempt = async (
  input: AttachmentChildInput,
  state: AttachmentAttemptState,
  error: unknown,
): Promise<never> => {
  const message = error instanceof Error ? error.message : String(error);
  const reviewRequired = isReviewRequired(error);
  const attachmentUploadProof: WebChatAttachmentUploadProof = {
    childCapabilityId: "attach-approved-web-chat-files-once",
    uploadAttemptId: state.uploadAttemptId,
    transportKind: state.transportKind,
    expectedFileCount: state.expectedFileCount,
    detectedFileCount: state.transportResult?.detectedFileCount ?? 0,
    mutationSent: state.transportResult?.mutationSent === true
      || /\bBROWSER_OUTCOME_UNKNOWN\b/iu.test(message),
    stagingManifestHash: state.stagingManifestHash,
    files: toProofFiles(state.files),
    startedAt: state.startedAt,
    endedAt: new Date().toISOString(),
    status: reviewRequired ? "review_required" : "failed",
    failureReason: reviewRequired ? null : message,
    reviewRequiredReason: reviewRequired ? message : null,
  };
  await input.context.onAttachmentUploadCompleted?.(attachmentUploadProof);
  throw new WebChatAttachmentCapabilityFailure(
    message,
    attachmentUploadProof,
  );
};

export const attachApprovedWebChatFilesOnce = async (
  input: AttachmentChildInput,
): Promise<AttachApprovedWebChatFilesResult> => {
  const inputPackage = await buildAiFeedInputPackage(input.request);
  const state: AttachmentAttemptState = {
    startedAt: new Date().toISOString(),
    uploadAttemptId: randomUUID(),
    expectedFileCount: inputPackage.uploadableFiles.length,
    transportKind: resolveWebChatAttachmentTransportKind({
      providerKind: input.request.providerKind,
      fileCount: inputPackage.uploadableFiles.length,
    }),
    stagingDirectoryPath: null,
    stagingManifestHash: null,
    files: [],
    transportResult: null,
    expectedPageUrl: null,
  };
  if (inputPackage.uploadableFiles.length === 0) {
    return completeSkippedAttempt(input, state);
  }
  if (input.request.providerKind === "gemini-api") {
    throw new Error("review_required: WEB_CHAT_ATTACHMENT_PROVIDER_REQUIRED");
  }
  try {
    const detectedFileCount = await performAttachmentTransport(input, state);
    return await completeSuccessfulAttempt(input, state, detectedFileCount);
  } catch (error) {
    return await failAttachmentAttempt(input, state, error);
  } finally {
    if (state.stagingDirectoryPath) {
      await rm(state.stagingDirectoryPath, { recursive: true, force: true });
    }
  }
};
