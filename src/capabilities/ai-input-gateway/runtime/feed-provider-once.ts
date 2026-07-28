import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { RuntimeLogger } from "../../../lib/runtime-logs/index.js";
import type { AiInputGatewayProgress } from "../contract.js";
import type {
  AiProviderAdapter,
  AiProviderRawResponse,
  AiProviderUploadedFileProof,
  WebChatAttachmentUploadProof,
  WebChatExecutionContext,
} from "../contracts/ai-provider-adapter.contract.js";
import type {
  AiFeedInput,
  AiFeedResult,
  AiInputGatewayChildCapabilityId,
} from "../schema.js";
import {
  buildAiFeedInputPackage,
  buildResumedWebChatInputPackage,
  type AiFeedInputPackage,
} from "./ai-feed-input-package.js";
import {
  buildAiFeedFailure,
  buildAiFeedSuccess,
} from "./ai-feed-proof.js";
import { checkAiFeedRateGuard } from "./ai-feed-rate-guard.js";
import { prepareManagedWebChatExecution } from "./web-chat-managed-execution.js";
import { classifyWebChatFailure } from "../failure-classification.js";
import { readWebChatExecution } from "./web-chat-execution-state.js";

type ExecuteAiFeedOnceInput = {
  request: AiFeedInput;
  dataDir: string;
  childCapabilityId: AiInputGatewayChildCapabilityId;
  transport: "api" | "web-chat";
  adapter: AiProviderAdapter;
  browser?: BrowserController;
  runtimeLogger?: RuntimeLogger;
  signal?: AbortSignal;
  executionId?: string;
  webChatExecution?: WebChatExecutionContext;
  onAttachmentUploadCompleted?: (proof: WebChatAttachmentUploadProof) => Promise<void>;
  onProgress?: (progress: AiInputGatewayProgress) => Promise<void>;
};

const uploadedFilesFromError = (error: unknown): AiProviderUploadedFileProof[] => {
  if (typeof error !== "object" || error === null || !("uploadedFiles" in error)) return [];
  const files = (error as { uploadedFiles?: unknown }).uploadedFiles;
  if (!Array.isArray(files)) return [];
  return files.filter((file): file is AiProviderUploadedFileProof => (
    typeof file === "object"
    && file !== null
    && typeof (file as Partial<AiProviderUploadedFileProof>).inputRefId === "string"
    && typeof (file as Partial<AiProviderUploadedFileProof>).step === "number"
    && typeof (file as Partial<AiProviderUploadedFileProof>).fileName === "string"
    && typeof (file as Partial<AiProviderUploadedFileProof>).sha256 === "string"
    && typeof (file as Partial<AiProviderUploadedFileProof>).byteCount === "number"
  ));
};

const responseEvidenceFromError = (error: unknown): Partial<AiProviderRawResponse> | undefined => {
  const uploadedFiles = uploadedFilesFromError(error);
  const attachmentUploadProof = typeof error === "object"
    && error !== null
    && "attachmentUploadProof" in error
    ? (error as { attachmentUploadProof?: WebChatAttachmentUploadProof }).attachmentUploadProof
    : undefined;
  return uploadedFiles.length > 0 || attachmentUploadProof
    ? {
        ...(uploadedFiles.length > 0 ? { uploadedFiles } : {}),
        ...(attachmentUploadProof ? { attachmentUploadProof } : {}),
      }
    : undefined;
};

const buildRateGuardFailure = (input: {
  request: AiFeedInput;
  childCapabilityId: AiInputGatewayChildCapabilityId;
  inputPackage: AiFeedInputPackage;
  startedAt: string;
  transport: "api" | "web-chat";
  cooldownMs: number;
  reason: string | null;
}): AiFeedResult => buildAiFeedFailure({
    request: input.request,
    childCapabilityId: input.childCapabilityId,
    inputPackage: input.inputPackage,
    startedAt: input.startedAt,
    transport: input.transport,
    status: "review_required",
    reason: input.reason ?? "AI feed rate guard blocked request.",
    cooldownMs: input.cooldownMs,
    providerLeaseId: null,
  });

const buildProviderFailure = (input: {
  request: AiFeedInput;
  childCapabilityId: AiInputGatewayChildCapabilityId;
  inputPackage: AiFeedInputPackage;
  startedAt: string;
  transport: "api" | "web-chat";
  cooldownMs: number;
  error: unknown;
  providerLeaseId: string | null;
}): AiFeedResult => {
  const response = responseEvidenceFromError(input.error);
  return buildAiFeedFailure({
    request: input.request,
    childCapabilityId: input.childCapabilityId,
    inputPackage: input.inputPackage,
    startedAt: input.startedAt,
    transport: input.transport,
    status: classifyWebChatFailure(input.error, false) === "review_required"
      ? "review_required"
      : "failed",
    reason: input.error instanceof Error ? input.error.message : String(input.error),
    cooldownMs: input.cooldownMs,
    providerLeaseId: input.providerLeaseId,
    ...(response ? { response } : {}),
  });
};

const buildAdapterFeedContext = (input: ExecuteAiFeedOnceInput) => ({
  dataDir: input.dataDir,
  ...(input.browser ? { browser: input.browser } : {}),
  ...(input.runtimeLogger ? { runtimeLogger: input.runtimeLogger } : {}),
  ...(input.signal ? { abortSignal: input.signal } : {}),
  ...(input.webChatExecution ? { webChatExecution: input.webChatExecution } : {}),
  ...(input.onAttachmentUploadCompleted
    ? { onAttachmentUploadCompleted: input.onAttachmentUploadCompleted }
    : {}),
});

const executeProviderFeed = (
  input: ExecuteAiFeedOnceInput,
) => input.adapter.feed(input.request, buildAdapterFeedContext(input));

const buildProviderSuccess = async (input: {
  request: AiFeedInput;
  dataDir: string;
  childCapabilityId: AiInputGatewayChildCapabilityId;
  inputPackage: AiFeedInputPackage;
  startedAt: string;
  cooldownMs: number;
  response: Awaited<ReturnType<AiProviderAdapter["feed"]>>;
  providerLeaseId: string | null;
}): Promise<AiFeedResult> => {
  return buildAiFeedSuccess({
    dataDir: input.dataDir,
    request: input.request,
    childCapabilityId: input.childCapabilityId,
    inputPackage: input.inputPackage,
    response: input.response,
    startedAt: input.startedAt,
    cooldownMs: input.cooldownMs,
    providerLeaseId: input.providerLeaseId,
  });
};

const RESUMABLE_EXECUTION_STATUSES = new Set([
  "submitted_transient",
  "conversation_canonicalized",
  "waiting_provider",
  "response_checkpointed",
  "recovery_pending",
  "review_required",
]);

const prepareFeedInputPackage = async (
  input: ExecuteAiFeedOnceInput,
): Promise<{
  inputPackage: AiFeedInputPackage;
  resumed: boolean;
  rateGuardAlreadyRecorded: boolean;
}> => {
  const persisted =
    input.transport === "web-chat" && input.executionId
      ? await readWebChatExecution(input.dataDir, input.executionId)
      : null;
  const resumed = Boolean(
    persisted
    && RESUMABLE_EXECUTION_STATUSES.has(persisted.status)
    && persisted.submission
    && persisted.attachmentUploadProof,
  );
  const inputPackage = resumed
    ? await buildResumedWebChatInputPackage({
        request: input.request,
        dataDir: input.dataDir,
        persistedInputHash: persisted!.inputHash,
        attachmentUploadProof: persisted!.attachmentUploadProof!,
        uploadedFiles: persisted!.uploadedFiles,
      })
    : await buildAiFeedInputPackage(input.request);
  return {
    inputPackage,
    resumed,
    rateGuardAlreadyRecorded: resumed || persisted?.status === "recovery_pending",
  };
};

const executeManagedProvider = async (input: {
  execution: ExecuteAiFeedOnceInput;
  inputPackage: AiFeedInputPackage;
  startedAt: string;
  cooldownMs: number;
}): Promise<AiFeedResult> => {
  let managed: Awaited<ReturnType<typeof prepareManagedWebChatExecution>> | null = null;
  try {
    managed = await prepareManagedWebChatExecution(
      input.execution,
      input.inputPackage.inputHash,
    );
    const response = await executeProviderFeed({
      ...input.execution,
      request: managed.request,
      ...(managed.browser ? { browser: managed.browser } : {}),
      ...(managed.webChatExecution
        ? { webChatExecution: managed.webChatExecution }
        : {}),
    });
    await managed.markResponse(response.rawText);
    return await buildProviderSuccess({
      ...input.execution,
      inputPackage: input.inputPackage,
      startedAt: input.startedAt,
      cooldownMs: input.cooldownMs,
      providerLeaseId: managed.providerLeaseId,
      response,
    });
  } catch (error) {
    await managed?.markFailure(error);
    return buildProviderFailure({
      ...input.execution,
      inputPackage: input.inputPackage,
      startedAt: input.startedAt,
      cooldownMs: input.cooldownMs,
      providerLeaseId: managed?.providerLeaseId ?? null,
      error,
    });
  } finally {
    await managed?.release();
  }
};

export const executeAiFeedOnce = async (
  input: ExecuteAiFeedOnceInput,
): Promise<AiFeedResult> => {
  const startedAt = new Date().toISOString();
  const {
    inputPackage,
    rateGuardAlreadyRecorded,
  } = await prepareFeedInputPackage(input);
  const rate = rateGuardAlreadyRecorded
    ? { ok: true as const, cooldownMs: 0, reason: null }
    : checkAiFeedRateGuard({
        inputHash: inputPackage.inputHash,
        roundId: input.request.roundId,
        transport: input.transport,
      });
  if (!rate.ok) return buildRateGuardFailure({ ...input, inputPackage, startedAt, ...rate });
  return executeManagedProvider({
    execution: input,
    inputPackage,
    startedAt,
    cooldownMs: rate.cooldownMs,
  });
};
