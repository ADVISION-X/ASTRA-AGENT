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
  clearComposer,
  readExactAttachmentState,
  waitForExactAttachmentCount,
} from "../providers/web-chat-upload-page-actions.js";
import { attachByExactTargetFileInputBatch } from "../providers/web-chat-exact-target-file-input-attachment.js";
import type {
  StagedWebChatAttachment,
  WebChatAttachmentTransportResult,
} from "../providers/web-chat-attachment-transport.js";
import { clearRecentChatGptBlockingDialog } from "../providers/web-chat-rate-limit-dialog.js";
import type { BrowserTargetSession } from "../../../lib/browser/browser-controller.js";

const ATTACHMENT_STABILITY_POLL_COUNT = 15;
const ATTACHMENT_STABILITY_POLL_MS = 2_000;
const ATTACHMENT_STABILITY_MAX_POLL_COUNT = 60;

export type AttachApprovedWebChatFilesResult = {
  uploadedFiles: AiProviderUploadedFileProof[];
  attachmentUploadProof: WebChatAttachmentUploadProof;
};

type AttachmentChildInput = {
  browser: BrowserTargetSession;
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
  const suffix = input.uploadAttemptId.replaceAll("-", "").slice(0, 8);
  const files: StagedWebChatAttachment[] = [];
  for (const [index, ref] of inputPackage.uploadableFiles.entries()) {
    const sourceBytes = await readFile(ref.filePath);
    if (sourceBytes.byteLength !== ref.byteCount || digest(sourceBytes) !== ref.sha256) {
      throw new Error(`AI_ATTACHMENT_SOURCE_CHANGED:${ref.id}`);
    }
    const order = index + 1;
    const extension = extname(ref.fileName).toLowerCase();
    const displayFileName = `${String(order).padStart(width, "0")}_${safeStem(ref.fileName)}_${suffix}${extension}`;
    const stagedFilePath = join(stagingDirectoryPath, displayFileName);
    await copyFile(ref.filePath, stagedFilePath, constants.COPYFILE_EXCL);
    const stagedBytes = await readFile(stagedFilePath);
    if (stagedBytes.byteLength !== ref.byteCount || digest(stagedBytes) !== ref.sha256) {
      throw new Error(`AI_ATTACHMENT_STAGING_INTEGRITY_MISMATCH:${ref.id}`);
    }
    files.push({
      inputRefId: ref.id,
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
    order: file.order,
    sourceFileName: file.sourceFileName,
    displayFileName: file.displayFileName,
    sha256: file.sha256,
    byteCount: file.byteCount,
  }))));
  return { stagingDirectoryPath, stagingManifestHash, files };
};

const waitForStableAttachmentSet = async (input: {
  browser: BrowserTargetSession;
  context: AiProviderAdapterContext;
  files: StagedWebChatAttachment[];
  expectedPageUrl: string;
}): Promise<number> => {
  let detectedFileCount = 0;
  let stablePollCount = 0;
  for (let poll = 0; poll < ATTACHMENT_STABILITY_MAX_POLL_COUNT; poll += 1) {
    await input.browser.wait(ATTACHMENT_STABILITY_POLL_MS);
    const evaluation = await readExactAttachmentState(
      input.browser,
      input.context,
      input.files.length,
      input.files.map((file) => file.displayFileName),
      {
        expectedPageUrl: input.expectedPageUrl,
        baselineAttachmentCount: 0,
        requireReady: true,
      },
    );
    if (evaluation.status === "review_required" || evaluation.status === "failed") {
      throw new Error(
        `${evaluation.message}; stable_poll=${poll + 1}; detected_count=${String(evaluation.attachmentCount ?? 0)}; detected_files=${evaluation.attachmentNames?.join("|") ?? ""}`,
      );
    }
    if (evaluation.status !== "success") {
      stablePollCount = 0;
      continue;
    }
    detectedFileCount = evaluation.attachmentCount ?? input.files.length;
    stablePollCount += 1;
    if (stablePollCount === ATTACHMENT_STABILITY_POLL_COUNT) {
      return detectedFileCount;
    }
  }
  throw new Error(
    `GPT_ATTACHMENT_STABILITY_TIMEOUT; required_polls=${ATTACHMENT_STABILITY_POLL_COUNT}; observed_continuous_polls=${stablePollCount}`,
  );
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
  && /review_required|AMBIGUOUS|UNAVAILABLE|NOT_READY|NOT_FOCUSED|SELECTION_UNPROVEN/iu.test(error.message);

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
  const cleared = await clearComposer(input.browser, input.context);
  if (cleared.status !== "success" || !cleared.pageUrl) {
    throw new Error(`review_required: WEB_CHAT_COMPOSER_CLEAR_ACTION_UNPROVEN; ${cleared.message}`);
  }
  state.expectedPageUrl = cleared.pageUrl;
  await waitForExactAttachmentCount(
    input.browser,
    input.context,
    0,
    [],
    10_000,
    {
      expectedPageUrl: state.expectedPageUrl,
      baselineAttachmentCount: 0,
      requireReady: false,
      requireComposerTextEmpty: true,
    },
  );
  state.transportResult = await attachByExactTargetFileInputBatch({
    ...input,
    stagingDirectoryPath: staged.stagingDirectoryPath,
    files: staged.files,
    expectedPageUrl: state.expectedPageUrl,
  });
  return waitForStableAttachmentSet({
    browser: input.browser,
    context: input.context,
    files: staged.files,
    expectedPageUrl: state.expectedPageUrl,
  });
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
    uploadedFiles: state.transportResult.uploadedFiles.map((file) => ({
      ...file,
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
    state.transportResult?.uploadedFiles ?? [],
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
