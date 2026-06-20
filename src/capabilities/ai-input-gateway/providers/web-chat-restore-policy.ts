import type { AiFeedInput } from "../schema.js";

export const AMAZON_PRODUCT_MINING_PROMPT_CONTRACT_PREFIX = "amazon-product-mining-" as const;
export const PICK3_PROMPT_CONTRACT_PREFIX = "pick3-is-blind-eval" as const;

export const canContinueAfterWebChatSourceRestoreFailure = (input: {
  request: Pick<AiFeedInput, "promptContractId">;
}): boolean => input.request.promptContractId.startsWith(AMAZON_PRODUCT_MINING_PROMPT_CONTRACT_PREFIX)
  || input.request.promptContractId.startsWith(PICK3_PROMPT_CONTRACT_PREFIX);
