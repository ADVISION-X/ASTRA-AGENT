import type { FindingSeverity } from "../../core/schema.js";

export interface PatternRule {
  lawId: string;
  severity: FindingSeverity;
  pattern: RegExp;
  message: string;
  detail?: string;
}