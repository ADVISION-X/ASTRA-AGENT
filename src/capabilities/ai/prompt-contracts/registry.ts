import { readFileSync } from "node:fs";

import type { AiTaskType } from "../contract.js";
import type { LocalAiTaskType } from "../../../types/local-ai.js";
import { PromptContractCatalogEntrySchema, type PromptContractCatalogEntry } from "./schema.js";

const BUILTIN_PROMPT_CONTRACT_FILES = [
  "ai.evidence_packet_analysis.disabled.prompt-contract.json",
  "ai.schema_validation_only.internal.prompt-contract.json",
  "vision.productPresence.v1.prompt-contract.json",
  "comments.ocr_cleanup.v1.prompt-contract.json",
  "comments.intent_analysis.v1.prompt-contract.json",
  "product.signal_summary.v1.prompt-contract.json",
] as const;

export const PROMPT_CONTRACT_CATALOG_VERSION = "map-prompt-contract-catalog.v1";

type PromptContractCatalog =
  | {
      ok: true;
      contracts: PromptContractCatalogEntry[];
      byId: Map<string, PromptContractCatalogEntry>;
      byTaskType: Map<AiTaskType, PromptContractCatalogEntry>;
      byLegacyTaskType: Map<LocalAiTaskType, PromptContractCatalogEntry>;
    }
  | {
      ok: false;
      message: string;
    };

function readBuiltinPromptContract(fileName: string): PromptContractCatalogEntry {
  const content = readFileSync(new URL(`./builtins/${fileName}`, import.meta.url), "utf8");
  return PromptContractCatalogEntrySchema.parse(JSON.parse(content));
}

function findDuplicate(values: string[], label: string): string | null {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      return `Duplicate prompt contract ${label}: ${value}.`;
    }
    seen.add(value);
  }
  return null;
}

function buildPromptContractCatalog(): PromptContractCatalog {
  const contracts = BUILTIN_PROMPT_CONTRACT_FILES.map((fileName) => readBuiltinPromptContract(fileName));
  const duplicateMessage = findDuplicate(contracts.map((contract) => contract.promptContractId), "promptContractId")
    ?? findDuplicate(contracts.map((contract) => contract.taskType), "taskType")
    ?? findDuplicate(
      contracts.flatMap((contract) => contract.legacyTaskType ? [contract.legacyTaskType] : []),
      "legacyTaskType",
    );

  if (duplicateMessage) {
    return {
      ok: false,
      message: duplicateMessage,
    };
  }

  return {
    ok: true,
    contracts,
    byId: new Map(contracts.map((contract) => [contract.promptContractId, contract])),
    byTaskType: new Map(contracts.map((contract) => [contract.taskType, contract])),
    byLegacyTaskType: new Map(
      contracts.flatMap((contract) => contract.legacyTaskType ? [[contract.legacyTaskType, contract] as const] : []),
    ),
  };
}

const BUILTIN_PROMPT_CATALOG = buildPromptContractCatalog();

function requirePromptContractCatalog() {
  if (!BUILTIN_PROMPT_CATALOG.ok) {
    throw new Error(`Prompt contract catalog is invalid: ${BUILTIN_PROMPT_CATALOG.message}`);
  }
  return BUILTIN_PROMPT_CATALOG;
}

export function getPromptContractCatalogIntegrity(): { ok: true } | { ok: false; message: string } {
  return BUILTIN_PROMPT_CATALOG.ok
    ? { ok: true }
    : { ok: false, message: BUILTIN_PROMPT_CATALOG.message };
}

export function listPromptContractCatalogEntries(): PromptContractCatalogEntry[] {
  return BUILTIN_PROMPT_CATALOG.ok ? [...BUILTIN_PROMPT_CATALOG.contracts] : [];
}

export function getPromptContractCatalogEntry(promptContractId: string): PromptContractCatalogEntry {
  const contract = requirePromptContractCatalog().byId.get(promptContractId);
  if (!contract) {
    throw new Error(`Unknown prompt contract: ${promptContractId}`);
  }
  return contract;
}

export function tryGetPromptContractCatalogEntry(promptContractId: string): PromptContractCatalogEntry | null {
  return BUILTIN_PROMPT_CATALOG.ok ? BUILTIN_PROMPT_CATALOG.byId.get(promptContractId) ?? null : null;
}

export function getPromptContractCatalogEntryByTaskType(taskType: AiTaskType): PromptContractCatalogEntry {
  const contract = requirePromptContractCatalog().byTaskType.get(taskType);
  if (!contract) {
    throw new Error(`No prompt contract registered for AI taskType: ${taskType}`);
  }
  return contract;
}

export function getPromptContractCatalogEntryByLegacyTaskType(taskType: LocalAiTaskType): PromptContractCatalogEntry {
  const contract = requirePromptContractCatalog().byLegacyTaskType.get(taskType);
  if (!contract) {
    throw new Error(`No prompt contract registered for legacy LocalAi taskType: ${taskType}`);
  }
  return contract;
}