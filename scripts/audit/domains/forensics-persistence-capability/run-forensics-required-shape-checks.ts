import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { getZodEnumValues } from "../_shared/ast-schema-queries.js";
import { getSourceFileOrThrow } from "../_shared/ast-helpers.js";

import { forensicsPersistenceInspectionConstants } from "./inspection-constants.js";
import { forensicsPersistenceInspectionUtils } from "./inspection-utils.js";

const {
  ABILITY_GROUP_PATH,
  CHILDREN_ROOT,
  CONTRACT_PATH,
  LAW_CHILDREN,
  LAW_CONTRACT,
  LAW_OWNER,
  PORTS_ROOT,
  RECORD_ID_PATH,
  REGISTRY_PATH,
  REQUIRED_CHILDREN,
  REQUIRED_PORT_FILES,
  REQUIRED_RUNTIME_FILES,
  REQUIRED_SCHEMA_ENUM_VALUES,
  REQUIRED_SHARED_FILES,
  ROOT,
  RUNTIME_ROOT,
  SCHEMA_PATH,
  SHARED_ROOT,
} = forensicsPersistenceInspectionConstants;
const {
  abilityGroupHasThrow,
  abilityGroupTouchesStorage,
  childImplementationBypassesExecutor,
  getResolvedModulePath,
  hasRecordUnknownType,
} = forensicsPersistenceInspectionUtils;

const getRequiredFiles = (): string[] => {
  return [
    SCHEMA_PATH,
    CONTRACT_PATH,
    ABILITY_GROUP_PATH,
    REGISTRY_PATH,
    `${ROOT}/index.ts`,
    RECORD_ID_PATH,
    ...REQUIRED_RUNTIME_FILES.map((fileName) => `${RUNTIME_ROOT}/${fileName}`),
    ...REQUIRED_PORT_FILES.map((fileName) => `${PORTS_ROOT}/${fileName}`),
    ...REQUIRED_SHARED_FILES.map((fileName) => `${SHARED_ROOT}/${fileName}`),
    ...REQUIRED_CHILDREN.flatMap((childId) => [
      `${CHILDREN_ROOT}/${childId}/contract.ts`,
      `${CHILDREN_ROOT}/${childId}/schema.ts`,
      `${CHILDREN_ROOT}/${childId}/implementation.ts`,
    ]),
  ];
};

const collectMissingFileFindings = async (): Promise<Finding[]> => {
  const missingFiles: string[] = [];

  for (const relativePath of getRequiredFiles()) {
    if (!(await fileExists(pathFromRepoRoot(relativePath)))) {
      missingFiles.push(relativePath);
    }
  }

  return missingFiles.length > 0
    ? [createFinding({ lawId: LAW_OWNER, file: missingFiles[0] ?? ROOT, line: 1, severity: "fatal", message: "Forensics Persistence is missing required capability root files.", detail: missingFiles.join(", ") })]
    : [];
};

const collectSchemaFindings = (project: import("ts-morph").Project): Finding[] => {
  const findings: Finding[] = [];
  const schemaSource = getSourceFileOrThrow(project, SCHEMA_PATH);
  const childIds = new Set(getZodEnumValues(schemaSource, "ForensicsChildCapabilityIdSchema"));
  const missingChildIds = REQUIRED_SCHEMA_ENUM_VALUES.filter((childId) => !childIds.has(childId));

  if (missingChildIds.length > 0) {
    findings.push(createFinding({ lawId: LAW_CONTRACT, file: SCHEMA_PATH, line: 1, severity: "error", message: "Forensics child schema ids are incomplete.", detail: missingChildIds.join(", ") }));
  }
  if (hasRecordUnknownType(schemaSource)) {
    findings.push(createFinding({ lawId: LAW_CONTRACT, file: SCHEMA_PATH, line: 1, severity: "fatal", message: "Forensics schema still exposes Record<string, unknown> as a production payload shape." }));
  }

  return findings;
};

const collectAbilityGroupFindings = (project: import("ts-morph").Project): Finding[] => {
  const abilityGroupSource = getSourceFileOrThrow(project, ABILITY_GROUP_PATH);
  return abilityGroupTouchesStorage(abilityGroupSource) || abilityGroupHasThrow(abilityGroupSource)
    ? [createFinding({ lawId: LAW_OWNER, file: ABILITY_GROUP_PATH, line: 1, severity: "error", message: "Forensics ability-group must stay thin and governed; it cannot write storage directly or throw through execute." })]
    : [];
};

const collectRegistryFindings = (project: import("ts-morph").Project): Finding[] => {
  const registrySource = getSourceFileOrThrow(project, REGISTRY_PATH);
  const importedRegistryChildren = new Set(
    registrySource.getImportDeclarations()
      .map((declaration) => getResolvedModulePath(declaration))
      .filter((targetPath): targetPath is string => targetPath !== null && targetPath.startsWith(`${CHILDREN_ROOT}/`) && targetPath.endsWith("/implementation.ts"))
      .map((targetPath) => {
        const relativeChildPath = targetPath.slice(`${CHILDREN_ROOT}/`.length);
        const slashIndex = relativeChildPath.indexOf("/");
        return slashIndex >= 0 ? relativeChildPath.slice(0, slashIndex) : relativeChildPath;
      }),
  );
  const missingRegisteredChildren = REQUIRED_CHILDREN.filter((childId) => !importedRegistryChildren.has(childId));

  return missingRegisteredChildren.length > 0
    ? [createFinding({ lawId: LAW_CHILDREN, file: REGISTRY_PATH, line: 1, severity: "fatal", message: "Forensics registry is missing required child capabilities.", detail: missingRegisteredChildren.join(", ") })]
    : [];
};

const collectChildImplementationFindings = (project: import("ts-morph").Project): Finding[] => {
  return REQUIRED_CHILDREN.flatMap((childId) => {
    const implementationPath = `${CHILDREN_ROOT}/${childId}/implementation.ts`;
    const sourceFile = getSourceFileOrThrow(project, implementationPath);
    return childImplementationBypassesExecutor(sourceFile)
      ? [createFinding({ lawId: LAW_CHILDREN, file: implementationPath, line: 1, severity: "error", message: "Forensics child implementations must execute through the shared executor and cannot write storage directly." })]
      : [];
  });
};

export async function runForensicsRequiredShapeChecks(project: import("ts-morph").Project): Promise<Finding[]> {
  return [
    ...(await collectMissingFileFindings()),
    ...collectSchemaFindings(project),
    ...collectAbilityGroupFindings(project),
    ...collectRegistryFindings(project),
    ...collectChildImplementationFindings(project),
  ];
}