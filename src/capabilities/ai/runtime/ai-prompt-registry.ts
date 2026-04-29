import { getPromptContract, listPromptContracts } from "../../../lib/local-ai/prompt-registry.js";
import type { AiPromptContract, AiTaskType } from "../contract.js";
import type { AiPromptRegistryPort } from "../ports/ai-prompt-registry-port.js";
import type { LocalAiTaskType } from "../../../types/local-ai.js";

const LEGACY_TASK_BY_AI: Record<Exclude<AiTaskType, "evidence_packet_analysis" | "schema_validation_only">, LocalAiTaskType> = {
  product_presence_judgment: "vision.productPresence",
  visual_observation: "vision.productPresence",
  visual_target_candidate_analysis: "vision.productPresence",
  ocr_cleanup: "comments.ocr_cleanup",
  comment_signal_summary: "comments.intent_analysis",
  product_signal_summary: "product.signal_summary",
};

const AI_TASK_BY_LEGACY: Record<LocalAiTaskType, Exclude<AiTaskType, "evidence_packet_analysis" | "schema_validation_only">> = {
  "vision.productPresence": "product_presence_judgment",
  "comments.ocr_cleanup": "ocr_cleanup",
  "comments.intent_analysis": "comment_signal_summary",
  "product.signal_summary": "product_signal_summary",
};

function toAiPromptContract(taskType: AiTaskType): AiPromptContract {
  if (taskType === "evidence_packet_analysis") {
    return {
      taskType,
      modelRole: "future",
      promptId: "ai.evidence_packet_analysis.disabled",
      promptVersion: "evidence_packet_analysis.v1",
      schemaVersion: "ai.evidence_packet_analysis.v1",
      purpose: "Reserved paid evidence analysis path.",
      forbiddenOutputs: ["platform_action", "paid_fallback_to_local"],
    };
  }

  if (taskType === "schema_validation_only") {
    return {
      taskType,
      modelRole: "schemaValidator",
      promptId: "ai.schema_validation_only.internal",
      promptVersion: "schema_validation_only.v1",
      schemaVersion: "ai.schema_validation_only.v1",
      purpose: "Validate an AI candidate against the declared output schema.",
      forbiddenOutputs: ["platform_action", "schema_bypass"],
    };
  }

  const contract = getPromptContract(LEGACY_TASK_BY_AI[taskType]);
  return {
    taskType,
    modelRole: contract.modelRole,
    promptId: contract.promptId,
    promptVersion: contract.promptVersion,
    schemaVersion: contract.schemaVersion,
    purpose: contract.purpose,
    forbiddenOutputs: [...contract.forbiddenOutputs, "platform_action"],
  };
}

export function createAiPromptRegistry(): AiPromptRegistryPort {
  return {
    resolvePromptContract(taskType) {
      return toAiPromptContract(taskType);
    },
    listPromptContracts() {
      return [
        ...listPromptContracts().map((contract) => toAiPromptContract(AI_TASK_BY_LEGACY[contract.taskType])),
        toAiPromptContract("evidence_packet_analysis"),
        toAiPromptContract("schema_validation_only"),
      ];
    },
  };
}
