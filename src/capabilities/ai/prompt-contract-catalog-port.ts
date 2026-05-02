import { tryGetPromptContractCatalogEntry } from "./prompt-contracts/registry.js";
import type { PromptContractCatalogEntry } from "./prompt-contracts/schema.js";

export type { PromptContractCatalogEntry as AiPromptContractCatalogEntry };

export const findAiPromptContractCatalogEntry = (
  promptContractId: string,
): PromptContractCatalogEntry | null =>
  tryGetPromptContractCatalogEntry(promptContractId);