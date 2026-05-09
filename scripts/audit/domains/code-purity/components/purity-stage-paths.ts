import { REPORT_PATH } from "./purity-runtime-constants.js";

export const CODE_PURITY_WORK_DIR = "scripts/audit/generated/code-purity";
export const CODE_PURITY_FINDINGS_NDJSON = `${CODE_PURITY_WORK_DIR}/findings.ndjson`;
export const CODE_PURITY_INVENTORY_NDJSON = `${CODE_PURITY_WORK_DIR}/inventory.ndjson`;
export const CODE_PURITY_SCAN_SUMMARY = `${CODE_PURITY_WORK_DIR}/scan-summary.generated.json`;
export const CODE_PURITY_REPORT_RESULT = REPORT_PATH;
export const CODE_PURITY_MAX_RSS_ENV = "GRASSEYE_CODE_PURITY_MAX_RSS_MB";
