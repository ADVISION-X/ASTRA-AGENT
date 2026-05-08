export const MAP_PLUGIN_AI_CHILD_CAPABILITY_IDS = [
  "comment-intent-analysis",
  "comments-entry-target-candidate-analysis",
  "comment-text-cleanup",
  "next-item-target-candidate-analysis",
  "page-preparation-judgment",
  "product-presence-judgment",
  "product-signal-summary",
  "schema-validation-only",
] as const;

export type MapPluginAiChildCapabilityId = (typeof MAP_PLUGIN_AI_CHILD_CAPABILITY_IDS)[number];
