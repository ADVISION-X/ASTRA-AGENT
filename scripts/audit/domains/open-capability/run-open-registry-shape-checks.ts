import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { getNodeLine } from "../../core/ts-morph.js";

import { openInspectionConstants } from "./inspection-constants.js";
import { openInspectionUtils } from "./inspection-utils.js";

const { CHILDREN, LAW_LOCAL_PROGRAM, LAW_PACKAGE_SHAPE, REGISTRY_PATH, REGISTRY_REQUIRED_FIELDS, LOCAL_PROGRAM_REGISTRY_REQUIRED_FIELDS } = openInspectionConstants;
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
    const entryText = entry.getText();
    const isLocalProgram = entryText.includes('childCapabilityId: "open-local-program"');
    const missingFields = (isLocalProgram ? LOCAL_PROGRAM_REGISTRY_REQUIRED_FIELDS : REGISTRY_REQUIRED_FIELDS).filter((field) => !propertyNames.has(field));
    if (missingFields.length > 0) {
      findings.push(createFinding({ lawId: LAW_PACKAGE_SHAPE, file: REGISTRY_PATH, line: getNodeLine(entry), severity: "fatal", message: "Open metadata registry entry is missing required fields.", detail: missingFields.join(", ") }));
    }
    if (isLocalProgram && (entryText.includes("defaultUrl") || entryText.includes("allowedHostnames") || entryText.includes("allowedSchemes"))) {
      findings.push(createFinding({ lawId: LAW_LOCAL_PROGRAM, file: REGISTRY_PATH, line: getNodeLine(entry), severity: "fatal", message: "open-local-program registry entry must not carry fake URL/hostname/scheme fields." }));
    }
    if (entryText.includes('childCapabilityId: "open-local-workbench"') && entryText.includes('targetKind: "local-program"')) {
      findings.push(createFinding({ lawId: LAW_LOCAL_PROGRAM, file: REGISTRY_PATH, line: getNodeLine(entry), severity: "fatal", message: "open-local-workbench must not represent targetKind=local-program." }));
    }
  }

  return findings;
}
