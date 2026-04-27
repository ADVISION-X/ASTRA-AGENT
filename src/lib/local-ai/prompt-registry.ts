import type { LocalAiModelRole, LocalAiTaskType } from "../../types/local-ai.js";
import { VISION_PRODUCT_PRESENCE_PROMPT_CONTRACT } from "./prompts/vision-product-presence.v1.js";

export type PromptContract = {
  taskType: LocalAiTaskType;
  modelRole: LocalAiModelRole;
  promptId: string;
  promptVersion: string;
  schemaVersion: string;
  purpose: string;
  forbiddenOutputs: string[];
};

const promptContracts: Record<LocalAiTaskType, PromptContract> = {
  "vision.productPresence": {
    taskType: "vision.productPresence",
    modelRole: "vision",
    promptId: VISION_PRODUCT_PRESENCE_PROMPT_CONTRACT.promptId,
    promptVersion: VISION_PRODUCT_PRESENCE_PROMPT_CONTRACT.promptVersion,
    schemaVersion: VISION_PRODUCT_PRESENCE_PROMPT_CONTRACT.schemaVersion,
    purpose: VISION_PRODUCT_PRESENCE_PROMPT_CONTRACT.purpose,
    forbiddenOutputs: [...VISION_PRODUCT_PRESENCE_PROMPT_CONTRACT.forbiddenOutputs]
  },
  "comments.ocr_cleanup": {
    taskType: "comments.ocr_cleanup",
    modelRole: "ocr",
    promptId: "comments.ocr_cleanup.v1",
    promptVersion: "comments.ocr_cleanup.v1",
    schemaVersion: "ocr-text.v1",
    purpose: "将评论截图内容整理为结构化文本，并标出不确定片段。",
    forbiddenOutputs: ["编造评论", "补写不存在文本"]
  },
  "comments.intent_analysis": {
    taskType: "comments.intent_analysis",
    modelRole: "commentUnderstanding",
    promptId: "comments.intent_analysis.v1",
    promptVersion: "comments.intent_analysis.v1",
    schemaVersion: "comment-signal.v1",
    purpose: "从清洗后的评论文本中提取购买意图、痛点、质疑与需求词。",
    forbiddenOutputs: ["个人画像", "跨评论追踪"]
  },
  "product.signal_summary": {
    taskType: "product.signal_summary",
    modelRole: "productSignal",
    promptId: "product.signal_summary.v1",
    promptVersion: "product.signal_summary.v1",
    schemaVersion: "product-opportunity-candidate.v1",
    purpose: "生成带证据引用的产品机会候选摘要。",
    forbiddenOutputs: ["采购决定", "广告决定", "上架决定"]
  }
};

export function getPromptContract(taskType: LocalAiTaskType): PromptContract {
  return promptContracts[taskType];
}

export function getRequiredModelRole(taskType: LocalAiTaskType): LocalAiModelRole {
  return getPromptContract(taskType).modelRole;
}

export function listPromptContracts(): PromptContract[] {
  return Object.values(promptContracts);
}

export function getVisionProductPresencePromptContract() {
  return VISION_PRODUCT_PRESENCE_PROMPT_CONTRACT;
}