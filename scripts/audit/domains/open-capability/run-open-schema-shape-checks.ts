import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { getZodEnumValues } from "../_shared/ast-schema-queries.js";
import { hasLiteralTextFragment } from "../_shared/ast-literal-queries.js";

import { openInspectionConstants } from "./inspection-constants.js";
import { openInspectionUtils } from "./inspection-utils.js";

const {
  CHILDREN,
  LAW_PACKAGE_SHAPE,
  LAW_RUNTIME_GOVERNANCE,
  REQUIRED_SCHEMA_DECLARATIONS,
  SCHEMA_PATH,
} = openInspectionConstants;
const { getOpenSourceOrThrow } = openInspectionUtils;

export function runOpenSchemaShapeChecks(project: import("ts-morph").Project): Finding[] {
  const findings: Finding[] = [];
  const schemaSource = getOpenSourceOrThrow(project, SCHEMA_PATH);
  const childIds = getZodEnumValues(schemaSource, "OpenChildCapabilityIdSchema");

  if (childIds.sort().join(",") !== [...CHILDREN].sort().join(",")) {
    findings.push(createFinding({ lawId: LAW_PACKAGE_SHAPE, file: SCHEMA_PATH, line: 1, severity: "fatal", message: "Open schema child ids must match the governed child catalog exactly." }));
  }
  for (const schemaName of REQUIRED_SCHEMA_DECLARATIONS) {
    if (!schemaSource.getVariableDeclaration(schemaName)) {
      findings.push(createFinding({ lawId: LAW_PACKAGE_SHAPE, file: SCHEMA_PATH, line: 1, severity: "fatal", message: `Open schema must define ${schemaName}.` }));
    }
  }
  if (!hasLiteralTextFragment(schemaSource, "failed or review_required result must not expose executable output")) {
    findings.push(createFinding({ lawId: LAW_RUNTIME_GOVERNANCE, file: SCHEMA_PATH, line: 1, severity: "fatal", message: "Open result schema must reject executable output on failed or review_required results." }));
  }
  if (!hasLiteralTextFragment(schemaSource, "startedMonotonicMs must not be after endedMonotonicMs")) {
    findings.push(createFinding({ lawId: LAW_RUNTIME_GOVERNANCE, file: SCHEMA_PATH, line: 1, severity: "fatal", message: "Open runtime proof must validate monotonic clock ordering." }));
  }

  return findings;
}