const LAW_ID_001 = "GRASSEYE-CAPABILITY-GROUP-001-V1";
const LAW_ID_002 = "GRASSEYE-CAPABILITY-GROUP-002-V1";
const LAW_ID_003 = "GRASSEYE-CAPABILITY-GROUP-003-V1";
const LAW_ID_004 = "GRASSEYE-CAPABILITY-GROUP-004-V1";
const LAW_ID_006 = "GRASSEYE-CAPABILITY-GROUP-006-V1";

const KERNEL_FILE = ".github/instructions/cursor-rules/GRASSEYE-KERNEL.instructions.md";
const INDEX_FILE = ".github/instructions/cursor-rules/grasseye-index.instructions.md";
const INSPECTOR_ENTRY = "scripts/audit/domains/capability-group-governance/inspector.ts";
const NEGATIVE_PROOF_HARNESS_FILE = "scripts/audit/domains/capability-group-governance/negative-proof-harness.ts";
const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_CAPABILITY_GROUP_GOVERNANCE_NEGATIVE_PROOF";

const RETIRED_ROOTS = ["src/features/local-data", "src/features/platform-action"] as const;
const GOVERNED_SURFACES = ["src/capabilities/", "src/lib/local-runtime/"] as const;
const CONTRACT_SUFFIX = "/contract.ts";
const INDEX_SUFFIX = "/index.ts";
const ACTIVE_ABILITY_GROUPS = [
  "commander-console",
  "orchestration",
  "nerve-bus",
  "ai",
  "open",
  "screenshot",
  "visual-target",
  "geometry-guard",
  "mouse-click",
  "text-input",
  "mouse-scroll",
  "post-action-verification",
  "forensics-persistence",
  "page-state",
] as const;
const FOUNDATION_LAWS = [
  "audit-system",
  "capability-group-governance",
  "code-purity",
  "type-safety",
  "security-privacy",
] as const;
const SUPPORT_GOVERNANCE_DOMAINS = ["map-plugin-package"] as const;
const LOCAL_DEVELOPMENT_TOOLING = ["debug-loop-controller"] as const;
const INDEX_SUPPORT_GOVERNANCE_BULLETS = [
  "map-plugin-package routes as support governance, not as an active ability group.",
] as const;
const INDEX_LOCAL_DEVELOPMENT_BULLETS = [
  "debug-loop-controller stays outside active law routing and must not be revived as an active ability group.",
] as const;
const CODE_PURITY_ROUTE = {
  pathOrTrigger: "file length, function length, code purity, atomicity, nesting depth, complexity, dead code, commented-out code, debug leftovers, TODO hygiene, compatibility bridge, god function, giant function, god file, owner mixing",
  loadModule: "module-code-purity.instructions.md",
  routingNote: "Code Purity foundation law; audit-system only owns runner and enforcement plumbing",
} as const;

const FORBIDDEN_OWNER_LITERALS = new Set([
  "agent-runtime",
  "browse-flow",
  "mechanical-skills",
  "visual-action",
  "visual-only-runtime",
  "evidence-packet",
  "operator-control",
  "product-signal",
  "comment-intelligence",
  "vision-boundary",
  "local-data",
  "platform-action",
]);

const OWNER_LITERAL_PROPERTIES = new Set(["abilityGroupId", "requestedBy", "sourceAbilityGroupId", "from", "to"]);
const REQUIRED_RUNTIME_PROOF_FIELDS = ["runId", "missionId", "abilityGroupId", "childCapabilityId", "status", "startedAt", "endedAt", "durationMs", "runLockId", "cancellationTokenRef", "resumeCheckpointRef", "timeoutMs", "retryCount", "maxRetry"] as const;
const RUNTIME_PROOF_TARGETS = [
  { file: "src/capabilities/ai/schema.ts", schemaName: "AiBaseRuntimeProofSchema" },
  { file: "src/capabilities/geometry-guard/schema.ts", schemaName: "GeometryGuardRuntimeProofSchema" },
  { file: "src/capabilities/mouse-click/schema.ts", schemaName: "MouseClickRuntimeProofSchema" },
  { file: "src/capabilities/mouse-scroll/schema.ts", schemaName: "MouseScrollRuntimeProofSchema" },
  { file: "src/capabilities/forensics-persistence/schema.ts", schemaName: "ForensicsRuntimeProofSchema" },
] as const;

export const capabilityGroupGovernanceConstants = {
  LAW_ID_001,
  LAW_ID_002,
  LAW_ID_003,
  LAW_ID_004,
  LAW_ID_006,
  KERNEL_FILE,
  INDEX_FILE,
  INSPECTOR_ENTRY,
  NEGATIVE_PROOF_HARNESS_FILE,
  SKIP_NEGATIVE_PROOF_ENV,
  RETIRED_ROOTS,
  GOVERNED_SURFACES,
  CONTRACT_SUFFIX,
  INDEX_SUFFIX,
  ACTIVE_ABILITY_GROUPS,
  FOUNDATION_LAWS,
  SUPPORT_GOVERNANCE_DOMAINS,
  LOCAL_DEVELOPMENT_TOOLING,
  INDEX_SUPPORT_GOVERNANCE_BULLETS,
  INDEX_LOCAL_DEVELOPMENT_BULLETS,
  CODE_PURITY_ROUTE,
  FORBIDDEN_OWNER_LITERALS,
  OWNER_LITERAL_PROPERTIES,
  REQUIRED_RUNTIME_PROOF_FIELDS,
  RUNTIME_PROOF_TARGETS,
} as const;