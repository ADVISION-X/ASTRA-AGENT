const REQUIREMENT_ID_001 = "K01-ROUTE-REQ-001";
const REQUIREMENT_ID_002 = "K01-ROUTE-REQ-002";
const REQUIREMENT_ID_003 = "K01-ROUTE-REQ-003";
const REQUIREMENT_ID_009 = "K01-ROUTE-REQ-009";
const REQUIREMENT_ID_010 = "K01-ROUTE-REQ-010";
const REQUIREMENT_ID_011 = "K01-ROUTE-REQ-011";
const REQUIREMENT_ID_012 = "K01-ROUTE-REQ-012";
const REQUIREMENT_ID_013 = "K01-ROUTE-REQ-013";
const REQUIREMENT_ID_014 = "K01-ROUTE-REQ-014";
const REQUIREMENT_ID_015 = "K01-ROUTE-REQ-015";
const REQUIREMENT_ID_016 = "K01-ROUTE-REQ-016";
const REQUIREMENT_ID_BLUEPRINT_002_001 = "K01-BLUEPRINT-01-SECTION-002-REQ-001";
const REQUIREMENT_ID_BLUEPRINT_002_002 = "K01-BLUEPRINT-01-SECTION-002-REQ-002";
const REQUIREMENT_ID_BLUEPRINT_002_003 = "K01-BLUEPRINT-01-SECTION-002-REQ-003";
const REQUIREMENT_ID_BLUEPRINT_002_004 = "K01-BLUEPRINT-01-SECTION-002-REQ-004";
const REQUIREMENT_ID_BLUEPRINT_007_001 = "K01-BLUEPRINT-01-SECTION-007-REQ-001";

const KERNEL_FILE = ".github/instructions/cursor-rules/GRASSEYE-KERNEL.instructions.md";
const BLUEPRINT_FILE = "docs/法案辅助文件/GrassEye 法案冻结基线.md";
const MUSCLE_MEMORY_BLUEPRINT_FILE = "docs/法案辅助文件/GrassEye Muscle Memory Catalog 肌肉记忆目录施工图.md";
const CHILD_CAPABILITY_STRENGTH_BLUEPRINT_FILE = "docs/法案辅助文件/GrassEye Child Capability Strength 子能力强度施工图.md";
const PROMPT_CONTRACT_GOVERNANCE_BLUEPRINT_FILE = "docs/法案辅助文件/GrassEye Visual Mission Prompt Contract 施工图.md";
const MANIFEST_FILE = "scripts/audit/domains/kernel/manifest.json";
const INSPECTOR_ENTRY = "scripts/audit/domains/kernel/inspector.ts";
const RUN_INSPECTOR_FILE = "scripts/audit/domains/kernel/run-inspector.ts";
const CAPABILITY_ROOT = "src/capabilities";
const AI_PROMPT_CONTRACT_ROOT = "src/capabilities/ai/prompt-contracts";
const GOVERNED_SURFACES = ["src/capabilities/", "src/lib/local-runtime/"] as const;
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
] as const;
const FOUNDATION_LAWS = [
  "audit-system",
  "capability-group-governance",
  "code-purity",
  "type-safety",
  "security-privacy",
] as const;
const SUPPORT_GOVERNANCE_DOMAINS = [] as const;
const LOCAL_DEVELOPMENT_TOOLING = [] as const;

const FORBIDDEN_TOP_LEVEL_OWNER_LITERALS = new Set([
  "kernel",
  "index",
  "audit-system",
  "capability-group-governance",
  "code-purity",
  "type-safety",
  "security-privacy",
  "agent-runtime",
  "browse-flow",
  "mechanical-skills",
  "operator-control",
  "visual-action",
  "visual-only-runtime",
  "evidence-packet",
  "product-signal",
  "comment-intelligence",
  "vision-boundary",
  "local-data",
  "platform-action",
  "local-ai-runtime",
  "local-browser-session",
  "local-app-shell",
  "startup-entrypoint",
  "structured-logging",
  "local-persistence-schema",
  "multi-frame-evidence",
  "code-topology",
  "localization",
  "PlatformAdapter",
  "platform-adapter",
  "browser-controller",
  "browser-primitive",
  "browser-primitives",
  "feature-folder",
  "feature-folders",
  "helper-file",
  "helper-files",
  "startup-script",
  "startup-scripts",
]);

const OWNER_LITERAL_PROPERTIES = new Set([
  "abilityGroupId",
  "requestedBy",
  "sourceAbilityGroupId",
  "from",
  "to",
  "allowedSourceAbilityGroupId",
  "targetProofOwner",
]);

export const kernelInspectionConstants = {
  REQUIREMENT_ID_001,
  REQUIREMENT_ID_002,
  REQUIREMENT_ID_003,
  REQUIREMENT_ID_009,
  REQUIREMENT_ID_010,
  REQUIREMENT_ID_011,
  REQUIREMENT_ID_012,
  REQUIREMENT_ID_013,
  REQUIREMENT_ID_014,
  REQUIREMENT_ID_015,
  REQUIREMENT_ID_016,
  REQUIREMENT_ID_BLUEPRINT_002_001,
  REQUIREMENT_ID_BLUEPRINT_002_002,
  REQUIREMENT_ID_BLUEPRINT_002_003,
  REQUIREMENT_ID_BLUEPRINT_002_004,
  REQUIREMENT_ID_BLUEPRINT_007_001,
  KERNEL_FILE,
  BLUEPRINT_FILE,
  MUSCLE_MEMORY_BLUEPRINT_FILE,
  CHILD_CAPABILITY_STRENGTH_BLUEPRINT_FILE,
  PROMPT_CONTRACT_GOVERNANCE_BLUEPRINT_FILE,
  MANIFEST_FILE,
  INSPECTOR_ENTRY,
  RUN_INSPECTOR_FILE,
  CAPABILITY_ROOT,
  AI_PROMPT_CONTRACT_ROOT,
  GOVERNED_SURFACES,
  ACTIVE_ABILITY_GROUPS,
  FOUNDATION_LAWS,
  SUPPORT_GOVERNANCE_DOMAINS,
  LOCAL_DEVELOPMENT_TOOLING,
  FORBIDDEN_TOP_LEVEL_OWNER_LITERALS,
  OWNER_LITERAL_PROPERTIES,
} as const;
