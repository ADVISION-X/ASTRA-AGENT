import { findAiPromptContractCatalogEntry } from "../../capabilities/ai/public-contracts/prompt-contract-catalog/contract.js";

export type MapPluginAiTaskType =
  | "product_presence_judgment"
  | "ocr_cleanup"
  | "comment_signal_summary"
  | "product_signal_summary";
export type MapPluginPromptContractCatalogEntry = NonNullable<
  ReturnType<typeof findAiPromptContractCatalogEntry>
>;

export const findMapPluginPromptContractCatalogEntry = (
  promptContractId: string,
): MapPluginPromptContractCatalogEntry | null =>
  findAiPromptContractCatalogEntry(promptContractId);