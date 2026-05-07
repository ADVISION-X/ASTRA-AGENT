export const MAP_PLUGIN_AI_CHILD_CAPABILITY_IDS = [
  "comment-intent-analysis",
  "comment-text-cleanup",
  "product-presence-judgment",
  "product-signal-summary",
  "schema-validation-only",
] as const;

export type MapPluginAiChildCapabilityId = (typeof MAP_PLUGIN_AI_CHILD_CAPABILITY_IDS)[number];
