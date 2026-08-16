import type {
  AiFeedResult,
  AiInputGatewayChildCapabilityId,
  AiInputGatewayProviderKind,
} from "./schema.js";
import type { AiProviderAdapter } from "./contracts/ai-provider-adapter.contract.js";
import type { WebChatAttachmentUploadProof } from "./contracts/ai-provider-adapter.contract.js";
import type { AiProviderUploadedFileProof } from "./contracts/ai-provider-adapter.contract.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";

type AiInputGatewayAbilityGroupId = "ai-input-gateway";

export type AiInputGatewayExecutionContext = {
  dataDir: string;
  runtimeLogger?: RuntimeLogger;
  adapters?: Partial<Record<AiInputGatewayProviderKind, AiProviderAdapter>>;
};

export type AiInputGatewayExecuteOptions = {
  signal?: AbortSignal;
  executionId?: string;
  supersededExecutionId?: string;
  onAttachmentUploadCompleted?: (proof: WebChatAttachmentUploadProof) => Promise<void>;
  onProgress?: (progress: AiInputGatewayProgress) => Promise<void>;
};

export type AiInputGatewayProgress = {
  phase:
    | "waiting_for_capacity"
    | "waiting_for_submit_slot"
    | "submitting"
    | "waiting_provider"
    | "response_checkpointed"
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
  preflightApprovedWebChatFiles?(
    input: unknown,
    options?: Pick<AiInputGatewayExecuteOptions, "signal">,
  ): Promise<{
    uploadedFiles: AiProviderUploadedFileProof[];
    attachmentUploadProof: WebChatAttachmentUploadProof;
  }>;
  execute(input: unknown, options?: AiInputGatewayExecuteOptions): Promise<AiFeedResult>;
}
