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
const BLUEPRINT_FILE = "docs/法案辅助文件/GrassEye 简单能力机器总纲施工图.md";
const MUSCLE_MEMORY_BLUEPRINT_FILE = "docs/法案辅助文件/GrassEye Muscle Memory Catalog 肌肉记忆目录施工图.md";
const CHILD_CAPABILITY_STRENGTH_BLUEPRINT_FILE = "docs/法案辅助文件/GrassEye Child Capability Strength 子能力强度施工图.md";
const MANIFEST_FILE = "scripts/audit/domains/index/manifest.json";
const INSPECTOR_ENTRY = "scripts/audit/domains/index/inspector.ts";
const RUN_INSPECTOR_FILE = "scripts/audit/domains/index/run-inspector.ts";
const NESTED_RUN_INSPECTOR_FILE = "scripts/audit/domains/index/run-inspector-nested.ts";

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
  MUSCLE_MEMORY_BLUEPRINT_FILE,
  CHILD_CAPABILITY_STRENGTH_BLUEPRINT_FILE,
  MANIFEST_FILE,
  INSPECTOR_ENTRY,
  RUN_INSPECTOR_FILE,
  NESTED_RUN_INSPECTOR_FILE,
} as const;