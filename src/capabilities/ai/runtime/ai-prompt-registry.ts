import {
  getPromptContractCatalogEntry,
  listPromptContractCatalogEntries,
} from "../prompt-contracts/index.js";
import type { AiTaskType } from "../contract.js";
import type { AiPromptRegistryPort, ResolvedAiPromptContract } from "../ports/ai-prompt-registry-port.js";
function toAiPromptContract(taskType: AiTaskType, promptContractId: string): ResolvedAiPromptContract {
  const contract = getPromptContractCatalogEntry(promptContractId);
  if (contract.taskType !== taskType) {
    throw new Error(`Prompt contract ${contract.promptContractId} does not match AI taskType ${taskType}.`);
  }

  return {
    promptContractId: contract.promptContractId,
    taskType,
    modelRole: contract.modelRole,
    promptId: contract.promptId,
    promptVersion: contract.promptVersion,
    schemaVersion: contract.schemaVersion,
    outputSchemaRef: contract.outputSchemaRef,
    requiredInputRefs: [...contract.requiredInputRefs],
    allowedBranchFields: [...contract.allowedBranchFields],
    purpose: contract.purpose,
    forbiddenOutputs: [...contract.forbiddenOutputs, "platform_action"],
    prohibitedActions: [...contract.prohibitedActions],
    restrictedDataAccess: [...contract.restrictedDataAccess],
    confidencePolicy: contract.confidencePolicy,
    reviewPolicy: contract.reviewPolicy,
    failurePolicy: contract.failurePolicy,
    debugPolicy: contract.debugPolicy,
    promptHash: contract.promptHash,
  };
}

export function createAiPromptRegistry(): AiPromptRegistryPort {
  return {
    resolvePromptContract(input) {
      return toAiPromptContract(input.taskType, input.promptContractId);
    },
    listPromptContracts() {
      return listPromptContractCatalogEntries().map((contract) => toAiPromptContract(contract.taskType, contract.promptContractId));
    },
  };
}
