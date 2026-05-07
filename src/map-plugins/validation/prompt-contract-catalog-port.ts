import type { MapPluginAiTaskType as AiTaskType, MapPluginPromptContractCatalogEntry as PromptContractCatalogEntry } from "./ai-prompt-contract-catalog-source.js";
import { findMapPluginPromptContractCatalogEntry } from "./ai-prompt-contract-catalog-source.js";
import { type MapPluginAiChildCapabilityId } from "../shared/map-plugin-ai-child-capability-ids.js";

const AI_TASK_TYPE_BY_CHILD_CAPABILITY_ID: Record<MapPluginAiChildCapabilityId, AiTaskType> = {
  "product-presence-judgment": "product_presence_judgment",
  "comment-text-cleanup": "ocr_cleanup",
  "comment-intent-analysis": "comment_signal_summary",
  "product-signal-summary": "product_signal_summary",
  "schema-validation-only": "schema_validation_only",
};

export const getExpectedPromptTaskType = (childCapabilityId: string): AiTaskType | null =>
  childCapabilityId in AI_TASK_TYPE_BY_CHILD_CAPABILITY_ID
    ? AI_TASK_TYPE_BY_CHILD_CAPABILITY_ID[childCapabilityId as MapPluginAiChildCapabilityId]
    : null;

export const getPromptContractCatalogEntry = (promptContractId: string): PromptContractCatalogEntry | null =>
  findMapPluginPromptContractCatalogEntry(promptContractId);

export type {
  PromptContractCatalogEntry,
};
