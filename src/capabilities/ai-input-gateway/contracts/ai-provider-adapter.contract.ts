import type { BrowserFileArtifactGrantV1, BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import type { RuntimeLogger } from "../../../lib/runtime-logs/index.js";
import type {
  AiFeedInput,
  AiFeedProviderExecutionProfile,
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
  | "exact_target_file_input_batch";

export type WebChatAttachmentUploadProof = {
  childCapabilityId: "attach-approved-web-chat-files-once";
  uploadAttemptId: string;
  transportKind: WebChatAttachmentTransportKind;
  expectedFileCount: number;
  detectedFileCount: number;
  mutationSent: boolean;
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

export type ProviderExecutionProfileProof = {
  proofStatus: "verified";
  profileRef: string;
  profileHash: `sha256:${string}`;
  provider: "openai-chatgpt-web";
  transport: "gpt-web-chat";
  modelDisplayName: string;
  modelFamily: string;
  reasoningTier: AiFeedProviderExecutionProfile["reasoningTier"];
  reasoningUiLabel: string;
  observedAt: string;
  sourceKind: "provider_ui_observation";
  noOp: boolean;
  evidenceRef: string;
  evidenceHash: `sha256:${string}`;
};

export type WebChatConversationTitleStatus =
  | "pending"
  | "in_progress"
  | "verified"
  | "recovery_pending"
  | "review_required";

export type WebChatConversationTitleState = {
  owner: "agent_authoritative";
  policyVersion: "gpt-web-title-policy.v1";
  sourceMappingVersion: "gpt-web-title-mapping.v1";
  operatorTimeZone: "Asia/Dubai";
  expectedTitle: string;
  expectedTitleHash: `sha256:${string}`;
  shortTrace: string;
  status: WebChatConversationTitleStatus;
  previousObservedTitle: string | null;
  observedTitle: string | null;
  canonicalConversationUrl: string | null;
  attemptCount: number;
  verifiedAt: string | null;
  evidenceRef: string | null;
  evidenceHash: `sha256:${string}` | null;
};

export type WebChatConversationTitleProof = {
  proofStatus: "verified";
  owner: "agent_authoritative";
  policyVersion: "gpt-web-title-policy.v1";
  sourceMappingVersion: "gpt-web-title-mapping.v1";
  operatorTimeZone: "Asia/Dubai";
  expectedTitle: string;
  expectedTitleHash: `sha256:${string}`;
  shortTrace: string;
  previousObservedTitle: string | null;
  observedTitle: string;
  canonicalConversationUrl: string;
  verifiedAt: string;
  evidenceRef: string;
  evidenceHash: `sha256:${string}`;
};

export type WebChatPageActionId =
  | "acknowledge_known_rate_limit"
  | "dismiss_known_search_dialog"
  | "bind_exact_provider_target"
  | "establish_clean_fresh_chat"
  | "focus_exact_continuation"
  | "fork_exact_checkpoint"
  | "switch_exact_conversation"
  | "discover_conversation_via_search"
  | "observe_execution_profile"
  | "apply_execution_profile"
  | "verify_execution_profile"
  | "stage_approved_attachments"
  | "focus_exact_composer"
  | "write_exact_prompt"
  | "submit_exact_turn"
  | "poll_exact_assistant_turn"
  | "checkpoint_text_response"
  | "checkpoint_generated_image"
  | "rename_exact_conversation"
  | "verify_exact_conversation_title"
  | "cleanup_owned_transient_ui"
  | "restore_operator_source";

export type WebChatPageActionProof = {
  actionId: WebChatPageActionId;
  executionId: string | null;
  targetRefHash: string | null;
  documentRefHash: string | null;
  beforeUrl: string | null;
  afterUrl: string | null;
  candidateCount: number | null;
  semantics: string[];
  result: "committed" | "no_op" | "recovery_pending" | "review_required";
  startedAt: string;
  endedAt: string;
  allowDocumentChange: boolean;
  evidenceRef: string;
  evidenceHash: `sha256:${string}`;
};

export type WebChatSubmissionProof = {
  executionId?: string;
  turnMarker?: string;
  transientConversationUrl: string;
  canonicalConversationUrl: string | null;
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
  requestTextPrompt: string;
  turnMarker: string;
  submittedPromptHash: string;
  providerExecutionProfileBinding: AiFeedProviderExecutionProfile | null;
  providerExecutionProfileProof: ProviderExecutionProfileProof | null;
  /** True only while the persisted profile proof still binds this exact Target/Document. */
  providerExecutionProfileCheckpointCurrent?: boolean;
  conversationTitle: WebChatConversationTitleState | null;
  resumeSubmission: WebChatSubmissionProof | null;
  resumeUploadedFiles: AiProviderUploadedFileProof[];
  resumeAttachmentUploadProof: WebChatAttachmentUploadProof | null;
  resumeResponseCheckpoint: WebChatResponseCheckpoint | null;
  resumeForkActionProof: WebChatForkActionProof | null;
  globalBrowser: BrowserTargetLease | null;
  runExclusivePatrol<T>(
    operation: (browser: BrowserTargetLease) => Promise<T>,
  ): Promise<T>;
  onPageActionCommitted(proof: WebChatPageActionProof): Promise<void>;
  onProviderExecutionProfileVerified(proof: ProviderExecutionProfileProof): Promise<void>;
  onConversationTitleFinalizationStarted(canonicalConversationUrl: string): Promise<void>;
  onConversationTitleVerified(proof: WebChatConversationTitleProof): Promise<void>;
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
  onGeneratedImageCheckpointed(input: {
    outputHash: `sha256:${string}`;
    pageUrl: string;
  }): Promise<void>;
};

export type AiProviderRawResponse = {
  rawText: string;
  modelName: string | null;
  modelIdentityProof?: {
    proofStatus: "verified";
    modelFamily: string;
    modelDisplayName: string;
    modelIdentityStatus: "verified";
    reasoningEffort: string;
    observedAt: string;
    sourceKind: "provider_ui_observation" | "provider_api_response";
    evidenceRef: string;
    evidenceHash: `sha256:${string}`;
  } | null;
  providerExecutionProfileProof?: ProviderExecutionProfileProof | null;
  conversationTitleProof?: WebChatConversationTitleProof | null;
  providerTranscriptJsonl?: string | null;
  providerTranscriptHash?: `sha256:${string}` | null;
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
  browser?: BrowserTargetLease;
  /**
   * This narrow issuer is injected only by the Browser authority owner. It
   * accepts opaque artifact identities, never source or staged filesystem
   * paths, and lets the attachment child perform one exact-target batch.
   */
  registerBrowserFileArtifact?: (input: Readonly<{
    artifactRef: string;
    filePath: string;
    contentHash: `sha256:${string}`;
    sizeBytes: number;
  }>) => Promise<void>;
  issueBrowserFileArtifactGrant?: (input: Readonly<{
    artifactRef: string;
    expectedSha256: `sha256:${string}`;
    maxBytes: number;
  }>) => Promise<BrowserFileArtifactGrantV1>;
  runtimeLogger?: RuntimeLogger;
  abortSignal?: AbortSignal;
  onAttachmentUploadCompleted?: (proof: WebChatAttachmentUploadProof) => Promise<void>;
  webChatExecution?: WebChatExecutionContext;
};

export interface AiProviderAdapter {
  readonly providerKind: AiInputGatewayProviderKind;
  feed(input: AiFeedInput, context: AiProviderAdapterContext): Promise<AiProviderRawResponse>;
}
