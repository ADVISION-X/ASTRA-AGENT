import type {
  AiFeedResult,
  AiInputGatewayChildCapabilityId,
  AiInputGatewayProviderKind,
} from "./schema.js";
import type { AiProviderAdapter } from "./contracts/ai-provider-adapter.contract.js";
import type { WebChatAttachmentUploadProof } from "./contracts/ai-provider-adapter.contract.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import type { BrowserTargetLease } from "../../lib/browser/browser-authority-api.js";
import type { WebChatPageActionProof } from "./contracts/ai-provider-adapter.contract.js";

type AiInputGatewayAbilityGroupId = "ai-input-gateway";

export type AiInputGatewayExecutionContext = {
  dataDir: string;
  runtimeLogger?: RuntimeLogger;
  adapters?: Partial<Record<AiInputGatewayProviderKind, AiProviderAdapter>>;
};

export type AiInputGatewaySubmissionAdmission = Readonly<{
  admissionRef: `sha256:${string}`;
  priorityKey: string;
}>;

export type AiInputGatewayExecuteOptions = {
  signal?: AbortSignal;
  browser?: BrowserTargetLease;
  executionId?: string;
  supersededExecutionId?: string;
  submissionAdmission?: AiInputGatewaySubmissionAdmission;
  onAttachmentUploadCompleted?: (proof: WebChatAttachmentUploadProof) => Promise<void>;
  onProgress?: (progress: AiInputGatewayProgress) => Promise<void>;
  onPageActionCommitted?: (proof: WebChatPageActionProof) => Promise<void>;
};

export type AiInputGatewayProgress = {
  phase:
    | "waiting_for_capacity"
    | "waiting_for_submit_slot"
    | "submitting"
    | "waiting_provider"
    | "response_checkpointed"
    | "title_finalization_pending"
    | "title_verified"
    | "recovery_pending"
    | "response_captured";
  occurredAt: string;
};

export interface AiInputGatewayAbilityGroup {
  readonly abilityGroupId: AiInputGatewayAbilityGroupId;
  listChildCapabilityIds(): AiInputGatewayChildCapabilityId[];
  getRuntimeCapacity(): number;
  releaseProviderTargetForOperator?(ownerKey: string): Promise<boolean>;
  resumeProviderTargetAfterOperator?(ownerKey: string): void;
  close?(): Promise<void>;
  classifyFailure?(
    error: unknown,
    hasDurableSubmission: boolean,
  ): "recovery_pending" | "review_required" | "failed";
  recoverCheckpointedProviderLease?(input: {
    executionId: string;
    expectedInputHash: string;
    expectedOutputHash: string;
  }): Promise<string | null>;
  execute(input: unknown, options?: AiInputGatewayExecuteOptions): Promise<AiFeedResult>;
}
