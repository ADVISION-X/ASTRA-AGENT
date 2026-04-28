import { listFilesRecursive } from "../../core/filesystem.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { createAuditProject, getClassMethod, getSourceFileOrThrow, getZodEnumValues, getZodObjectPropertyNames, hasPropertyAccessPath } from "../_shared/ast-helpers.js";

const LAW_ID = "GRASSEYE-LOCAL-PERSISTENCE-SCHEMA-001-V1";
const TYPES_PATH = "src/types/local-persistence.ts";
const STORE_PATH = "src/lib/storage/evidence-store/evidence-store-service.ts";

export async function inspectLocalPersistenceSchemaBoundary(repoRoot = "."): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const repoFiles = await listFilesRecursive(repoRoot, { ignoreDirs: ["node_modules", "dist", ".git", ".grasseye-data", ".grasseye-demo-data", ".grasseye-local"] });
  const forbiddenTests = repoFiles.filter((file) => /(^|\/)(tests|__tests__)\/|\.test\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(file));
  const project = createAuditProject();
  const typesFile = getSourceFileOrThrow(project, TYPES_PATH);
  const evidenceStore = getSourceFileOrThrow(project, STORE_PATH);

  const findings: Finding[] = [];

  const tableNames = getZodEnumValues(typesFile, "LocalDatabaseTableNameSchema");
  const pathLayoutFields = getZodObjectPropertyNames(typesFile, "LocalPersistencePathLayoutSchema");
  const rootFields = getZodObjectPropertyNames(typesFile, "LocalPersistenceRootSchema");
  const evidenceRecordFields = getZodObjectPropertyNames(typesFile, "EvidenceRecordSchema");
  const actionLogRecordFields = getZodObjectPropertyNames(typesFile, "StructuredActionLogRecordSchema");
  const exportSetFields = getZodObjectPropertyNames(typesFile, "ExportSetRecordSchema");
  const relationshipMapFields = getZodObjectPropertyNames(typesFile, "LocalPersistenceRelationshipMapSchema");

  const typesPassed = [
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
  if (!typesPassed) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: TYPES_PATH,
      line: 1,
      severity: "error",
      message: "Local persistence schemas must define governed tables, path layout, storage refs, and packet-versus-ledger relationships.",
    }));
  }

  const forbiddenSensitiveFields = ["accessToken", "refreshToken", "sessionToken", "cookieValue", "cookies", "password", "storageState"];
  const sensitiveFieldPresent = forbiddenSensitiveFields.find((field) => typesFile.getDescendants().some((descendant) => descendant.getText() === field)) ?? null;
  if (sensitiveFieldPresent) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: TYPES_PATH,
      line: 1,
      severity: "error",
      message: `Local persistence types must not persist ${sensitiveFieldPresent}.`,
    }));
  }

  const saveImageEvidenceMethod = getClassMethod(evidenceStore, "EvidenceStoreService", "saveImageEvidence");
  const saveStructuredRuntimeEventMethod = getClassMethod(evidenceStore, "EvidenceStoreService", "saveStructuredRuntimeEvent");
  const saveStructuredActionLogMethod = getClassMethod(evidenceStore, "EvidenceStoreService", "saveStructuredActionLog");
  const saveEvidencePacketMethod = getClassMethod(evidenceStore, "EvidenceStoreService", "saveEvidencePacket");
  const saveBrowseLedgerMethod = getClassMethod(evidenceStore, "EvidenceStoreService", "saveBrowseLedgerEntry");
  const persistenceSurfacePassed = Boolean(
    saveImageEvidenceMethod
    && saveStructuredRuntimeEventMethod
    && saveStructuredActionLogMethod
    && saveEvidencePacketMethod
    && saveBrowseLedgerMethod
    && hasPropertyAccessPath(saveImageEvidenceMethod, ["this", "stateStore", "write"])
    && hasPropertyAccessPath(saveStructuredRuntimeEventMethod, ["state", "structuredRuntimeEvents", "push"])
    && hasPropertyAccessPath(saveStructuredActionLogMethod, ["state", "structuredActionLogs", "push"])
    && hasPropertyAccessPath(saveEvidencePacketMethod, ["this", "stateStore", "write"])
    && hasPropertyAccessPath(saveBrowseLedgerMethod, ["this", "stateStore", "write"]),
  );
  if (!persistenceSurfacePassed) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: STORE_PATH,
      line: 1,
      severity: "error",
      message: "Evidence store must persist governed evidence, structured logs, packets, and browse-ledger records through explicit storage methods.",
    }));
  }

  if (forbiddenTests.length > 0) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: forbiddenTests[0] ?? "tests",
      line: 1,
      severity: "fatal",
      message: "Local persistence schema governance forbids repository test artifacts as quality truth.",
    }));
  }

  return {
    findings,
    phases: [
      createPhase("local-persistence-types", typesPassed && !sensitiveFieldPresent ? "PASS" : "CODE VIOLATION", typesPassed && !sensitiveFieldPresent, typesPassed && !sensitiveFieldPresent ? "Local persistence schemas define governed tables, path layout, storage refs, and relationship boundaries without sensitive session fields." : "Local persistence schemas are incomplete or include forbidden sensitive fields."),
      createPhase("local-persistence-store-surface", persistenceSurfacePassed ? "PASS" : "CODE VIOLATION", persistenceSurfacePassed, persistenceSurfacePassed ? "Evidence store exposes governed persistence methods for evidence, structured logs, packets, and browse-ledger records." : "Evidence store is missing governed persistence methods or write paths."),
      createPhase("local-persistence-test-boundary", forbiddenTests.length === 0 ? "PASS" : "FAKE ENFORCEMENT", forbiddenTests.length === 0, forbiddenTests.length === 0 ? "Repository contains no tests, __tests__, or *.test.* artifacts." : "Repository contains forbidden test artifacts."),
    ],
  };
}
