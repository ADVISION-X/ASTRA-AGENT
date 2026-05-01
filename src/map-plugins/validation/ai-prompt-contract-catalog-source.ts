import { tryGetPromptContractCatalogEntry } from "../../capabilities/ai/index.js";

export type MapPluginAiTaskType =
  | "product_presence_judgment"
  | "ocr_cleanup"
  | "comment_signal_summary"
  | "product_signal_summary";
export type MapPluginPromptContractCatalogEntry = NonNullable<
  ReturnType<typeof tryGetPromptContractCatalogEntry>
>;

export const findMapPluginPromptContractCatalogEntry = (
  promptContractId: string,
): MapPluginPromptContractCatalogEntry | null =>
  tryGetPromptContractCatalogEntry(promptContractId);