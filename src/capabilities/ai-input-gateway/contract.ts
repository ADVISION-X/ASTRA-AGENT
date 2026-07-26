import type {
  AiFeedResult,
  AiInputGatewayChildCapabilityId,
  AiInputGatewayProviderKind,
} from "./schema.js";
import type { AiProviderAdapter } from "./contracts/ai-provider-adapter.contract.js";
import type { WebChatAttachmentUploadProof } from "./contracts/ai-provider-adapter.contract.js";
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
  onAttachmentUploadCompleted?: (proof: WebChatAttachmentUploadProof) => Promise<void>;
};

export interface AiInputGatewayAbilityGroup {
  readonly abilityGroupId: AiInputGatewayAbilityGroupId;
  listChildCapabilityIds(): AiInputGatewayChildCapabilityId[];
  execute(input: unknown, options?: AiInputGatewayExecuteOptions): Promise<AiFeedResult>;
}
