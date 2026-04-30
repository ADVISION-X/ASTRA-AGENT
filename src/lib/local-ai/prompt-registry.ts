import type { LocalAiModelRole, LocalAiTaskType } from "../../types/local-ai.js";
import {
  getPromptContractCatalogEntry,
  getPromptContractCatalogEntryByLegacyTaskType,
  listPromptContractCatalogEntries,
} from "../../capabilities/ai/prompt-contracts/index.js";
import { VISION_PRODUCT_PRESENCE_PROMPT_CONTRACT } from "./prompts/vision-product-presence.v1.js";

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

function toLocalPromptContract(taskType: LocalAiTaskType): PromptContract {
  const contract = getPromptContractCatalogEntryByLegacyTaskType(taskType);
  return {
    taskType,
    promptContractId: contract.promptContractId,
    modelRole: contract.modelRole as LocalAiModelRole,
    promptId: contract.promptId,
    promptVersion: contract.promptVersion,
    schemaVersion: contract.schemaVersion,
    purpose: taskType === "vision.productPresence"
      ? VISION_PRODUCT_PRESENCE_PROMPT_CONTRACT.purpose
      : contract.purpose,
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
  return toLocalPromptContract(taskType);
}

export function getPromptContractById(promptContractId: string): PromptContract {
  const contract = getPromptContractCatalogEntry(promptContractId);
  if (contract.legacyTaskType === null) {
    throw new Error(`Prompt contract ${promptContractId} is not backed by the local AI runtime bridge.`);
  }
  return toLocalPromptContract(contract.legacyTaskType);
}

export function getRequiredModelRole(taskType: LocalAiTaskType): LocalAiModelRole {
  return getPromptContract(taskType).modelRole;
}

export function listPromptContracts(): PromptContract[] {
  return listPromptContractCatalogEntries()
    .filter((contract) => contract.legacyTaskType !== null)
    .map((contract) => toLocalPromptContract(contract.legacyTaskType!));
}

export function getVisionProductPresencePromptContract() {
  return VISION_PRODUCT_PRESENCE_PROMPT_CONTRACT;
}