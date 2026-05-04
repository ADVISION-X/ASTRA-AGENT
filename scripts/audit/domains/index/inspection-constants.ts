const REQUIREMENT_ID_001 = "K02-ROUTE-REQ-001";
const REQUIREMENT_ID_002 = "K02-ROUTE-REQ-002";
const REQUIREMENT_ID_003 = "K02-ROUTE-REQ-003";
const REQUIREMENT_ID_004 = "K02-ROUTE-REQ-004";
const REQUIREMENT_ID_005 = "K02-ROUTE-REQ-005";
const REQUIREMENT_ID_006 = "K02-ROUTE-REQ-006";
const REQUIREMENT_ID_007 = "K02-ROUTE-REQ-007";
const REQUIREMENT_ID_008 = "K02-ROUTE-REQ-008";

const KERNEL_FILE = ".github/instructions/cursor-rules/GRASSEYE-KERNEL.instructions.md";
const INDEX_FILE = ".github/instructions/cursor-rules/grasseye-index.instructions.md";
const BLUEPRINT_FILE = "docs/法案辅助文件/GrassEye 法案冻结基线.md";
const MANIFEST_FILE = "scripts/audit/domains/index/manifest.json";
const INSPECTOR_ENTRY = "scripts/audit/domains/index/inspector.ts";
const RUN_INSPECTOR_FILE = "scripts/audit/domains/index/run-inspector.ts";
const NESTED_RUN_INSPECTOR_FILE = "scripts/audit/domains/index/run-inspector-nested.ts";
const NEGATIVE_PROOF_HARNESS_FILE = "scripts/audit/domains/index/negative-proof-harness.ts";
const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_INDEX_NEGATIVE_PROOF";

export const indexInspectionConstants = {
  REQUIREMENT_ID_001,
  REQUIREMENT_ID_002,
  REQUIREMENT_ID_003,
  REQUIREMENT_ID_004,
  REQUIREMENT_ID_005,
  REQUIREMENT_ID_006,
  REQUIREMENT_ID_007,
  REQUIREMENT_ID_008,
  KERNEL_FILE,
  INDEX_FILE,
  BLUEPRINT_FILE,
  MANIFEST_FILE,
  INSPECTOR_ENTRY,
  RUN_INSPECTOR_FILE,
  NESTED_RUN_INSPECTOR_FILE,
  NEGATIVE_PROOF_HARNESS_FILE,
  SKIP_NEGATIVE_PROOF_ENV,
} as const;