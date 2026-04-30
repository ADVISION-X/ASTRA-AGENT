export const REQUIRED_PHASE_DOMAINS = [
  "audit-system",
  "capability-group-governance",
  "type-safety",
  "security-privacy",
  "ai-capability",
  "commander-console-capability",
  "orchestration-capability",
  "nerve-bus-capability",
  "page-state-capability",
  "post-action-verification-capability",
  "open-capability",
  "screenshot-capability",
  "geometry-guard-capability",
  "mouse-click-capability",
  "text-input-capability",
  "mouse-scroll-capability",
  "visual-target-capability",
  "forensics-persistence-capability",
  "map-plugin-package",
] as const;

export type RequiredPhaseDomain = typeof REQUIRED_PHASE_DOMAINS[number];
