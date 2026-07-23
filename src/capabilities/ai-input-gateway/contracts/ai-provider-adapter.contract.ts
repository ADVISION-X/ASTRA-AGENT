import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { RuntimeLogger } from "../../../lib/runtime-logs/index.js";
import type {
  AiFeedInput,
  AiInputGatewayProviderKind,
} from "../schema.js";

export type AiProviderUploadedFileProof = {
  inputRefId: string;
  step: number;
  expectedAttachmentCount: number;
  detectedAttachmentCount: number;
  fileName: string;
  sha256: `sha256:${string}`;
  byteCount: number;
};

export type WebChatAttachmentTransportKind =
  | "skipped"
  | "ordered_clipboard"
  | "native_picker_batch";

export type WebChatAttachmentUploadProof = {
  childCapabilityId: "attach-approved-web-chat-files-once";
  uploadAttemptId: string;
  transportKind: WebChatAttachmentTransportKind;
  expectedFileCount: number;
  detectedFileCount: number;
  stagingManifestHash: `sha256:${string}` | null;
  files: Array<{
    inputRefId: string;
    order: number;
    sourceFileName: string;
    displayFileName: string;
    sha256: `sha256:${string}`;
    byteCount: number;
  }>;
  startedAt: string;
  endedAt: string;
  status: "skipped" | "attachments_stable" | "failed" | "review_required";
  failureReason: string | null;
  reviewRequiredReason: string | null;
};

export type AiProviderRawResponse = {
  rawText: string;
  modelName: string | null;
  runtimeName: string;
  transport: "api" | "web-chat";
  webChatUrl: string | null;
  continuationActualUrl?: string | null;
  continuationVerified?: boolean | null;
  sourcePageUrlBeforeFeed: string | null;
  restoredSourcePage: boolean | null;
  transportWarnings?: string[];
  uploadedFiles?: AiProviderUploadedFileProof[];
  attachmentUploadProof?: WebChatAttachmentUploadProof;
  outputRefs?: string[];
  providerTabPolicy?: string | null;
  providerRecoveryAttemptCount?: number | null;
  providerRecoveryStatus?: string | null;
  staleConversationCleanupStatus?: string | null;
  staleConversationHistoryCleanupStatus?: string | null;
  webChatWorkspaceId?: string | null;
  estimatedInputTokens?: number | null;
  estimatedOutputTokens?: number | null;
  tokenEstimateUnavailableReason?: string | null;
};

export type AiProviderAdapterContext = {
  dataDir: string;
  browser?: BrowserController;
  runtimeLogger?: RuntimeLogger;
  abortSignal?: AbortSignal;
  onAttachmentUploadCompleted?: (proof: WebChatAttachmentUploadProof) => Promise<void>;
};

export interface AiProviderAdapter {
  readonly providerKind: AiInputGatewayProviderKind;
  feed(input: AiFeedInput, context: AiProviderAdapterContext): Promise<AiProviderRawResponse>;
}
