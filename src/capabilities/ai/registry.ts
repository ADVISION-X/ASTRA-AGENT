import type { AiChildCapabilityId, AiChildCapabilityRegistryEntry } from "./contract.js";
import { DISABLED_AI_CHILD_REGISTRY_ENTRIES } from "./registry-disabled-children.js";
import { LOCAL_AI_ANALYSIS_CHILD_REGISTRY_ENTRIES } from "./registry-local-analysis-children.js";
import { LOCAL_AI_RUNTIME_CHILD_REGISTRY_ENTRIES } from "./registry-local-runtime-children.js";

export function listAiChildren(): AiChildCapabilityId[] {
  return [
    "local-vision-ai",
    "local-text-ai",
    "local-ocr-ai",
    "internal-schema-validator",
    "paid-vision-ai",
    "paid-analysis-ai",
    "future-api-ai",
  ];
}

const AI_CHILD_REGISTRY_ENTRIES: readonly AiChildCapabilityRegistryEntry[] = [
  ...LOCAL_AI_RUNTIME_CHILD_REGISTRY_ENTRIES,
  ...LOCAL_AI_ANALYSIS_CHILD_REGISTRY_ENTRIES,
  ...DISABLED_AI_CHILD_REGISTRY_ENTRIES,
];

export function createAiCapabilityRegistry(): ReadonlyMap<AiChildCapabilityId, AiChildCapabilityRegistryEntry> {
  return new Map<AiChildCapabilityId, AiChildCapabilityRegistryEntry>(
    AI_CHILD_REGISTRY_ENTRIES.map((entry) => [entry.childCapabilityId, entry]),
  );
}
