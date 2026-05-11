// Nerve Bus Capability Inspector — config
// Checks 8 governance questions defined in the law.

export const NERVE_BUS_SOURCE_DIR = "src/capabilities/nerve-bus";
export const NERVE_BUS_AUDIT_DIR = "scripts/audit/domains/nerve-bus-capability";

export const NERVE_BUS_MAX_SOURCE_FILES = 14;
export const NERVE_BUS_MAX_AUDIT_FILES = 3;

export const NERVE_BUS_ALLOWED_CHILDREN = [
  "dispatch-governed-envelope",
  "return-governed-result",
] as const;

export const NERVE_BUS_FORBIDDEN_CHILDREN = [
  "orchestration-to-ai",
  "ai-to-orchestration",
  "commander-to-orchestration",
  "orchestration-to-commander",
  "orchestration-to-ability",
  "ability-to-orchestration",
] as const;

export const NERVE_BUS_FORBIDDEN_INFRA_PATTERNS = [
  "queue",
  "sequence",
  "retry",
  "fallback",
] as const;

export const NERVE_BUS_FORBIDDEN_IMPORTS = [
  "src/lib/local-ai",
  "src/lib/browser",
  "src/capabilities/forensics-persistence",
  "src/capabilities/orchestration/runtime",
  "src/features/platform-action",
] as const;

export const NERVE_BUS_FORBIDDEN_PROMPT_PATTERNS = [
  "promptBody",
  "prompt_body",
  "actionPlan",
  "action_plan",
  "buildPrompt",
  "constructPrompt",
] as const;

export const NERVE_BUS_FORBIDDEN_ENVELOPE_FIELDS = [
  "mapId",
  "bindingPackageId",
  "selectedBindingId",
  "templateId",
  "routeId",
  "branchToken",
] as const;
