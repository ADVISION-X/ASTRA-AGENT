import {
  PROMPT_CONTRACT_CATALOG_VERSION,
  getPromptContractCatalogIntegrity,
  getPromptContractCatalogEntry,
  listPromptContractCatalogEntries,
  tryGetPromptContractCatalogEntry,
} from "../prompt-contracts/index.js";
import type { AiTaskType } from "../contract.js";
import type {
  AiPromptRegistryPort,
  AiPromptRegistryResolution,
  ResolvedAiPromptContract,
} from "../ports/ai-prompt-registry-port.js";

function toAiPromptContract(taskType: AiTaskType, promptContractId: string): ResolvedAiPromptContract {
  const contract = getPromptContractCatalogEntry(promptContractId);

  return {
    promptContractId: contract.promptContractId,
    promptCatalogVersion: PROMPT_CONTRACT_CATALOG_VERSION,
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
    confidencePolicy: { ...contract.confidencePolicy },
    reviewPolicy: { requiredWhen: [...contract.reviewPolicy.requiredWhen] },
    failurePolicy: { ...contract.failurePolicy },
    debugPolicy: { ...contract.debugPolicy },
    promptHash: contract.promptHash,
  };
}

function resolvePromptContract(input: { promptContractId: string; taskType: AiTaskType }): AiPromptRegistryResolution {
  const integrity = getPromptContractCatalogIntegrity();
  if (!integrity.ok) {
    return {
      ok: false,
      failureReason: "prompt_catalog_integrity_failed",
      message: integrity.message,
    };
  }

  const contract = tryGetPromptContractCatalogEntry(input.promptContractId);
  if (!contract) {
    return {
      ok: false,
      failureReason: "unknown_prompt_contract",
      message: `Unknown prompt contract: ${input.promptContractId}`,
    };
  }

  if (contract.taskType !== input.taskType) {
    return {
      ok: false,
      failureReason: "prompt_task_mismatch",
      message: `Prompt contract ${contract.promptContractId} does not match AI taskType ${input.taskType}.`,
    };
  }

  return {
    ok: true,
    contract: toAiPromptContract(input.taskType, input.promptContractId),
  };
}

export function createAiPromptRegistry(): AiPromptRegistryPort {
  return {
    resolvePromptContract,
    listPromptContracts() {
      return listPromptContractCatalogEntries().map((contract) => toAiPromptContract(contract.taskType, contract.promptContractId));
    },
  };
}
