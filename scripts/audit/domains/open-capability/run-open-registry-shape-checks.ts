import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { toRepoRelativePath } from "../../core/paths.js";
import { getNodeLine } from "../../core/ts-morph.js";

import { openInspectionConstants } from "./inspection-constants.js";
import { openInspectionUtils } from "./inspection-utils.js";

const {
  CHILDREN,
  LAW_LOCAL_PROGRAM,
  LAW_PACKAGE_SHAPE,
  REGISTRY_PATH,
  REGISTRY_REQUIRED_FIELDS,
  LOCAL_PROGRAM_REGISTRY_REQUIRED_FIELDS,
  OPEN_PLATFORM_REGISTRY_ENTRIES_PATH,
  OPEN_LOCAL_REGISTRY_ENTRIES_PATH,
} = openInspectionConstants;
const { getObjectPropertyNames, getOpenSourceOrThrow, getRegistryEntries } = openInspectionUtils;

type RegistryEntry = ReturnType<typeof getRegistryEntries>[number];

const getRegistryEntryPath = (entry: RegistryEntry): string => toRepoRelativePath(entry.getSourceFile().getFilePath());

const collectRegistryEntryFindings = (
  entry: RegistryEntry,
): Finding[] => {
  const propertyNames = getObjectPropertyNames(entry);
  const entryText = entry.getText();
  const entryPath = getRegistryEntryPath(entry);
  const isLocalProgram = entryText.includes('childCapabilityId: "open-local-program"');
  return [
    ...collectMissingRegistryFieldFindings(entry, propertyNames, isLocalProgram, entryPath),
    ...collectLocalProgramRegistryFieldFindings(entry, entryText, isLocalProgram, entryPath),
    ...collectWorkbenchRegistryFindings(entry, entryText, entryPath),
  ];
};

const collectMissingRegistryFieldFindings = (
  entry: RegistryEntry,
  propertyNames: Set<string>,
  isLocalProgram: boolean,
  entryPath: string,
): Finding[] => {
  const missingFields = (isLocalProgram ? LOCAL_PROGRAM_REGISTRY_REQUIRED_FIELDS : REGISTRY_REQUIRED_FIELDS).filter((field) => !propertyNames.has(field));
  return missingFields.length === 0
    ? []
    : [createFinding({ lawId: LAW_PACKAGE_SHAPE, file: entryPath, line: getNodeLine(entry), severity: "fatal", message: "Open metadata registry entry is missing required fields.", detail: missingFields.join(", ") })];
};

const collectLocalProgramRegistryFieldFindings = (
  entry: RegistryEntry,
  entryText: string,
  isLocalProgram: boolean,
  entryPath: string,
): Finding[] =>
  isLocalProgram && (entryText.includes("defaultUrl") || entryText.includes("allowedHostnames") || entryText.includes("allowedSchemes"))
    ? [createFinding({ lawId: LAW_LOCAL_PROGRAM, file: entryPath, line: getNodeLine(entry), severity: "fatal", message: "open-local-program registry entry must not carry fake URL/hostname/scheme fields." })]
    : [];

const collectWorkbenchRegistryFindings = (
  entry: RegistryEntry,
  entryText: string,
  entryPath: string,
): Finding[] =>
  entryText.includes('childCapabilityId: "open-local-workbench"') && entryText.includes('targetKind: "local-program"')
    ? [createFinding({ lawId: LAW_LOCAL_PROGRAM, file: entryPath, line: getNodeLine(entry), severity: "fatal", message: "open-local-workbench must not represent targetKind=local-program." })]
    : [];

export function runOpenRegistryShapeChecks(project: import("ts-morph").Project): Finding[] {
  const findings: Finding[] = [];
  const registrySource = getOpenSourceOrThrow(project, REGISTRY_PATH);
  const platformRegistrySource = getOpenSourceOrThrow(project, OPEN_PLATFORM_REGISTRY_ENTRIES_PATH);
  const localRegistrySource = getOpenSourceOrThrow(project, OPEN_LOCAL_REGISTRY_ENTRIES_PATH);
  const registryEntries = [
    ...getRegistryEntries(platformRegistrySource, "OPEN_PLATFORM_CHILDREN"),
    ...getRegistryEntries(localRegistrySource, "OPEN_LOCAL_CHILDREN"),
  ];
  const registryText = registrySource.getText();
  const hasRegistryOwnedSpreads = registryText.includes("...OPEN_PLATFORM_CHILDREN")
    && registryText.includes("...OPEN_LOCAL_CHILDREN");

  if (registryEntries.length !== CHILDREN.length || !hasRegistryOwnedSpreads) {
    findings.push(createFinding({ lawId: LAW_PACKAGE_SHAPE, file: REGISTRY_PATH, line: 1, severity: "fatal", message: "Open registry must contain one metadata entry for each governed child." }));
  }
  for (const entry of registryEntries) {
    findings.push(...collectRegistryEntryFindings(entry));
  }

  return findings;
}
