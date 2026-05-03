const ROOT = "src/capabilities/commander-console";
const CHILDREN_ROOT = `${ROOT}/children`;
const SHARED_SCHEMA_BASE_PATH = `${ROOT}/shared/commander-schema-base.ts`;
const TRANSPORT_SCHEMA_PATH = `${ROOT}/shared/commander-transport-schema.ts`;
const CONTRACT_PATH = `${ROOT}/contract.ts`;
const ABILITY_GROUP_PATH = `${ROOT}/ability-group.ts`;
const SCHEMA_PATH = `${ROOT}/schema.ts`;
const REGISTRY_PATH = `${ROOT}/registry.ts`;
const COMMAND_CHILDREN_PATH = `${CHILDREN_ROOT}/command-children.ts`;
const READ_CHILDREN_PATH = `${CHILDREN_ROOT}/read-children.ts`;
const INDEX_PATH = `${ROOT}/index.ts`;
const COMMAND_GATE_PATH = `${ROOT}/runtime/commander-command-gate.ts`;
const COMMAND_PAYLOAD_PATH = `${ROOT}/runtime/commander-command-payload.ts`;
const READ_GATE_PATH = `${ROOT}/runtime/commander-read-gate.ts`;
const TIMEOUT_GATE_PATH = `${ROOT}/runtime/commander-timeout-gate.ts`;
const IDEMPOTENCY_GATE_PATH = `${ROOT}/runtime/commander-idempotency-gate.ts`;
const TRANSPORT_SEMANTIC_GATE_PATH = `${ROOT}/runtime/commander-transport-semantic-gate.ts`;
const READ_PROOF_GATE_PATH = `${ROOT}/runtime/commander-read-proof-gate.ts`;
const COMMAND_CHILD_EXECUTOR_PATH = `${ROOT}/runtime/commander-command-child-executor.ts`;
const COMMAND_OUTCOMES_PATH = `${ROOT}/runtime/commander-command-outcomes.ts`;
const READ_CHILD_EXECUTOR_PATH = `${ROOT}/runtime/commander-read-child-executor.ts`;
const EXECUTOR_PATH = `${ROOT}/runtime/commander-console-executor.ts`;
const RESULT_BUILDER_PATH = `${ROOT}/runtime/commander-result-builder.ts`;
const PROOF_BUILDER_PATH = `${ROOT}/runtime/commander-proof-builder.ts`;
const DISPATCH_FAILURE_PATH = `${ROOT}/runtime/commander-dispatch-failure.ts`;
const BOUNDARY_POLICY_PATH = `${ROOT}/runtime/commander-boundary-policy.ts`;
const CHILD_EXECUTORS_PATH = `${ROOT}/runtime/commander-child-executors.ts`;
const CLOCK_PORT_PATH = `${ROOT}/ports/commander-clock-port.ts`;
const CLOCK_PATH = `${ROOT}/runtime/commander-clock.ts`;
const NEGATIVE_PROOF_HARNESS_PATH = "scripts/audit/domains/commander-console-capability/negative-proof-harness.ts";
const MANIFEST_PATH = "scripts/audit/domains/commander-console-capability/manifest.json";
const TASK_HANDLER_PATH = "src/app/task-api-handlers.ts";
const CANDIDATE_HANDLER_PATH = "src/app/candidate-api-handlers.ts";
const WORKBENCH_PATH = "src/lib/local-runtime/workbench.ts";
const SHELL_RENDER_PATH = "src/lib/local-app-shell/render-commander-console-page.ts";
const SHELL_PAGE_CLIENT_PATH = "src/lib/local-app-shell/commander-console-shell-client.ts";
const STARTUP_PATH = "scripts/startup/launch-grasseye.mjs";

const CHILD_IDS = [
  "issue-human-command",
  "show-mission-dashboard",
  "show-capability-roster",
  "show-capability-health",
  "show-operational-map-progress",
  "show-runtime-proof-timeline",
  "show-evidence-packets",
  "show-browse-ledger",
  "show-failed-records",
  "show-review-queue",
  "show-audit-summary",
  "pause-mission",
  "resume-mission",
  "stop-mission",
  "emergency-stop",
  "approve-candidate",
  "reject-candidate",
  "mark-review-required",
  "inspect-record-detail",
] as const;

const COMMAND_CHILD_IDS = new Set([
  "issue-human-command",
  "pause-mission",
  "resume-mission",
  "stop-mission",
  "emergency-stop",
  "approve-candidate",
  "reject-candidate",
  "mark-review-required",
]);

const REQUIRED_FILES = [
  SHARED_SCHEMA_BASE_PATH,
  TRANSPORT_SCHEMA_PATH,
  CONTRACT_PATH,
  ABILITY_GROUP_PATH,
  SCHEMA_PATH,
  REGISTRY_PATH,
  COMMAND_CHILDREN_PATH,
  READ_CHILDREN_PATH,
  INDEX_PATH,
  COMMAND_GATE_PATH,
  COMMAND_PAYLOAD_PATH,
  READ_GATE_PATH,
  TIMEOUT_GATE_PATH,
  IDEMPOTENCY_GATE_PATH,
  TRANSPORT_SEMANTIC_GATE_PATH,
  READ_PROOF_GATE_PATH,
  COMMAND_CHILD_EXECUTOR_PATH,
  COMMAND_OUTCOMES_PATH,
  READ_CHILD_EXECUTOR_PATH,
  EXECUTOR_PATH,
  RESULT_BUILDER_PATH,
  PROOF_BUILDER_PATH,
  DISPATCH_FAILURE_PATH,
  BOUNDARY_POLICY_PATH,
  CHILD_EXECUTORS_PATH,
  CLOCK_PORT_PATH,
  CLOCK_PATH,
  NEGATIVE_PROOF_HARNESS_PATH,
  SHELL_RENDER_PATH,
  SHELL_PAGE_CLIENT_PATH,
] as const;

const FORBIDDEN_IMPORT_MARKERS = [
  "/capabilities/ai/",
  "/capabilities/open/children/",
  "/capabilities/open/runtime/",
  "/capabilities/screenshot/",
  "/capabilities/mouse-click/",
  "/capabilities/mouse-scroll/",
  "/capabilities/geometry-guard/",
  "/capabilities/page-state/children/",
  "/capabilities/page-state/runtime/",
  "/capabilities/forensics-persistence/children/",
  "/capabilities/forensics-persistence/runtime/",
  "/lib/browser/",
  "/features/operator-control/",
] as const;

const FORBIDDEN_EXTERNAL_IMPORTS = [
  "/capabilities/commander-console/children/",
  "/capabilities/commander-console/runtime/",
  "/capabilities/commander-console/registry",
  "/capabilities/commander-console/ports/command-transport-port",
] as const;

export const commanderConsoleInspectionConstants = {
  ROOT,
  CHILDREN_ROOT,
  SHARED_SCHEMA_BASE_PATH,
  TRANSPORT_SCHEMA_PATH,
  CONTRACT_PATH,
  ABILITY_GROUP_PATH,
  SCHEMA_PATH,
  REGISTRY_PATH,
  COMMAND_CHILDREN_PATH,
  READ_CHILDREN_PATH,
  INDEX_PATH,
  COMMAND_GATE_PATH,
  COMMAND_PAYLOAD_PATH,
  READ_GATE_PATH,
  TIMEOUT_GATE_PATH,
  IDEMPOTENCY_GATE_PATH,
  TRANSPORT_SEMANTIC_GATE_PATH,
  READ_PROOF_GATE_PATH,
  COMMAND_CHILD_EXECUTOR_PATH,
  COMMAND_OUTCOMES_PATH,
  READ_CHILD_EXECUTOR_PATH,
  EXECUTOR_PATH,
  RESULT_BUILDER_PATH,
  PROOF_BUILDER_PATH,
  DISPATCH_FAILURE_PATH,
  BOUNDARY_POLICY_PATH,
  CHILD_EXECUTORS_PATH,
  CLOCK_PORT_PATH,
  CLOCK_PATH,
  NEGATIVE_PROOF_HARNESS_PATH,
  MANIFEST_PATH,
  TASK_HANDLER_PATH,
  CANDIDATE_HANDLER_PATH,
  WORKBENCH_PATH,
  SHELL_RENDER_PATH,
  SHELL_PAGE_CLIENT_PATH,
  STARTUP_PATH,
  CHILD_IDS,
  COMMAND_CHILD_IDS,
  REQUIRED_FILES,
  FORBIDDEN_IMPORT_MARKERS,
  FORBIDDEN_EXTERNAL_IMPORTS,
} as const;