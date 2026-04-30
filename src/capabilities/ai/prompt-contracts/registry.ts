import { readFileSync } from "node:fs";

import type { AiTaskType } from "../contract.js";
import type { LocalAiTaskType } from "../../../types/local-ai.js";
import { PromptContractCatalogEntrySchema, type PromptContractCatalogEntry } from "./schema.js";

const BUILTIN_PROMPT_CONTRACT_FILES = [
  "vision.productPresence.v1.prompt-contract.json",
  "comments.ocr_cleanup.v1.prompt-contract.json",
  "comments.intent_analysis.v1.prompt-contract.json",
  "product.signal_summary.v1.prompt-contract.json",
] as const;

export const PROMPT_CONTRACT_CATALOG_VERSION = "map-prompt-contract-catalog.v1";

function readBuiltinPromptContract(fileName: string): PromptContractCatalogEntry {
  const content = readFileSync(new URL(`./builtins/${fileName}`, import.meta.url), "utf8");
  return PromptContractCatalogEntrySchema.parse(JSON.parse(content));
}

const BUILTIN_PROMPT_CONTRACTS = BUILTIN_PROMPT_CONTRACT_FILES.map((fileName) => readBuiltinPromptContract(fileName));

const CONTRACT_BY_ID = new Map(BUILTIN_PROMPT_CONTRACTS.map((contract) => [contract.promptContractId, contract]));
const CONTRACT_BY_TASK_TYPE = new Map(BUILTIN_PROMPT_CONTRACTS.map((contract) => [contract.taskType, contract]));
const CONTRACT_BY_LEGACY_TASK_TYPE = new Map(
  BUILTIN_PROMPT_CONTRACTS.flatMap((contract) => contract.legacyTaskType ? [[contract.legacyTaskType, contract] as const] : []),
);

export function listPromptContractCatalogEntries(): PromptContractCatalogEntry[] {
  return [...BUILTIN_PROMPT_CONTRACTS];
}

export function getPromptContractCatalogEntry(promptContractId: string): PromptContractCatalogEntry {
  const contract = CONTRACT_BY_ID.get(promptContractId);
  if (!contract) {
    throw new Error(`Unknown prompt contract: ${promptContractId}`);
  }
  return contract;
}

export function tryGetPromptContractCatalogEntry(promptContractId: string): PromptContractCatalogEntry | null {
  return CONTRACT_BY_ID.get(promptContractId) ?? null;
}

export function getPromptContractCatalogEntryByTaskType(taskType: AiTaskType): PromptContractCatalogEntry {
  const contract = CONTRACT_BY_TASK_TYPE.get(taskType);
  if (!contract) {
    throw new Error(`No prompt contract registered for AI taskType: ${taskType}`);
  }
  return contract;
}

export function getPromptContractCatalogEntryByLegacyTaskType(taskType: LocalAiTaskType): PromptContractCatalogEntry {
  const contract = CONTRACT_BY_LEGACY_TASK_TYPE.get(taskType);
  if (!contract) {
    throw new Error(`No prompt contract registered for legacy LocalAi taskType: ${taskType}`);
  }
  return contract;
}