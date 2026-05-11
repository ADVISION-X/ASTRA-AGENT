import type { LocalAiModelRole, LocalAiTaskType } from "../../../types/local-ai.js";

import {
  getPromptContractCatalogEntry,
  getPromptContractCatalogIntegrity,
  listPromptContractCatalogEntries,
} from "./registry.js";
import type { PromptContractCatalogEntry } from "./schema.js";

type PromptContractCatalogResolution =
  | { ok: true; contract: PromptContractCatalogEntry }
  | {
      ok: false;
      failureReason: "legacy_task_mapping_missing" | "prompt_catalog_integrity_failed";
      message: string;
    };

export type PromptContract = {
  taskType: LocalAiTaskType;
  promptContractId: string;
  modelRole: LocalAiModelRole;
  promptId: string;
  promptVersion: string;
  schemaVersion: string;
  purpose: string;
  forbiddenOutputs: string[];
  requiredInputRefs: string[];
  outputSchemaRef: string;
  confidencePolicy: PromptContractCatalogEntry["confidencePolicy"];
  reviewPolicy: PromptContractCatalogEntry["reviewPolicy"];
  failurePolicy: PromptContractCatalogEntry["failurePolicy"];
  debugPolicy: PromptContractCatalogEntry["debugPolicy"];
  promptHash: string;
  allowedBranchFields: string[];
  prohibitedActions: string[];
  restrictedDataAccess: string[];
};

function assertPromptCatalogIntegrity(): void {
  const integrity = getPromptContractCatalogIntegrity();
  if (!integrity.ok) {
    throw new Error(`AI prompt contract catalog is invalid: ${integrity.message}`);
  }
}

function findPromptContractCatalogEntryByLocalTaskType(taskType: LocalAiTaskType): PromptContractCatalogEntry | null {
  return listPromptContractCatalogEntries().find((contract) => contract.legacyTaskType === taskType) ?? null;
}

function toPromptContract(contract: PromptContractCatalogEntry): PromptContract {
  if (contract.legacyTaskType === null) {
    throw new Error(`Prompt contract ${contract.promptContractId} is not authorized for local AI task execution.`);
  }

  return {
    taskType: contract.legacyTaskType,
    promptContractId: contract.promptContractId,
    modelRole: contract.modelRole as LocalAiModelRole,
    promptId: contract.promptId,
    promptVersion: contract.promptVersion,
    schemaVersion: contract.schemaVersion,
    purpose: contract.purpose,
    forbiddenOutputs: [...contract.forbiddenOutputs],
    requiredInputRefs: [...contract.requiredInputRefs],
    outputSchemaRef: contract.outputSchemaRef,
    confidencePolicy: { ...contract.confidencePolicy },
    reviewPolicy: { requiredWhen: [...contract.reviewPolicy.requiredWhen] },
    failurePolicy: { ...contract.failurePolicy },
    debugPolicy: { ...contract.debugPolicy },
    promptHash: contract.promptHash,
    allowedBranchFields: [...contract.allowedBranchFields],
    prohibitedActions: [...contract.prohibitedActions],
    restrictedDataAccess: [...contract.restrictedDataAccess],
  };
}

function getPromptContractCatalogEntryByLocalTaskType(taskType: LocalAiTaskType): PromptContractCatalogEntry {
  assertPromptCatalogIntegrity();
  const contract = findPromptContractCatalogEntryByLocalTaskType(taskType);
  if (!contract) {
    throw new Error(`No prompt contract registered for local AI taskType: ${taskType}`);
  }
  return contract;
}

export function resolvePromptContractCatalogEntryByLocalTaskType(taskType: LocalAiTaskType): PromptContractCatalogResolution {
  const integrity = getPromptContractCatalogIntegrity();
  if (!integrity.ok) {
    return {
      ok: false,
      failureReason: "prompt_catalog_integrity_failed",
      message: integrity.message,
    };
  }

  const contract = findPromptContractCatalogEntryByLocalTaskType(taskType);
  if (!contract) {
    return {
      ok: false,
      failureReason: "legacy_task_mapping_missing",
      message: `No prompt contract registered for local AI taskType: ${taskType}`,
    };
  }

  return { ok: true, contract };
}

export function getPromptContract(taskType: LocalAiTaskType): PromptContract {
  return toPromptContract(getPromptContractCatalogEntryByLocalTaskType(taskType));
}

export function getPromptContractById(promptContractId: string): PromptContract {
  assertPromptCatalogIntegrity();
  return toPromptContract(getPromptContractCatalogEntry(promptContractId));
}

export function getRequiredModelRole(taskType: LocalAiTaskType): LocalAiModelRole {
  return getPromptContract(taskType).modelRole;
}

export function listPromptContracts(): PromptContract[] {
  assertPromptCatalogIntegrity();
  return listPromptContractCatalogEntries()
    .filter((contract) => contract.legacyTaskType !== null)
    .map((contract) => toPromptContract(contract));
}