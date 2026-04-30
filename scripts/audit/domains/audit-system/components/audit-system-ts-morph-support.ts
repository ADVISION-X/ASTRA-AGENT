import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";
import {
  getAuditProject,
  getExpressionPath,
  getNodeLine,
  getObjectLiteralString,
  getSourceFileOrThrow,
  toRelativeSourcePath,
} from "../../../core/ts-morph.js";

export type AuditSystemInspectionContext = InspectorContext;
export type AuditSystemInspectionResult = { findings: Finding[]; phases: InspectorPhase[] };

export { getAuditProject, getExpressionPath, getNodeLine, getObjectLiteralString, getSourceFileOrThrow, toRelativeSourcePath };