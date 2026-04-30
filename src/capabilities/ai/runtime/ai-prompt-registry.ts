import {
  getPromptContractCatalogEntry,
  listPromptContractCatalogEntries,
} from "../prompt-contracts/index.js";
import type { AiTaskType } from "../contract.js";
import type { AiPromptRegistryPort, ResolvedAiPromptContract } from "../ports/ai-prompt-registry-port.js";
function toAiPromptContract(taskType: AiTaskType, promptContractId: string | null = null): ResolvedAiPromptContract {
  if (taskType === "evidence_packet_analysis") {
    return {
      promptContractId: promptContractId ?? "ai.evidence_packet_analysis.disabled",
      taskType,
      modelRole: "future",
      promptId: promptContractId ?? "ai.evidence_packet_analysis.disabled",
      promptVersion: "evidence_packet_analysis.v1",
      schemaVersion: "ai.evidence_packet_analysis.v1",
      outputSchemaRef: "ai.evidence_packet_analysis.v1",
      requiredInputRefs: ["aiResultRef"],
      allowedBranchFields: [],
      purpose: "Reserved paid evidence analysis path.",
      forbiddenOutputs: ["platform_action", "paid_fallback_to_local"],
      prohibitedActions: ["click", "scroll", "type", "open_page", "dispatch_action"],
      restrictedDataAccess: ["cookies", "credentials", "hidden_token"],
      confidencePolicy: "disabled-by-policy",
      reviewPolicy: "review-required",
      failurePolicy: "disabled-by-policy",
      debugPolicy: "developer-inspect only",
      promptHash: "sha256:evidence-packet-analysis-disabled",
    };
  }

  if (taskType === "schema_validation_only") {
    return {
      promptContractId: promptContractId ?? "ai.schema_validation_only.internal",
      taskType,
      modelRole: "schemaValidator",
      promptId: promptContractId ?? "ai.schema_validation_only.internal",
      promptVersion: "schema_validation_only.v1",
      schemaVersion: "ai.schema_validation_only.v1",
      outputSchemaRef: "ai.schema_validation_only.v1",
      requiredInputRefs: ["aiResultRef"],
      allowedBranchFields: [],
      purpose: "Validate an AI candidate against the declared output schema.",
      forbiddenOutputs: ["platform_action", "schema_bypass"],
      prohibitedActions: ["click", "scroll", "type", "open_page", "dispatch_action"],
      restrictedDataAccess: ["cookies", "credentials", "hidden_token"],
      confidencePolicy: "strict-schema-only",
      reviewPolicy: "review-required",
      failurePolicy: "schema-block",
      debugPolicy: "developer-inspect only",
      promptHash: "sha256:schema-validation-only",
    };
  }

  const contract = getPromptContractCatalogEntry(promptContractId ?? "");
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
      return [
        ...listPromptContractCatalogEntries().map((contract) => toAiPromptContract(contract.taskType, contract.promptContractId)),
        toAiPromptContract("evidence_packet_analysis"),
        toAiPromptContract("schema_validation_only"),
      ];
    },
  };
}
