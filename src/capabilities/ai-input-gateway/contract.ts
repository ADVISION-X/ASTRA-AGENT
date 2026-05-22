import type {
  AiFeedResult,
  AiInputGatewayChildCapabilityId,
  AiInputGatewayProviderKind,
} from "./schema.js";
import type { AiProviderAdapter } from "./contracts/ai-provider-adapter.contract.js";

type AiInputGatewayAbilityGroupId = "ai-input-gateway";

export type AiInputGatewayExecutionContext = {
  dataDir: string;
  adapters?: Partial<Record<AiInputGatewayProviderKind, AiProviderAdapter>>;
};

export interface AiInputGatewayAbilityGroup {
  readonly abilityGroupId: AiInputGatewayAbilityGroupId;
  listChildCapabilityIds(): AiInputGatewayChildCapabilityId[];
  execute(input: unknown, options?: { signal?: AbortSignal }): Promise<AiFeedResult>;
}
