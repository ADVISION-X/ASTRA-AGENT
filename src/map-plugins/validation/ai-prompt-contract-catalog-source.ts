import { findAiPromptContractCatalogEntry } from "../../capabilities/ai/public-contracts/prompt-contract-catalog/contract.js";

export type MapPluginAiTaskType =
  | "page_preparation_judgment"
  | "product_presence_judgment"
  | "visual_target_candidate_analysis"
  | "ocr_cleanup"
  | "comment_signal_summary"
  | "product_signal_summary"
  | "schema_validation_only";
export type MapPluginPromptContractCatalogEntry = NonNullable<
  ReturnType<typeof findAiPromptContractCatalogEntry>
>;

export const findMapPluginPromptContractCatalogEntry = (
  promptContractId: string,
): MapPluginPromptContractCatalogEntry | null =>
  findAiPromptContractCatalogEntry(promptContractId);
