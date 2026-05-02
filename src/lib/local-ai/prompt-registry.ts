import type { LocalAiModelRole, LocalAiTaskType } from "../../types/local-ai.js";
import {
  getPromptContractCatalogEntry,
  getPromptContractCatalogEntryByLegacyTaskType,
  getPromptContractCatalogIntegrity,
  listPromptContractCatalogEntries,
} from "../../capabilities/ai/prompt-contracts/registry.js";

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
  confidencePolicy: string;
  reviewPolicy: string;
  failurePolicy: string;
  debugPolicy: string;
  promptHash: string;
  allowedBranchFields: string[];
  prohibitedActions: string[];
  restrictedDataAccess: string[];
};

function assertPromptCatalogIntegrity() {
  const integrity = getPromptContractCatalogIntegrity();
  if (!integrity.ok) {
    throw new Error(`AI prompt contract catalog is invalid: ${integrity.message}`);
  }
}

function toLocalPromptContract(contract: ReturnType<typeof getPromptContractCatalogEntry>): PromptContract {
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
    confidencePolicy: contract.confidencePolicy,
    reviewPolicy: contract.reviewPolicy,
    failurePolicy: contract.failurePolicy,
    debugPolicy: contract.debugPolicy,
    promptHash: contract.promptHash,
    allowedBranchFields: [...contract.allowedBranchFields],
    prohibitedActions: [...contract.prohibitedActions],
    restrictedDataAccess: [...contract.restrictedDataAccess],
  };
}

export function getPromptContract(taskType: LocalAiTaskType): PromptContract {
  assertPromptCatalogIntegrity();
  return toLocalPromptContract(getPromptContractCatalogEntryByLegacyTaskType(taskType));
}

export function getPromptContractById(promptContractId: string): PromptContract {
  assertPromptCatalogIntegrity();
  return toLocalPromptContract(getPromptContractCatalogEntry(promptContractId));
}

export function getRequiredModelRole(taskType: LocalAiTaskType): LocalAiModelRole {
  return getPromptContract(taskType).modelRole;
}

export function listPromptContracts(): PromptContract[] {
  assertPromptCatalogIntegrity();
  return listPromptContractCatalogEntries()
    .filter((contract) => contract.legacyTaskType !== null)
    .map((contract) => toLocalPromptContract(contract));
}