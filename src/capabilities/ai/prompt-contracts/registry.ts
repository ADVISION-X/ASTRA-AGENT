import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import type { AiTaskType } from "../contract.js";
import { PromptContractCatalogEntrySchema, type PromptContractCatalogEntry } from "./schema.js";
import {
  MAP_AUTHORING_SYSTEM_PROMPT_TEMPLATE,
  MAP_AUTHORING_USER_PROMPT_TEMPLATE,
} from "../../../map-plugins/authoring/map-authoring-template.js";

const BUILTIN_PROMPT_CONTRACT_FILES = [
  "ai.evidence_packet_analysis.disabled.prompt-contract.json",
  "map.authoring.v1.prompt-contract.json",
  "ai.schema_validation_only.internal.prompt-contract.json",
  "vision.productPresence.v1.prompt-contract.json",
  "comments.ocr_cleanup.v1.prompt-contract.json",
  "comments.intent_analysis.v1.prompt-contract.json",
  "product.signal_summary.v1.prompt-contract.json",
] as const;

export const PROMPT_CONTRACT_CATALOG_VERSION = "map-prompt-contract-catalog.v1";

const HASHED_CONTRACT_FIELDS = [
  "promptHash",
  "promptContractHash",
] as const;

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !(HASHED_CONTRACT_FIELDS as readonly string[]).includes(key))
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
};

export const hashPromptContractValue = (value: unknown): string =>
  `sha256:${createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(canonicalize(value))).digest("hex")}`;

const resolveTemplateHash = (templateRef: string | null): string | null => {
  if (templateRef === "src/map-plugins/authoring/map-authoring-template.ts#system") {
    return hashPromptContractValue(MAP_AUTHORING_SYSTEM_PROMPT_TEMPLATE);
  }
  if (templateRef === "src/map-plugins/authoring/map-authoring-template.ts#user") {
    return hashPromptContractValue(MAP_AUTHORING_USER_PROMPT_TEMPLATE);
  }
  return null;
};

type PromptContractCatalog =
  | {
      ok: true;
      contracts: PromptContractCatalogEntry[];
      byId: Map<string, PromptContractCatalogEntry>;
      byTaskType: Map<AiTaskType, PromptContractCatalogEntry>;
    }
  | {
      ok: false;
      message: string;
    };

function readBuiltinPromptContract(fileName: string): PromptContractCatalogEntry {
  const content = readFileSync(new URL(`./builtins/${fileName}`, import.meta.url), "utf8");
  return PromptContractCatalogEntrySchema.parse(JSON.parse(content));
}

function validatePromptContractIntegrity(contract: PromptContractCatalogEntry): string | null {
  if (contract.promptHash === "sha256:map-authoring-v1") {
    return `Prompt contract ${contract.promptContractId} uses placeholder promptHash.`;
  }
  const promptContractHash = hashPromptContractValue(contract);
  if (contract.promptContractHash !== promptContractHash || contract.promptHash !== promptContractHash) {
    return `Prompt contract ${contract.promptContractId} hash mismatch.`;
  }
  const systemTemplateHash = resolveTemplateHash(contract.systemPromptTemplateRef);
  if (systemTemplateHash !== null && contract.systemPromptTemplateHash !== systemTemplateHash) {
    return `Prompt contract ${contract.promptContractId} systemPromptTemplateHash mismatch.`;
  }
  const userTemplateHash = resolveTemplateHash(contract.userPromptTemplateRef);
  if (userTemplateHash !== null && contract.userPromptTemplateHash !== userTemplateHash) {
    return `Prompt contract ${contract.promptContractId} userPromptTemplateHash mismatch.`;
  }
  return null;
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
  const integrityMessage = contracts.map(validatePromptContractIntegrity).find((message): message is string => message !== null);
  if (integrityMessage) {
    return {
      ok: false,
      message: integrityMessage,
    };
  }

  return {
    ok: true,
    contracts,
    byId: new Map(contracts.map((contract) => [contract.promptContractId, contract])),
    byTaskType: new Map(contracts.map((contract) => [contract.taskType, contract])),
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
