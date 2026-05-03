export const ROOT = "src/map-plugins";
export const BUILTINS_ROOT = `${ROOT}/builtins`;
export const AUDIT_ROOT = "scripts/audit/domains/map-plugin-package";
export const INSPECTOR_PATH = `${AUDIT_ROOT}/inspector.ts`;
export const SCORECARD_PATH = "docs/audit/map-plugin-package-scorecard.md";
export const MAP_PLUGIN_LAW_FILE = ".github/instructions/cursor-rules/modules/module-map-plugin-package.instructions.md";

export const MAP_PLUGIN_LAWS = {
	DATA_ONLY: "GRASSEYE-MAP-PLUGIN-001-V2",
	LIFECYCLE: "GRASSEYE-MAP-PLUGIN-002-V2",
	SCHEMA: "GRASSEYE-MAP-PLUGIN-003-V2",
	NO_CODE: "GRASSEYE-MAP-PLUGIN-004-V2",
	PROMPT_CONTRACT: "GRASSEYE-MAP-PLUGIN-005-V2",
	AI_DRAFT: "GRASSEYE-MAP-PLUGIN-006-V2",
	CAPABILITY_CATALOG: "GRASSEYE-MAP-PLUGIN-007-V2",
	BRANCH_DSL: "GRASSEYE-MAP-PLUGIN-008-V2",
	FEED_BOUNDARY: "GRASSEYE-MAP-PLUGIN-009-V2",
	PROOF: "GRASSEYE-MAP-PLUGIN-010-V2",
	ENFORCEMENT: "GRASSEYE-MAP-PLUGIN-011-V2",
} as const;

export const MAP_PLUGIN_ACTIVE_LAW_IDS = Object.values(MAP_PLUGIN_LAWS);
export const MAP_PLUGIN_REQUIRED_TIER = "P0";
export const MAP_PLUGIN_REQUIRED_ENFORCEMENT_MODE = "machine-blocking";
export const MAP_PLUGIN_REQUIRED_EVIDENCE_MODE = "law+inspector+negative-proof";