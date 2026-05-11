/**
 * Commander Console Capability — Audit Config
 *
 * Constants for commander-console capability audit domain.
 */

export const COMMANDER_CONSOLE_LAW_FILE =
  ".github/instructions/cursor-rules/modules/module-commander-console-capability.instructions.md";

export const COMMANDER_CONSOLE_PRODUCTION_ROOT = "src/capabilities/commander-console";

export const REQUIRED_CHILD_IDS = [
  "issue-human-command",
  "pause-mission",
  "resume-mission",
  "stop-mission",
  "emergency-stop",
  "mark-review-required",
  "show-mission-status",
] as const;

export const FORBIDDEN_CHILD_IDS = [
  "show-mission-dashboard",
  "show-audit-summary",
  "show-browse-ledger",
  "show-evidence-packets",
  "show-failed-records",
  "show-runtime-proof-timeline",
  "show-capability-roster",
  "show-capability-health",
  "inspect-record-detail",
  "show-review-queue",
  "approve-candidate",
  "reject-candidate",
  "review-disposition",
] as const;

export const FORBIDDEN_FIELDS = [
  "candidateId",
  "disposition",
  "approve-candidate",
  "reject-candidate",
  "mapId",
  "runtimePlanId",
  "routePlanId",
  "activationId",
  "templateId",
  "selectedMapId",
  "branchToken",
] as const;

export const MAX_PRODUCTION_FILE_COUNT = 18;

export const LAW_IDS = {
  STRUCTURE: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-001-V3",
  BOUNDARY: "GRASSEYE-HUMAN-COMMAND-BOUNDARY-V1",
} as const;

export const commanderConsoleInspectionConstants = {
  ROOT: COMMANDER_CONSOLE_PRODUCTION_ROOT,
  INDEX_PATH: `${COMMANDER_CONSOLE_PRODUCTION_ROOT}/index.ts`,
  ABILITY_GROUP_PATH: `${COMMANDER_CONSOLE_PRODUCTION_ROOT}/ability-group.ts`,
  CONTRACT_PATH: `${COMMANDER_CONSOLE_PRODUCTION_ROOT}/contract.ts`,
  SCHEMA_PATH: `${COMMANDER_CONSOLE_PRODUCTION_ROOT}/schema.ts`,
  REGISTRY_PATH: `${COMMANDER_CONSOLE_PRODUCTION_ROOT}/registry.ts`,
  CHILDREN_PATH: `${COMMANDER_CONSOLE_PRODUCTION_ROOT}/children.ts`,
  ENVELOPE_PATH: `${COMMANDER_CONSOLE_PRODUCTION_ROOT}/envelope.ts`,
  IDEMPOTENCY_PATH: `${COMMANDER_CONSOLE_PRODUCTION_ROOT}/idempotency.ts`,
  RESULT_PATH: `${COMMANDER_CONSOLE_PRODUCTION_ROOT}/result.ts`,
  REQUIRED_CHILD_IDS,
  FORBIDDEN_CHILD_IDS,
  FORBIDDEN_FIELDS,
  MAX_PRODUCTION_FILE_COUNT,
  LAW_IDS,
} as const;
