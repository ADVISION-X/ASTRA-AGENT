import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { getNodeLine } from "../../core/ts-morph.js";

import { openInspectionConstants } from "./inspection-constants.js";
import { openInspectionUtils } from "./inspection-utils.js";

const { CHILDREN, LAW_PACKAGE_SHAPE, REGISTRY_PATH, REGISTRY_REQUIRED_FIELDS } = openInspectionConstants;
const { getObjectPropertyNames, getOpenSourceOrThrow, getRegistryEntries } = openInspectionUtils;

export function runOpenRegistryShapeChecks(project: import("ts-morph").Project): Finding[] {
  const findings: Finding[] = [];
  const registrySource = getOpenSourceOrThrow(project, REGISTRY_PATH);
  const registryEntries = getRegistryEntries(registrySource);

  if (registryEntries.length !== CHILDREN.length) {
    findings.push(createFinding({ lawId: LAW_PACKAGE_SHAPE, file: REGISTRY_PATH, line: 1, severity: "fatal", message: "Open registry must contain one metadata entry for each governed child." }));
  }
  for (const entry of registryEntries) {
    const propertyNames = getObjectPropertyNames(entry);
    const missingFields = REGISTRY_REQUIRED_FIELDS.filter((field) => !propertyNames.has(field));
    if (missingFields.length > 0) {
      findings.push(createFinding({ lawId: LAW_PACKAGE_SHAPE, file: REGISTRY_PATH, line: getNodeLine(entry), severity: "fatal", message: "Open metadata registry entry is missing required fields.", detail: missingFields.join(", ") }));
    }
  }

  return findings;
}