import { listFilesRecursive, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { getSourceFileOrThrow } from "../_shared/ast-helpers.js";

import { commanderConsoleInspectionConstants } from "./inspection-constants.js";
import { commanderConsoleInspectionUtils } from "./inspection-utils.js";

const {
  ABILITY_GROUP_PATH,
  CHILDREN_ROOT,
  CHILD_IDS,
  CONTRACT_PATH,
  INDEX_PATH,
  MANIFEST_PATH,
  REGISTRY_PATH,
  ROOT,
  SCHEMA_PATH,
  SHARED_SCHEMA_BASE_PATH,
} = commanderConsoleInspectionConstants;
const {
  childDirectoryFiles,
  countCommanderMissionDashboardDeclarations,
  functionContainsThrow,
  getCommanderSourceFiles,
  getRegistryImplementationChildIds,
  hasExportStar,
  hasRegistryMetadata,
  requiredFilesExist,
} = commanderConsoleInspectionUtils;

type StructureCheckResult = {
  findings: Finding[];
  exportStarPresent: boolean;
  registryThrows: boolean;
};

const REQUIRED_PUBLIC_SCHEMAS = [
  "CommanderConsoleInputSchema",
  "CommanderConsoleResultSchema",
  "CommanderTransportPayloadSchema",
  "RuntimeProofSchema",
  "CommanderCommandReceiptSchema",
] as const;

const REQUIRED_LAW_IDS = [
  "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-001-V2",
  "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V2",
  "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-003-V2",
  "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V2",
  "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-005-V2",
  "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V2",
  "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-007-V2",
  "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-008-V2",
] as const;

const loadCommanderSourceFiles = async (project: import("ts-morph").Project): Promise<void> => {
  const commanderFiles = await listFilesRecursive(pathFromRepoRoot(ROOT), { extensions: [".ts"] });
  for (const filePath of commanderFiles) {
    project.addSourceFileAtPathIfExists(filePath);
  }
};

const collectCanonicalShapeFindings = async (project: import("ts-morph").Project): Promise<Finding[]> => {
  const findings: Finding[] = [];
  const commanderSources = getCommanderSourceFiles(project);
  const schemaSource = getSourceFileOrThrow(project, SCHEMA_PATH);
  const sharedSchemaSource = getSourceFileOrThrow(project, SHARED_SCHEMA_BASE_PATH);

  if (!(await requiredFilesExist())) {
    findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V2", file: ROOT, line: 1, severity: "fatal", message: "Commander Console canonical production package is incomplete." }));
  }

  const childFiles = await listFilesRecursive(pathFromRepoRoot(CHILDREN_ROOT), { extensions: [".ts"] });
  const childFileSet = new Set(childFiles.map((filePath) => toRepoRelativePath(filePath)));
  for (const childId of CHILD_IDS) {
    for (const childFile of childDirectoryFiles(childId)) {
      if (!childFileSet.has(childFile)) {
        findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V2", file: childFile, line: 1, severity: "fatal", message: "Commander Console child package must contain contract.ts, schema.ts, and implementation.ts." }));
      }
    }
  }

  if (countCommanderMissionDashboardDeclarations(commanderSources) !== 1) {
    findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V2", file: SHARED_SCHEMA_BASE_PATH, line: 1, severity: "fatal", message: "CommanderMissionDashboardViewSchema must be declared exactly once in the Commander root." }));
  }

  const hasRequiredSchemas = REQUIRED_PUBLIC_SCHEMAS.every((name) => schemaSource.getFullText().includes(name) || sharedSchemaSource.getVariableDeclaration(name));
  if (!hasRequiredSchemas) {
    findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V2", file: SCHEMA_PATH, line: 1, severity: "fatal", message: "Commander schema surface is missing governed schema exports." }));
  }

  return findings;
};

const collectContractAndRegistryFindings = (project: import("ts-morph").Project): StructureCheckResult => {
  const findings: Finding[] = [];
  const contractSource = getSourceFileOrThrow(project, CONTRACT_PATH);
  const registrySource = getSourceFileOrThrow(project, REGISTRY_PATH);
  const indexSource = getSourceFileOrThrow(project, INDEX_PATH);

  const abilityGroupInterface = contractSource.getInterface("CommanderConsoleAbilityGroup");
  const publicMethodNames = abilityGroupInterface?.getMethods().map((method) => method.getName()) ?? [];
  if (!abilityGroupInterface || publicMethodNames.join(",") !== "listChildAbilityIds,execute") {
    findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-001-V2", file: CONTRACT_PATH, line: 1, severity: "fatal", message: "Commander Console public surface must expose only listChildAbilityIds and execute." }));
  }

  const registryChildIds = getRegistryImplementationChildIds(project, registrySource).sort().join(",");
  if (registryChildIds !== [...CHILD_IDS].sort().join(",") || !hasRegistryMetadata(registrySource)) {
    findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V2", file: REGISTRY_PATH, line: 1, severity: "fatal", message: "registry.ts must register every Commander child implementation with full metadata." }));
  }

  const registryThrows = functionContainsThrow(registrySource, "getCommanderConsoleChild");
  if (registryThrows) {
    findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V2", file: REGISTRY_PATH, line: 1, severity: "fatal", message: "getCommanderConsoleChild must return null when a child is missing, not throw." }));
  }

  const exportStarPresent = hasExportStar(indexSource);
  if (exportStarPresent) {
    findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V2", file: INDEX_PATH, line: 1, severity: "fatal", message: "Commander index.ts must not use export-star barrels." }));
  }

  return { findings, exportStarPresent, registryThrows };
};

const collectManifestFindings = async (): Promise<Finding[]> => {
  const manifestText = await readTextFile(pathFromRepoRoot(MANIFEST_PATH));
  const manifest = JSON.parse(manifestText) as { allowedLawIds?: string[]; entry?: string };
  const manifestValid = manifest.entry === "scripts/audit/domains/commander-console-capability/inspector.ts"
    && REQUIRED_LAW_IDS.every((lawId) => manifest.allowedLawIds?.includes(lawId));
  return manifestValid
    ? []
    : [createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V2", file: MANIFEST_PATH, line: 1, severity: "fatal", message: "Commander manifest must point at this inspector and carry all active commander law IDs." })];
};

export async function runCommanderStructureChecks(project: import("ts-morph").Project): Promise<StructureCheckResult> {
  await loadCommanderSourceFiles(project);
  const canonicalFindings = await collectCanonicalShapeFindings(project);
  const registryResult = collectContractAndRegistryFindings(project);
  const manifestFindings = await collectManifestFindings();
  return {
    findings: [...canonicalFindings, ...registryResult.findings, ...manifestFindings],
    exportStarPresent: registryResult.exportStarPresent,
    registryThrows: registryResult.registryThrows,
  };
}