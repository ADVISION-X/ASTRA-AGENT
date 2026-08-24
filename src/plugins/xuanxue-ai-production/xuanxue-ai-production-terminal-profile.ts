/**
 * The one commercial-metaphysics provider profile admitted by this factory.
 * `reasoningTier` is the immutable request contract; `reasoningUiLabel` is the
 * exact value the GPT Web UI must read back in the Gateway evidence.
 */
export const xuanxueTerminalMetaphysicsProviderProfile = {
  modelLabel: "GPT-5.6 Sol",
  modelFamily: "gpt-5.6",
  reasoningTier: "pro_standard",
  reasoningUiLabel: "Pro",
} as const;

const terminalMetaphysicsProductIds = new Set<string>(
  XUANXUE_PRODUCT_EXECUTION_CONTRACTS
    .filter((contract) => ["bazi", "qimen", "hehun", "naming"].includes(
      contract.owner_domain,
    ))
    .map((contract) => contract.contract_id),
);

export const isXuanxueTerminalMetaphysicsProduct = (
  productId: string,
): boolean => terminalMetaphysicsProductIds.has(productId);

export const isXuanxueTerminalMetaphysicsProfile = (
  profile: Record<string, unknown> | null | undefined,
): boolean => Boolean(
  profile
  && profile.provider === "openai-chatgpt-web"
  && profile.transport === "gpt-web-chat"
  && profile.model_label === xuanxueTerminalMetaphysicsProviderProfile.modelLabel
  && profile.model_family === xuanxueTerminalMetaphysicsProviderProfile.modelFamily
  && profile.model_identity_status === "verified"
  && profile.reasoning_effort === xuanxueTerminalMetaphysicsProviderProfile.reasoningTier,
);
import { XUANXUE_PRODUCT_EXECUTION_CONTRACTS } from "./xuanxue-ai-production-product-contracts.js";
