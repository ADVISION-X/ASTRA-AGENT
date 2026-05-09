export const BLUEPRINT_PATH = "docs/法案辅助文件/GrassEye 代码纯洁度施工图.md";
export const REPORT_PATH = "scripts/audit/generated/code-purity-report.generated.json";
export const PRODUCTION_CODE_ROOT = "src";
export const ACTIVE_ROOTS = [PRODUCTION_CODE_ROOT, "scripts"];
export const ACTIVE_FILES: string[] = [];
export const CODE_PURITY_SCAN_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".json", ".jsonc"] as const;
export const CODE_PURITY_SCAN_SCOPE = [
	"src/**/*.{ts,tsx,js,jsx,mjs,json,jsonc}",
	"scripts/**/*.{ts,tsx,js,jsx,mjs,json,jsonc}",
	"src/map-plugins/**/*.{json,jsonc,ts,tsx}",
	"src/**/prompt-contracts/**/*.{json,jsonc,ts,tsx}",
	"src/capabilities/**/prompt-contracts/**/*.{json,jsonc,ts,tsx}",
] as const;
export const DISASTER_LINE_THRESHOLD = 800;