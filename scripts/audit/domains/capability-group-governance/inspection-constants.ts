const LAW_ID_001 = "GRASSEYE-CAPABILITY-GROUP-001-V1";
const LAW_ID_002 = "GRASSEYE-CAPABILITY-GROUP-002-V1";
const LAW_ID_003 = "GRASSEYE-CAPABILITY-GROUP-003-V1";
const LAW_ID_004 = "GRASSEYE-CAPABILITY-GROUP-004-V1";
const LAW_ID_006 = "GRASSEYE-CAPABILITY-GROUP-006-V1";
const LAW_ID_009 = "GRASSEYE-CAPABILITY-GROUP-009-V1";
const LAW_ID_010 = "GRASSEYE-CAPABILITY-GROUP-010-V1";

const KERNEL_FILE = ".github/instructions/cursor-rules/GRASSEYE-KERNEL.instructions.md";
const INDEX_FILE = ".github/instructions/cursor-rules/grasseye-index.instructions.md";
const INSPECTOR_ENTRY = "scripts/audit/domains/capability-group-governance/inspector.ts";

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
const SUPPORT_GOVERNANCE_DOMAINS = [] as const;
const LOCAL_DEVELOPMENT_TOOLING = ["debug-loop-controller"] as const;
const INDEX_SUPPORT_GOVERNANCE_BULLETS = [] as const;
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

const AI_ONLY_MEDIA_CHANGE_TARGETS = [
  "src/capabilities/post-action-verification/",
  "src/lib/browser/current-chrome-browser-controller.ts",
  "src/lib/local-runtime/workbench-post-action-dispatch-input.ts",
] as const;

const AI_ONLY_MEDIA_CHANGE_FORBIDDEN_DECLARATION_STEMS = [
  "VideoChanged",
  "VideoIdentityChange",
  "Perceptual",
  "ComparableVideoId",
  "Ahash",
  "HammingDistance",
] as const;

const AI_ONLY_MEDIA_CHANGE_FORBIDDEN_LITERALS = [
  "verify-video-changed-after-scroll",
  "video_changed_after_scroll",
] as const;

const AI_ONLY_COGNITION_TARGETS = [
  "src/capabilities/mouse-scroll/",
  "src/capabilities/open/",
  "src/capabilities/page-state/",
  "src/capabilities/post-action-verification/",
  "src/capabilities/screenshot/",
  "src/capabilities/text-input/",
  "src/capabilities/visual-target/",
] as const;

const AI_ONLY_COGNITION_FORBIDDEN_PATH_SEGMENTS = [
  "/children/detect-",
  "/runtime/post-open-state-",
  "/runtime/state-classification-gate.ts",
  "/runtime/proceed-decision-gate.ts",
] as const;

const AI_ONLY_COGNITION_FORBIDDEN_IDENTIFIER_STEMS = [
  "Detect",
  "Classification",
  "FreshnessDecision",
  "ProceedDecision",
  "AlreadyOnTargetFreshnessDecision",
  "DetectSensitiveText",
  "detectSensitiveText",
  "minimumConfidence",
  "minimumAmbiguityGap",
  "freshnessTtlMs",
  "freshnessPolicy",
  "maxSnapshotAgeMs",
  "maxObservationAgeMs",
  "maxObservationSkewMs",
  "confidencePolicy",
  "selectionPolicy",
  "ambiguityPolicy",
  "coordinatePolicy",
  "dataQualityPolicy",
] as const;

const AI_ONLY_COGNITION_FORBIDDEN_LITERAL_PREFIXES = [
  "detect-",
] as const;

const AI_ONLY_COGNITION_FORBIDDEN_LITERALS = [
  "classificationDecision",
  "classificationSource",
  "freshnessDecision",
  "proceedDecision",
  "alreadyOnTargetFreshnessDecision",
  "login_wall",
  "wrong_domain",
  "security_wall",
] as const;

export const capabilityGroupGovernanceConstants = {
  LAW_ID_001,
  LAW_ID_002,
  LAW_ID_003,
  LAW_ID_004,
  LAW_ID_006,
  LAW_ID_009,
  LAW_ID_010,
  KERNEL_FILE,
  INDEX_FILE,
  INSPECTOR_ENTRY,
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
  AI_ONLY_MEDIA_CHANGE_TARGETS,
  AI_ONLY_MEDIA_CHANGE_FORBIDDEN_DECLARATION_STEMS,
  AI_ONLY_MEDIA_CHANGE_FORBIDDEN_LITERALS,
  AI_ONLY_COGNITION_TARGETS,
  AI_ONLY_COGNITION_FORBIDDEN_PATH_SEGMENTS,
  AI_ONLY_COGNITION_FORBIDDEN_IDENTIFIER_STEMS,
  AI_ONLY_COGNITION_FORBIDDEN_LITERAL_PREFIXES,
  AI_ONLY_COGNITION_FORBIDDEN_LITERALS,
} as const;