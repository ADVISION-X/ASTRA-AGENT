import type { AiTaskType } from "../../capabilities/ai/contract.js";
import { tryGetPromptContractCatalogEntry } from "../../capabilities/ai/prompt-contracts/registry.js";

const AI_TASK_TYPE_BY_CHILD_CAPABILITY_ID: Record<string, AiTaskType> = {
  "product-presence-judgment": "product_presence_judgment",
  "comment-text-cleanup": "ocr_cleanup",
  "comment-intent-analysis": "comment_signal_summary",
  "product-signal-summary": "product_signal_summary",
};

export type PromptContractCatalogEntry = NonNullable<ReturnType<typeof tryGetPromptContractCatalogEntry>>;

export const getExpectedPromptTaskType = (childCapabilityId: string): AiTaskType | null =>
  AI_TASK_TYPE_BY_CHILD_CAPABILITY_ID[childCapabilityId] ?? null;

export const getPromptContractCatalogEntry = (promptContractId: string): PromptContractCatalogEntry | null =>
  tryGetPromptContractCatalogEntry(promptContractId);