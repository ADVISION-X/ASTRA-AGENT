import type { BrowserTargetSession } from "../../../lib/browser/browser-controller.js";
import type { RuntimeLogger } from "../../../lib/runtime-logs/index.js";
import type {
  AiFeedInput,
  AiInputGatewayProviderKind,
} from "../schema.js";
import type { WebChatResponseCheckpoint } from "../runtime/web-chat-response-checkpoint.js";

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

export type WebChatSubmissionProof = {
  executionId?: string;
  turnMarker?: string;
  transientConversationUrl: string;
  canonicalConversationUrl: string | null;
  systemChatTitle: string | null;
  observedAutoChatTitle: string | null;
  chatTitleVerifiedAt: string | null;
  userTurnId: string;
  previousAssistantCount: number;
  previousUserMessageCount: number;
  submittedAt: string;
};

export type WebChatForkActionProof = {
  mode: "forked_from_checkpoint";
  parentConversationUrl: string;
  parentCheckpointTurnMarker: string;
  parentCheckpointResponseHash: `sha256:${string}`;
  forkActionEvidenceRef: string;
  forkActionEvidenceHash: `sha256:${string}`;
  childConversationUrl: string;
  childInitialHistoryFingerprint: `sha256:${string}`;
  verifiedAt: string;
};

export type WebChatExecutionContext = {
  executionId: string;
  attemptId: string;
  providerKind: "gpt-web-chat" | "gemini-web-chat";
  systemChatTitle: string | null;
  turnMarker: string;
  submittedPromptHash: string;
  resumeSubmission: WebChatSubmissionProof | null;
  resumeUploadedFiles: AiProviderUploadedFileProof[];
  resumeAttachmentUploadProof: WebChatAttachmentUploadProof | null;
  resumeResponseCheckpoint: WebChatResponseCheckpoint | null;
  resumeForkActionProof: WebChatForkActionProof | null;
  globalBrowser: BrowserTargetSession | null;
  runExclusivePatrol<T>(
    operation: (browser: BrowserTargetSession) => Promise<T>,
  ): Promise<T>;
  onSubmissionObserved(input: {
    submission: WebChatSubmissionProof;
    uploadedFiles: AiProviderUploadedFileProof[];
    attachmentUploadProof: WebChatAttachmentUploadProof;
  }): Promise<void>;
  onSubmitted(input: {
    submission: WebChatSubmissionProof;
    uploadedFiles: AiProviderUploadedFileProof[];
    attachmentUploadProof: WebChatAttachmentUploadProof;
  }): Promise<void>;
  onConversationCanonicalized(submission: WebChatSubmissionProof): Promise<void>;
  onForkActionObserved(proof: WebChatForkActionProof): Promise<void>;
  onResponseCaptured(input: {
    answerText: string;
    pageUrl: string;
  }): Promise<WebChatResponseCheckpoint>;
};

export type AiProviderRawResponse = {
  rawText: string;
  modelName: string | null;
  runtimeName: string;
  transport: "api" | "web-chat";
  webChatUrl: string | null;
  continuationActualUrl?: string | null;
  continuationVerified?: boolean | null;
  forkActionProof?: WebChatForkActionProof | null;
  submissionProof?: WebChatSubmissionProof | null;
  sourcePageUrlBeforeFeed: string | null;
  restoredSourcePage: boolean | null;
  transportWarnings?: string[];
  uploadedFiles?: AiProviderUploadedFileProof[];
  attachmentUploadProof?: WebChatAttachmentUploadProof;
  outputRefs?: string[];
  outputArtifacts?: Array<{
    kind: "generated_image";
    artifactRef: string;
    filePath: string;
    mimeType: string;
    sha256: `sha256:${string}`;
    originalSha256: `sha256:${string}`;
    providerOutputRef: string;
    byteCount: number;
    width: number;
    height: number;
  }>;
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
  browser?: BrowserTargetSession;
  runtimeLogger?: RuntimeLogger;
  abortSignal?: AbortSignal;
  onAttachmentUploadCompleted?: (proof: WebChatAttachmentUploadProof) => Promise<void>;
  webChatExecution?: WebChatExecutionContext;
};

export interface AiProviderAdapter {
  readonly providerKind: AiInputGatewayProviderKind;
  feed(input: AiFeedInput, context: AiProviderAdapterContext): Promise<AiProviderRawResponse>;
}
