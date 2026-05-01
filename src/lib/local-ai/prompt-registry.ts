import type { LocalAiModelRole, LocalAiTaskType } from "../../types/local-ai.js";
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

const LOCAL_PROMPT_CONTRACTS: PromptContract[] = [
  {
    taskType: "vision.productPresence",
    promptContractId: "vision.productPresence.v1",
    modelRole: VISION_PRODUCT_PRESENCE_PROMPT_CONTRACT.modelRole as LocalAiModelRole,
    promptId: VISION_PRODUCT_PRESENCE_PROMPT_CONTRACT.promptId,
    promptVersion: VISION_PRODUCT_PRESENCE_PROMPT_CONTRACT.promptVersion,
    schemaVersion: VISION_PRODUCT_PRESENCE_PROMPT_CONTRACT.schemaVersion,
    purpose: VISION_PRODUCT_PRESENCE_PROMPT_CONTRACT.purpose,
    forbiddenOutputs: [...VISION_PRODUCT_PRESENCE_PROMPT_CONTRACT.forbiddenOutputs],
    requiredInputRefs: ["promptInputRef"],
    outputSchemaRef: "ai.product_presence_judgment.v1",
    confidencePolicy: "review-on-low-confidence",
    reviewPolicy: "handoff",
    failurePolicy: "branch:ask-product-presence:failed",
    debugPolicy: "developer-inspect only",
    promptHash: "sha256:vision-productPresence-v1",
    allowedBranchFields: ["decision"],
    prohibitedActions: ["click", "scroll", "type", "open_page", "dispatch_action"],
    restrictedDataAccess: ["cookies", "credentials", "hidden_token"],
  },
  {
    taskType: "comments.ocr_cleanup",
    promptContractId: "comments.ocr_cleanup.v1",
    modelRole: "ocr",
    promptId: "comments.ocr_cleanup.v1",
    promptVersion: "comments.ocr_cleanup.v1",
    schemaVersion: "ocr-text.v1",
    purpose: "Clean OCR comment blocks into governed structured text while preserving uncertainty.",
    forbiddenOutputs: ["编造评论", "补写不存在文本"],
    requiredInputRefs: ["commentsEvidenceRef"],
    outputSchemaRef: "ai.ocr_cleanup.v1",
    confidencePolicy: "review-on-low-confidence",
    reviewPolicy: "handoff",
    failurePolicy: "return-review-required",
    debugPolicy: "developer-inspect only",
    promptHash: "sha256:comments-ocr-cleanup-v1",
    allowedBranchFields: [],
    prohibitedActions: ["click", "scroll", "type", "open_page", "dispatch_action"],
    restrictedDataAccess: ["cookies", "credentials", "hidden_token"],
  },
  {
    taskType: "comments.intent_analysis",
    promptContractId: "comments.intent_analysis.v1",
    modelRole: "commentUnderstanding",
    promptId: "comments.intent_analysis.v1",
    promptVersion: "comments.intent_analysis.v1",
    schemaVersion: "comment-signal.v1",
    purpose: "Summarize comment signals into purchase intent, pain points, complaints, and demand terms.",
    forbiddenOutputs: ["个人画像", "跨评论追踪"],
    requiredInputRefs: ["commentsEvidenceRef"],
    outputSchemaRef: "ai.comment_signal_summary.v1",
    confidencePolicy: "review-on-low-confidence",
    reviewPolicy: "handoff",
    failurePolicy: "return-review-required",
    debugPolicy: "developer-inspect only",
    promptHash: "sha256:comments-intent-analysis-v1",
    allowedBranchFields: [],
    prohibitedActions: ["click", "scroll", "type", "open_page", "dispatch_action"],
    restrictedDataAccess: ["cookies", "credentials", "hidden_token"],
  },
  {
    taskType: "product.signal_summary",
    promptContractId: "product.signal_summary.v1",
    modelRole: "productSignal",
    promptId: "product.signal_summary.v1",
    promptVersion: "product.signal_summary.v1",
    schemaVersion: "product-opportunity-candidate.v1",
    purpose: "Produce a governed product opportunity summary backed by upstream AI evidence.",
    forbiddenOutputs: ["采购决定", "广告决定", "上架决定"],
    requiredInputRefs: ["aiResultRef"],
    outputSchemaRef: "ai.product_signal_summary.v1",
    confidencePolicy: "review-on-low-confidence",
    reviewPolicy: "handoff",
    failurePolicy: "return-review-required",
    debugPolicy: "developer-inspect only",
    promptHash: "sha256:product-signal-summary-v1",
    allowedBranchFields: [],
    prohibitedActions: ["click", "scroll", "type", "open_page", "dispatch_action"],
    restrictedDataAccess: ["cookies", "credentials", "hidden_token"],
  },
];

const CONTRACT_BY_TASK_TYPE = new Map(LOCAL_PROMPT_CONTRACTS.map((contract) => [contract.taskType, contract]));
const CONTRACT_BY_ID = new Map(LOCAL_PROMPT_CONTRACTS.map((contract) => [contract.promptContractId, contract]));

export function getPromptContract(taskType: LocalAiTaskType): PromptContract {
  const contract = CONTRACT_BY_TASK_TYPE.get(taskType);
  if (!contract) {
    throw new Error(`No prompt contract registered for local AI taskType: ${taskType}`);
  }
  return { ...contract, forbiddenOutputs: [...contract.forbiddenOutputs], requiredInputRefs: [...contract.requiredInputRefs], allowedBranchFields: [...contract.allowedBranchFields], prohibitedActions: [...contract.prohibitedActions], restrictedDataAccess: [...contract.restrictedDataAccess] };
}

export function getPromptContractById(promptContractId: string): PromptContract {
  const contract = CONTRACT_BY_ID.get(promptContractId);
  if (!contract) {
    throw new Error(`Unknown prompt contract: ${promptContractId}`);
  }
  return getPromptContract(contract.taskType);
}

export function getRequiredModelRole(taskType: LocalAiTaskType): LocalAiModelRole {
  return getPromptContract(taskType).modelRole;
}

export function listPromptContracts(): PromptContract[] {
  return LOCAL_PROMPT_CONTRACTS.map((contract) => getPromptContract(contract.taskType));
}