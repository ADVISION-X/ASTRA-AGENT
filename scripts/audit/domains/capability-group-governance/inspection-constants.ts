const LAW_ID_001 = "GRASSEYE-CAPABILITY-GROUP-001-V1";
const LAW_ID_002 = "GRASSEYE-CAPABILITY-GROUP-002-V1";
const LAW_ID_003 = "GRASSEYE-CAPABILITY-GROUP-003-V1";
const LAW_ID_004 = "GRASSEYE-CAPABILITY-GROUP-004-V1";
const LAW_ID_006 = "GRASSEYE-CAPABILITY-GROUP-006-V1";

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
  "mouse-scroll",
  "post-action-verification",
  "forensics-persistence",
  "page-state",
] as const;

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
  RETIRED_ROOTS,
  GOVERNED_SURFACES,
  CONTRACT_SUFFIX,
  INDEX_SUFFIX,
  ACTIVE_ABILITY_GROUPS,
  FORBIDDEN_OWNER_LITERALS,
  OWNER_LITERAL_PROPERTIES,
  REQUIRED_RUNTIME_PROOF_FIELDS,
  RUNTIME_PROOF_TARGETS,
} as const;