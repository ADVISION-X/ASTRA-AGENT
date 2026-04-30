import { listFilesRecursive } from "../../core/filesystem.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { getClassMethod, getZodEnumValues, getZodObjectPropertyNames } from "../_shared/ast-schema-queries.js";
import { createAuditProject, getSourceFileOrThrow, hasPropertyAccessPath } from "../_shared/ast-helpers.js";

const LAW_ID = "GRASSEYE-LOCAL-PERSISTENCE-SCHEMA-001-V1";
const TYPES_PATH = "src/types/local-persistence.ts";
const STORE_PATH = "src/lib/storage/evidence-store/evidence-store-service.ts";

function checkTypesSurface(typesFile: ReturnType<typeof getSourceFileOrThrow>): boolean {
  const tableNames = getZodEnumValues(typesFile, "LocalDatabaseTableNameSchema");
  const pathLayoutFields = getZodObjectPropertyNames(typesFile, "LocalPersistencePathLayoutSchema");
  const rootFields = getZodObjectPropertyNames(typesFile, "LocalPersistenceRootSchema");
  const evidenceRecordFields = getZodObjectPropertyNames(typesFile, "EvidenceRecordSchema");
  const actionLogRecordFields = getZodObjectPropertyNames(typesFile, "StructuredActionLogRecordSchema");
  const exportSetFields = getZodObjectPropertyNames(typesFile, "ExportSetRecordSchema");
  const relationshipMapFields = getZodObjectPropertyNames(typesFile, "LocalPersistenceRelationshipMapSchema");

  return [
    tableNames.includes("browse_sessions"),
    tableNames.includes("structured_runtime_events"),
    tableNames.includes("structured_action_logs"),
    tableNames.includes("evidence_packets"),
    tableNames.includes("browse_ledger_entries"),
    tableNames.includes("export_sets"),
    pathLayoutFields.has("rootDir"),
    pathLayoutFields.has("databaseFile"),
    pathLayoutFields.has("videoFramesDir"),
    pathLayoutFields.has("contactSheetsDir"),
    pathLayoutFields.has("commentScreenshotsDir"),
    pathLayoutFields.has("advancedAiExportsDir"),
    pathLayoutFields.has("browserProfilesDir"),
    rootFields.has("structuredStoreKind"),
    rootFields.has("evidenceStoreKind"),
    rootFields.has("exportStoreKind"),
    rootFields.has("browserProfileStoreKind"),
    evidenceRecordFields.has("storageRef"),
    evidenceRecordFields.has("screenshotHash"),
    actionLogRecordFields.has("actionPurpose"),
    exportSetFields.has("packetCount"),
    exportSetFields.has("storageRef"),
    relationshipMapFields.has("productYesRoundToEvidencePacket"),
    relationshipMapFields.has("productNoRoundToBrowseLedgerEntry"),
    relationshipMapFields.has("browserProfileToRuntime"),
  ].every(Boolean);
}

function findSensitiveField(typesFile: ReturnType<typeof getSourceFileOrThrow>): string | null {
  const forbiddenSensitiveFields = ["accessToken", "refreshToken", "sessionToken", "cookieValue", "cookies", "password", "storageState"];
  return forbiddenSensitiveFields.find((field) => typesFile.getDescendants().some((descendant) => descendant.getText() === field)) ?? null;
}

function getPersistenceMethods(evidenceStore: ReturnType<typeof getSourceFileOrThrow>) {
  return {
    saveImageEvidenceMethod: getClassMethod(evidenceStore, "EvidenceStoreService", "saveImageEvidence"),
    saveStructuredRuntimeEventMethod: getClassMethod(evidenceStore, "EvidenceStoreService", "saveStructuredRuntimeEvent"),
    saveStructuredActionLogMethod: getClassMethod(evidenceStore, "EvidenceStoreService", "saveStructuredActionLog"),
    saveEvidencePacketMethod: getClassMethod(evidenceStore, "EvidenceStoreService", "saveEvidencePacket"),
    saveBrowseLedgerMethod: getClassMethod(evidenceStore, "EvidenceStoreService", "saveBrowseLedgerEntry"),
  };
}

function hasRequiredPersistenceMethods(methods: ReturnType<typeof getPersistenceMethods>): boolean {
  return Boolean(
    methods.saveImageEvidenceMethod
    && methods.saveStructuredRuntimeEventMethod
    && methods.saveStructuredActionLogMethod
    && methods.saveEvidencePacketMethod
    && methods.saveBrowseLedgerMethod,
  );
}

function writesImageEvidence(methods: ReturnType<typeof getPersistenceMethods>): boolean {
  return Boolean(methods.saveImageEvidenceMethod && hasPropertyAccessPath(methods.saveImageEvidenceMethod, ["this", "stateStore", "write"]));
}

function writesStructuredRuntimeEvent(methods: ReturnType<typeof getPersistenceMethods>): boolean {
  return Boolean(methods.saveStructuredRuntimeEventMethod && hasPropertyAccessPath(methods.saveStructuredRuntimeEventMethod, ["state", "structuredRuntimeEvents", "push"]));
}

function writesStructuredActionLog(methods: ReturnType<typeof getPersistenceMethods>): boolean {
  return Boolean(methods.saveStructuredActionLogMethod && hasPropertyAccessPath(methods.saveStructuredActionLogMethod, ["state", "structuredActionLogs", "push"]));
}

function writesEvidencePacket(methods: ReturnType<typeof getPersistenceMethods>): boolean {
  return Boolean(methods.saveEvidencePacketMethod && hasPropertyAccessPath(methods.saveEvidencePacketMethod, ["this", "stateStore", "write"]));
}

function writesBrowseLedger(methods: ReturnType<typeof getPersistenceMethods>): boolean {
  return Boolean(methods.saveBrowseLedgerMethod && hasPropertyAccessPath(methods.saveBrowseLedgerMethod, ["this", "stateStore", "write"]));
}

function hasRequiredPersistenceWrites(methods: ReturnType<typeof getPersistenceMethods>): boolean {
  return writesImageEvidence(methods)
    && writesStructuredRuntimeEvent(methods)
    && writesStructuredActionLog(methods)
    && writesEvidencePacket(methods)
    && writesBrowseLedger(methods);
}

function checkPersistenceSurface(evidenceStore: ReturnType<typeof getSourceFileOrThrow>): boolean {
  const methods = getPersistenceMethods(evidenceStore);
  return hasRequiredPersistenceMethods(methods) && hasRequiredPersistenceWrites(methods);
}

function createTypesPhase(typesPassed: boolean, sensitiveFieldPresent: string | null): InspectorPhase {
  return createPhase("local-persistence-types", typesPassed && !sensitiveFieldPresent ? "PASS" : "CODE VIOLATION", typesPassed && !sensitiveFieldPresent, typesPassed && !sensitiveFieldPresent ? "Local persistence schemas define governed tables, path layout, storage refs, and relationship boundaries without sensitive session fields." : "Local persistence schemas are incomplete or include forbidden sensitive fields.");
}

function createStoreSurfacePhase(persistenceSurfacePassed: boolean): InspectorPhase {
  return createPhase("local-persistence-store-surface", persistenceSurfacePassed ? "PASS" : "CODE VIOLATION", persistenceSurfacePassed, persistenceSurfacePassed ? "Evidence store exposes governed persistence methods for evidence, structured logs, packets, and browse-ledger records." : "Evidence store is missing governed persistence methods or write paths.");
}

function createTestBoundaryPhase(forbiddenTests: string[]): InspectorPhase {
  return createPhase("local-persistence-test-boundary", forbiddenTests.length === 0 ? "PASS" : "FAKE ENFORCEMENT", forbiddenTests.length === 0, forbiddenTests.length === 0 ? "Repository contains no tests, __tests__, or *.test.* artifacts." : "Repository contains forbidden test artifacts.");
}

function collectTypesFindings(typesPassed: boolean): Finding[] {
  return typesPassed
    ? []
    : [createFinding({ lawId: LAW_ID, file: TYPES_PATH, line: 1, severity: "error", message: "Local persistence schemas must define governed tables, path layout, storage refs, and packet-versus-ledger relationships." })];
}

function collectSensitiveFieldFindings(sensitiveFieldPresent: string | null): Finding[] {
  return sensitiveFieldPresent
    ? [createFinding({ lawId: LAW_ID, file: TYPES_PATH, line: 1, severity: "error", message: `Local persistence types must not persist ${sensitiveFieldPresent}.` })]
    : [];
}

function collectPersistenceSurfaceFindings(persistenceSurfacePassed: boolean): Finding[] {
  return persistenceSurfacePassed
    ? []
    : [createFinding({ lawId: LAW_ID, file: STORE_PATH, line: 1, severity: "error", message: "Evidence store must persist governed evidence, structured logs, packets, and browse-ledger records through explicit storage methods." })];
}

function collectForbiddenTestFindings(forbiddenTests: string[]): Finding[] {
  return forbiddenTests.length > 0
    ? [createFinding({ lawId: LAW_ID, file: forbiddenTests[0] ?? "tests", line: 1, severity: "fatal", message: "Local persistence schema governance forbids repository test artifacts as quality truth." })]
    : [];
}

export async function inspectLocalPersistenceSchemaBoundary(repoRoot = "."): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const repoFiles = await listFilesRecursive(repoRoot, { ignoreDirs: ["node_modules", "dist", ".git", ".grasseye-data", ".grasseye-demo-data", ".grasseye-local"] });
  const forbiddenTests = repoFiles.filter((file) => /(^|\/)(tests|__tests__)\/|\.test\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(file));
  const project = createAuditProject();
  const typesFile = getSourceFileOrThrow(project, TYPES_PATH);
  const evidenceStore = getSourceFileOrThrow(project, STORE_PATH);

  const findings: Finding[] = [];

  const typesPassed = checkTypesSurface(typesFile);
  findings.push(...collectTypesFindings(typesPassed));

  const sensitiveFieldPresent = findSensitiveField(typesFile);
  findings.push(...collectSensitiveFieldFindings(sensitiveFieldPresent));

  const persistenceSurfacePassed = checkPersistenceSurface(evidenceStore);
  findings.push(...collectPersistenceSurfaceFindings(persistenceSurfacePassed));

  findings.push(...collectForbiddenTestFindings(forbiddenTests));

  return {
    findings,
    phases: [
      createTypesPhase(typesPassed, sensitiveFieldPresent),
      createStoreSurfacePhase(persistenceSurfacePassed),
      createTestBoundaryPhase(forbiddenTests),
    ],
  };
}
