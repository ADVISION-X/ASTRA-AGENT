import type { MapPluginAiTaskType as AiTaskType, MapPluginPromptContractCatalogEntry as PromptContractCatalogEntry } from "./ai-prompt-contract-catalog-source.js";
import { findMapPluginPromptContractCatalogEntry } from "./ai-prompt-contract-catalog-source.js";
import { type MapPluginAiChildCapabilityId } from "../shared/map-plugin-ai-child-capability-ids.js";

const AI_TASK_TYPE_BY_CHILD_CAPABILITY_ID: Record<MapPluginAiChildCapabilityId, AiTaskType> = {
  "product-presence-judgment": "product_presence_judgment",
  "comment-text-cleanup": "ocr_cleanup",
  "comment-intent-analysis": "comment_signal_summary",
  "product-signal-summary": "product_signal_summary",
};

export const getExpectedPromptTaskType = (childCapabilityId: string): AiTaskType | null =>
  AI_TASK_TYPE_BY_CHILD_CAPABILITY_ID[childCapabilityId] ?? null;

export const getPromptContractCatalogEntry = (promptContractId: string): PromptContractCatalogEntry | null =>
  findMapPluginPromptContractCatalogEntry(promptContractId);

export type {
  PromptContractCatalogEntry,
};