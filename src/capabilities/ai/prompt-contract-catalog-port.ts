import {
  PROMPT_CONTRACT_CATALOG_VERSION,
  listPromptContractCatalogEntries,
  tryGetPromptContractCatalogEntry,
} from "./prompt-contracts/index.js";
import type { PromptContractCatalogEntry } from "./prompt-contracts/index.js";

export type { PromptContractCatalogEntry as AiPromptContractCatalogEntry };
export const AI_PROMPT_CONTRACT_CATALOG_VERSION = PROMPT_CONTRACT_CATALOG_VERSION;

export const listAiPromptContractCatalogEntries = (): PromptContractCatalogEntry[] => {
  return listPromptContractCatalogEntries();
};

export const findAiPromptContractCatalogEntry = (
  promptContractId: string,
): PromptContractCatalogEntry | null =>
  tryGetPromptContractCatalogEntry(promptContractId);