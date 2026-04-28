import { Node, SyntaxKind, type CallExpression, type ExportDeclaration, type ImportDeclaration, type SourceFile } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import type { Finding } from "../../core/schema.js";
import {
  createAuditProject,
  getSourceFileOrThrow,
  getTypeAliasPropertyNames,
  hasInterfaceMethod,
} from "../_shared/ast-helpers.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";
import { inspectLocalPersistenceSchemaBoundary } from "../local-persistence-schema/inspector.js";
import { inspectMultiFrameForensicsBoundary } from "../multi-frame-evidence/inspector.js";
import { inspectStructuredLoggingBoundary } from "../structured-logging/inspector.js";

const LAW_OWNER = "GRASSEYE-FORENSICS-PERSISTENCE-001-V1";
const LAW_CHILDREN = "GRASSEYE-FORENSICS-PERSISTENCE-002-V1";
const LAW_BOUNDARY = "GRASSEYE-FORENSICS-PERSISTENCE-003-V1";
const LAW_RETIRED_ROOT = "GRASSEYE-FORENSICS-PERSISTENCE-004-V1";
const LAW_ENFORCEMENT = "GRASSEYE-FORENSICS-PERSISTENCE-005-V1";
const LAW_CONTRACT = "GRASSEYE-FORENSICS-PERSISTENCE-006-V2";
const LAW_STORAGE = "GRASSEYE-FORENSICS-PERSISTENCE-007-V2";
const LAW_RUNTIME = "GRASSEYE-FORENSICS-PERSISTENCE-008-V2";

const ROOT = "src/capabilities/forensics-persistence";
const CHILDREN_ROOT = `${ROOT}/children`;
const SHARED_ROOT = `${ROOT}/shared`;
const CONTRACT_PATH = `${ROOT}/contract.ts`;
const ABILITY_GROUP_PATH = `${ROOT}/ability-group.ts`;
const REGISTRY_PATH = `${ROOT}/registry.ts`;
const STORAGE_PORT_PATH = `${ROOT}/storage-ports.ts`;
const INDEX_PATH = `${ROOT}/index.ts`;
const RECORD_ID_PATH = `${ROOT}/record-id.ts`;
const RECORD_ENVELOPE_PATH = `${SHARED_ROOT}/record-envelope.ts`;
const RESULT_PATH = `${SHARED_ROOT}/persistence-result.ts`;
const RUNTIME_ROOT = `${ROOT}/runtime`;
const SHARED_STORE_ROOT = `${ROOT}/shared/store`;
const WORKBENCH_PATH = "src/lib/local-runtime/workbench.ts";
const LEGACY_LOCAL_DATA_ROOT = "src/features/local-data";
const LEGACY_VERIFY_ROOT = "scripts/verify";
const EVIDENCE_STORE_SERVICE_PATH = "src/lib/storage/evidence-store/evidence-store-service.ts";
const EVIDENCE_STORE_ADAPTER_PATH = "src/lib/storage/evidence-store/forensics-storage-adapter.ts";
const INSPECTOR_PATH = "scripts/audit/domains/forensics-persistence-capability/inspector.ts";

const REQUIRED_CHILDREN = [
  "write-structured-runtime-event",
  "write-structured-action-log",
  "write-evidence-record",
  "write-ai-result-record",
  "finalize-browse-ledger",
  "finalize-evidence-packet",
  "finalize-failed-record",
  "update-runtime-snapshot",
] as const;

const REQUIRED_SHARED_FILES = [
  "record-envelope.ts",
  "record-ref.ts",
  "artifact-ref.ts",
  "persistence-result.ts",
  "persistence-policy.ts",
  "integrity-policy.ts",
  "failure.ts",
  "runtime-proof.ts",
] as const;

const REQUIRED_ROOT_FILES = [
  CONTRACT_PATH,
  ABILITY_GROUP_PATH,
  REGISTRY_PATH,
  STORAGE_PORT_PATH,
  INDEX_PATH,
  RECORD_ID_PATH,
  ...REQUIRED_SHARED_FILES.map((fileName) => `${SHARED_ROOT}/${fileName}`),
  ...REQUIRED_CHILDREN.map((childId) => `${CHILDREN_ROOT}/${childId}/implementation.ts`),
] as const;

const REQUIRED_RECORD_TYPES = new Set([
  "structured_runtime_event",
  "structured_action_log",
  "evidence_record",
  "ai_result_record",
  "browse_ledger_entry",
  "evidence_packet",
  "failed_record",
  "runtime_snapshot",
] as const);

const CONTRACT_FORBIDDEN_TYPE_NAMES = new Set([
  "ProductDiscoveryEvidencePacket",
  "BrowseLedgerEntry",
  "RoundStructuralLog",
  "RoundLifecycleEvent",
  "LocalAiTaskResult",
  "ActionLog",
  "AgentRound",
  "TaskRun",
  "RuntimeDeliveryState",
  "ProductOpportunityCandidate",
]);

const BOUNDARY_FORBIDDEN_IDENTIFIER_NAMES = new Set([
  "BrowserController",
  "ProductOpportunityCandidate",
  "RuntimeDeliveryState",
  "AgentRound",
  "LocalAiTaskResult",
  "ActionLog",
  "BrowseLedgerEntry",
  "ProductDiscoveryEvidencePacket",
]);

const PATH_FORBIDDEN_TOKENS = new Set(["compat", "legacy", "bridge", "mock", "fake", "fixture", "demo"]);

const FINAL_WRITE_METHODS = new Set([
  "saveStructuredRuntimeEvent",
  "saveStructuredActionLog",
  "saveAiResult",
  "saveEvidencePacket",
  "saveBrowseLedgerEntry",
  "rebuildAdvancedAiExportSet",
]);

const INSPECTOR_FORBIDDEN_CALL_NAMES = new Set(["includes", "match", "search", "replace"]);
const COMMENT_DIRECTIVES = ["@ts-ignore", "@ts-expect-error", "eslint-disable"] as const;

type SourceEntry = {
  relativePath: string;
  sourceFile: SourceFile;
};

function splitPathSegments(value: string): string[] {
  return value.split("/").filter((segment) => segment.length > 0);
}

function pathHasPrefix(target: string, prefix: string): boolean {
  const targetSegments = splitPathSegments(target);
  const prefixSegments = splitPathSegments(prefix);
  return prefixSegments.every((segment, index) => targetSegments[index] === segment);
}

function pathHasSuffix(target: string, suffix: string): boolean {
  const targetSegments = splitPathSegments(target);
  const suffixSegments = splitPathSegments(suffix);
  if (suffixSegments.length > targetSegments.length) {
    return false;
  }

  const offset = targetSegments.length - suffixSegments.length;
  return suffixSegments.every((segment, index) => targetSegments[offset + index] === segment);
}

function pathHasToken(target: string, tokenSet: ReadonlySet<string>): boolean {
  return splitPathSegments(target).some((segment) => tokenSet.has(segment));
}

function getResolvedModulePath(declaration: ImportDeclaration | ExportDeclaration): string | null {
  const sourceFile = declaration.getModuleSpecifierSourceFile();
  return sourceFile ? toRepoRelativePath(sourceFile.getFilePath()) : null;
}

function createSourceEntries(project: ReturnType<typeof createAuditProject>): SourceEntry[] {
  return project.getSourceFiles().map((sourceFile) => ({
    relativePath: toRepoRelativePath(sourceFile.getFilePath()),
    sourceFile,
  }));
}

function collectComments(sourceFile: SourceFile): string[] {
  const comments = new Set<string>();
  const nodes: Node[] = [sourceFile, ...sourceFile.getDescendants()];
  for (const node of nodes) {
    for (const range of node.getLeadingCommentRanges()) {
      comments.add(range.getText());
    }
    for (const range of node.getTrailingCommentRanges()) {
      comments.add(range.getText());
    }
  }
  return [...comments];
}

function hasCommentDirective(sourceFile: SourceFile): boolean {
  return collectComments(sourceFile).some((commentText) => COMMENT_DIRECTIVES.some((directive) => commentText.indexOf(directive) >= 0));
}

function isRootSourcePath(relativePath: string): boolean {
  return pathHasPrefix(relativePath, ROOT);
}

function isChildSourcePath(relativePath: string): boolean {
  return pathHasPrefix(relativePath, CHILDREN_ROOT);
}

function getRegisteredChildIds(registrySource: SourceFile): Set<string> {
  const createRegistryFunction = registrySource.getFunction("createForensicsPersistenceRegistry");
  if (!createRegistryFunction) {
    return new Set();
  }

  const childIds = new Set<string>();
  for (const arrayLiteral of createRegistryFunction.getDescendantsOfKind(SyntaxKind.ArrayLiteralExpression)) {
    const elements = arrayLiteral.getElements();
    if (elements.length !== 2) {
      continue;
    }

    const firstElement = elements[0];
    if (!Node.isStringLiteral(firstElement)) {
      continue;
    }

    childIds.add(firstElement.getLiteralText());
  }

  return childIds;
}

function getRecordTypeValues(sourceFile: SourceFile): Set<string> {
  const typeAlias = sourceFile.getTypeAlias("ForensicsRecordType");
  const typeNode = typeAlias?.getTypeNode();
  if (!typeNode || !Node.isUnionTypeNode(typeNode)) {
    return new Set();
  }

  const values = new Set<string>();
  for (const node of typeNode.getTypeNodes()) {
    if (!Node.isLiteralTypeNode(node)) {
      continue;
    }

    const literal = node.getLiteral();
    if (Node.isStringLiteral(literal)) {
      values.add(literal.getLiteralText());
    }
  }

  return values;
}

function getForbiddenTypeIdentifiers(sourceFile: SourceFile): string[] {
  const seen = new Set<string>();
  for (const identifier of sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)) {
    const text = identifier.getText();
    if (CONTRACT_FORBIDDEN_TYPE_NAMES.has(text)) {
      seen.add(text);
    }
  }
  return [...seen];
}

function isForbiddenTypeImportPath(relativePath: string): boolean {
  return relativePath === "src/types/evidence-packet.ts"
    || relativePath === "src/types/local-ai.ts"
    || relativePath === "src/types/runtime.ts"
    || relativePath === "src/types/task-run.ts"
    || relativePath === "src/types/platform-action.ts";
}

function isBoundaryForbiddenImportPath(relativePath: string): boolean {
  return pathHasPrefix(relativePath, "src/capabilities/screenshot")
    || pathHasPrefix(relativePath, "src/capabilities/mouse-click")
    || pathHasPrefix(relativePath, "src/capabilities/mouse-scroll")
    || pathHasPrefix(relativePath, "src/capabilities/open")
    || pathHasPrefix(relativePath, "src/capabilities/page-state")
    || pathHasPrefix(relativePath, "src/capabilities/visual-target")
    || pathHasPrefix(relativePath, "src/lib/browser")
    || pathHasPrefix(relativePath, "src/features/platform-action");
}

function getForbiddenRootSourcePaths(rootEntries: SourceEntry[]): string[] {
  return rootEntries
    .map((entry) => entry.relativePath)
    .filter((relativePath) => pathHasToken(relativePath, PATH_FORBIDDEN_TOKENS) || pathHasSuffix(relativePath, "capability-check.ts"));
}

function getExternalChildLeakage(entries: SourceEntry[]): string[] {
  const violations = new Set<string>();

  for (const entry of entries) {
    const rootPath = entry.relativePath;
    for (const declaration of entry.sourceFile.getImportDeclarations()) {
      const targetPath = getResolvedModulePath(declaration);
      if (!targetPath || !isChildSourcePath(targetPath) || isRootSourcePath(rootPath)) {
        continue;
      }

      violations.add(rootPath);
    }

    for (const declaration of entry.sourceFile.getExportDeclarations()) {
      const targetPath = getResolvedModulePath(declaration);
      if (!targetPath || !isChildSourcePath(targetPath) || isChildSourcePath(rootPath)) {
        continue;
      }

      violations.add(rootPath);
    }
  }

  return [...violations];
}

function getRootBoundaryImportViolations(rootEntries: SourceEntry[]): string[] {
  const violations = new Set<string>();
  for (const entry of rootEntries) {
    for (const declaration of entry.sourceFile.getImportDeclarations()) {
      const targetPath = getResolvedModulePath(declaration);
      if (targetPath && isBoundaryForbiddenImportPath(targetPath)) {
        violations.add(entry.relativePath);
      }
    }
  }
  return [...violations];
}

function getContractImportViolations(contractSource: SourceFile): string[] {
  const violations = new Set<string>();
  for (const declaration of contractSource.getImportDeclarations()) {
    const targetPath = getResolvedModulePath(declaration);
    if (targetPath && isForbiddenTypeImportPath(targetPath)) {
      violations.add(targetPath);
    }
  }
  return [...violations];
}

function getIndexChildExportViolations(indexSource: SourceFile): string[] {
  const violations = new Set<string>();
  for (const declaration of indexSource.getExportDeclarations()) {
    const targetPath = getResolvedModulePath(declaration);
    if (targetPath && isChildSourcePath(targetPath)) {
      violations.add(targetPath);
    }
  }
  return [...violations];
}

function getInspectorAntiEscapeViolations(inspectorSource: SourceFile): string[] {
  const violations = new Set<string>();

  if (inspectorSource.getDescendantsOfKind(SyntaxKind.RegularExpressionLiteral).length > 0) {
    violations.add("regex-literal");
  }

  for (const callExpression of inspectorSource.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expression = callExpression.getExpression();
    if (Node.isPropertyAccessExpression(expression) && INSPECTOR_FORBIDDEN_CALL_NAMES.has(expression.getName())) {
      violations.add(expression.getName());
    }
  }

  return [...violations];
}

function getRootAntiEscapeViolations(rootEntries: SourceEntry[]): string[] {
  const violations = new Set<string>();

  for (const entry of rootEntries) {
    if (entry.sourceFile.getDescendantsOfKind(SyntaxKind.AnyKeyword).length > 0) {
      violations.add(entry.relativePath);
      continue;
    }

    if (hasCommentDirective(entry.sourceFile)) {
      violations.add(entry.relativePath);
      continue;
    }

    for (const callExpression of entry.sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const expression = callExpression.getExpression();
      if (expression.getKind() === SyntaxKind.ImportKeyword) {
        violations.add(entry.relativePath);
        break;
      }

      if (Node.isIdentifier(expression) && expression.getText() === "require") {
        violations.add(entry.relativePath);
        break;
      }
    }

    if (violations.has(entry.relativePath)) {
      continue;
    }

    for (const asExpression of entry.sourceFile.getDescendantsOfKind(SyntaxKind.AsExpression)) {
      const typeNode = asExpression.getTypeNode();
      if (!typeNode) {
        continue;
      }

      if (typeNode.getKind() === SyntaxKind.AnyKeyword) {
        violations.add(entry.relativePath);
        break;
      }

      const innerExpression = asExpression.getExpression();
      if (!Node.isAsExpression(innerExpression)) {
        continue;
      }

      const innerTypeNode = innerExpression.getTypeNode();
      if (innerTypeNode && innerTypeNode.getKind() === SyntaxKind.UnknownKeyword) {
        violations.add(entry.relativePath);
        break;
      }
    }
  }

  return [...violations];
}

function isEvidenceStoreMethodCall(callExpression: CallExpression): boolean {
  const expression = callExpression.getExpression();
  if (!Node.isPropertyAccessExpression(expression)) {
    return false;
  }

  if (!FINAL_WRITE_METHODS.has(expression.getName())) {
    return false;
  }

  const symbol = expression.getNameNode().getSymbol() ?? expression.getSymbol();
  if (!symbol) {
    return false;
  }

  const targetSymbol = symbol.getAliasedSymbol() ?? symbol;
  return targetSymbol.getDeclarations().some((declaration) => {
    if (!Node.isMethodDeclaration(declaration)) {
      return false;
    }

    const classDeclaration = declaration.getFirstAncestorByKind(SyntaxKind.ClassDeclaration);
    if (!classDeclaration || classDeclaration.getName() !== "EvidenceStoreService") {
      return false;
    }

    return toRepoRelativePath(declaration.getSourceFile().getFilePath()) === EVIDENCE_STORE_SERVICE_PATH;
  });
}

function getDirectEvidenceStoreWriteViolations(entries: SourceEntry[]): string[] {
  const violations = new Set<string>();
  for (const entry of entries) {
    if (entry.relativePath === EVIDENCE_STORE_SERVICE_PATH || entry.relativePath === EVIDENCE_STORE_ADAPTER_PATH) {
      continue;
    }

    for (const callExpression of entry.sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      if (isEvidenceStoreMethodCall(callExpression)) {
        violations.add(entry.relativePath);
      }
    }
  }

  return [...violations];
}

function getBoundaryForbiddenIdentifierViolations(rootEntries: SourceEntry[]): string[] {
  const violations = new Set<string>();
  for (const entry of rootEntries) {
    for (const identifier of entry.sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)) {
      if (BOUNDARY_FORBIDDEN_IDENTIFIER_NAMES.has(identifier.getText())) {
        violations.add(entry.relativePath);
      }
    }
  }
  return [...violations];
}

export default createPendingDomainInspector({
  inspector: "GrassEye Forensics Persistence Owner Inspector",
  inspectorId: "forensics-persistence-owner",
  capabilityDomain: "forensics-persistence-capability",
  inspectorEntry: INSPECTOR_PATH,
  ownedPaths: [ROOT],
  pendingSummary: "forensics-persistence is being hardened into a clean record-envelope owner",
  implementedSummary: "forensics-persistence owns durable record writing through a clean contract and rejects runtime/store escape hatches",
  extraChecks: async () => {
    const findings: Finding[] = [];
    const project = createAuditProject();
    const entries = createSourceEntries(project);
    const rootEntries = entries.filter((entry) => isRootSourcePath(entry.relativePath));
    const contractSource = getSourceFileOrThrow(project, CONTRACT_PATH);
    const workbenchSource = getSourceFileOrThrow(project, WORKBENCH_PATH);
    const storagePortSource = getSourceFileOrThrow(project, STORAGE_PORT_PATH);
    const resultSource = getSourceFileOrThrow(project, RESULT_PATH);
    const envelopeSource = getSourceFileOrThrow(project, RECORD_ENVELOPE_PATH);
    const recordIdSource = getSourceFileOrThrow(project, RECORD_ID_PATH);
    const registrySource = getSourceFileOrThrow(project, REGISTRY_PATH);
    const indexSource = getSourceFileOrThrow(project, INDEX_PATH);
    const inspectorSource = getSourceFileOrThrow(project, INSPECTOR_PATH);

    const missingRequiredFiles: string[] = [];
    for (const filePath of REQUIRED_ROOT_FILES) {
      if (!(await fileExists(pathFromRepoRoot(filePath)))) {
        missingRequiredFiles.push(filePath);
      }
    }

    const retiredLocalDataExists = await fileExists(pathFromRepoRoot(LEGACY_LOCAL_DATA_ROOT));
    const legacyVerifyRootExists = await fileExists(pathFromRepoRoot(LEGACY_VERIFY_ROOT));
    const runtimeRootExists = await fileExists(pathFromRepoRoot(RUNTIME_ROOT));
    const sharedStoreRootExists = await fileExists(pathFromRepoRoot(SHARED_STORE_ROOT));

    const registeredChildIds = getRegisteredChildIds(registrySource);
    const requiredChildSet = new Set(REQUIRED_CHILDREN);
    const missingChildIds = [...requiredChildSet].filter((childId) => !registeredChildIds.has(childId));
    const extraChildIds = [...registeredChildIds].filter((childId) => !requiredChildSet.has(childId as (typeof REQUIRED_CHILDREN)[number]));

    const contractInputProps = getTypeAliasPropertyNames(contractSource, "ForensicsAbilityInputBase");
    const envelopeProps = getTypeAliasPropertyNames(envelopeSource, "ForensicsRecordEnvelope");
    const resultProps = getTypeAliasPropertyNames(resultSource, "ForensicsPersistenceAbilityResult");
    const recordTypeValues = getRecordTypeValues(envelopeSource);

    const requiredShapePassed = missingRequiredFiles.length === 0
      && missingChildIds.length === 0
      && extraChildIds.length === 0
      && hasInterfaceMethod(contractSource, "ForensicsPersistenceAbilityGroup", "execute")
      && hasInterfaceMethod(contractSource, "ForensicsPersistenceAbilityGroup", "writeStructuredRuntimeEvent")
      && hasInterfaceMethod(contractSource, "ForensicsPersistenceAbilityGroup", "writeStructuredActionLog")
      && hasInterfaceMethod(contractSource, "ForensicsPersistenceAbilityGroup", "writeImageEvidence")
      && hasInterfaceMethod(contractSource, "ForensicsPersistenceAbilityGroup", "writeAiResultRecord")
      && hasInterfaceMethod(contractSource, "ForensicsPersistenceAbilityGroup", "finalizeBrowseLedger")
      && hasInterfaceMethod(contractSource, "ForensicsPersistenceAbilityGroup", "finalizeEvidencePacket")
      && hasInterfaceMethod(contractSource, "ForensicsPersistenceAbilityGroup", "finalizeFailedRecord")
      && hasInterfaceMethod(contractSource, "ForensicsPersistenceAbilityGroup", "updateRuntimeSnapshot")
      && hasInterfaceMethod(storagePortSource, "ForensicsStoragePort", "writeRecord")
      && hasInterfaceMethod(storagePortSource, "ForensicsStoragePort", "readRecord")
      && hasInterfaceMethod(storagePortSource, "ForensicsStoragePort", "listRecords")
      && hasInterfaceMethod(storagePortSource, "ForensicsStoragePort", "writeArtifactRef")
      && hasInterfaceMethod(storagePortSource, "ForensicsStoragePort", "updateRuntimeSnapshot")
      && contractInputProps.has("abilityGroupId")
      && contractInputProps.has("sourceAbilityGroupId")
      && contractInputProps.has("sourceRecordRefs")
      && contractInputProps.has("parentRefs")
      && contractInputProps.has("artifactRefs")
      && contractInputProps.has("payload")
      && contractInputProps.has("persistencePolicy")
      && envelopeProps.has("recordId")
      && envelopeProps.has("recordType")
      && envelopeProps.has("payload")
      && envelopeProps.has("sourceRecordRefs")
      && envelopeProps.has("parentRefs")
      && envelopeProps.has("artifactRefs")
      && envelopeProps.has("integrityHash")
      && resultProps.has("status")
      && resultProps.has("recordRef")
      && resultProps.has("storageRef")
      && resultProps.has("failureReason")
      && resultProps.has("debugLogRef")
      && resultProps.has("runtimeProof")
      && [...REQUIRED_RECORD_TYPES].every((recordType) => recordTypeValues.has(recordType));

    if (!requiredShapePassed) {
      findings.push(
        createFinding({
          lawId: LAW_OWNER,
          file: missingRequiredFiles[0] ?? CONTRACT_PATH,
          line: 1,
          severity: "fatal",
          message: "Forensics required root, contract, record envelope, result, storage-port, or child topology is incomplete.",
        }),
      );
    }

    const childLeakage = getExternalChildLeakage(entries);
    if (childLeakage.length > 0) {
      findings.push(
        createFinding({
          lawId: LAW_CHILDREN,
          file: childLeakage[0]!,
          line: 1,
          severity: "fatal",
          message: "Forensics child implementations leaked outside the owner root through direct import or re-export.",
        }),
      );
    }

    const indexChildExportViolations = getIndexChildExportViolations(indexSource);
    if (indexChildExportViolations.length > 0) {
      findings.push(
        createFinding({
          lawId: LAW_CHILDREN,
          file: INDEX_PATH,
          line: 1,
          severity: "fatal",
          message: "Forensics public index must not re-export child implementations.",
        }),
      );
    }

    const rootBoundaryImportViolations = getRootBoundaryImportViolations(rootEntries);
    const boundaryIdentifierViolations = getBoundaryForbiddenIdentifierViolations(rootEntries);
    const directEvidenceStoreWrites = getDirectEvidenceStoreWriteViolations(entries);
    const workbenchCutoverPassed = workbenchSource.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
      const expression = callExpression.getExpression();
      return Node.isIdentifier(expression) && expression.getText() === "createForensicsPersistenceAbilityGroup";
    }) && workbenchSource.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
      const expression = callExpression.getExpression();
      return Node.isIdentifier(expression) && expression.getText() === "createEvidenceStoreForensicsStoragePort";
    });

    const boundaryPassed = rootBoundaryImportViolations.length === 0
      && boundaryIdentifierViolations.length === 0
      && directEvidenceStoreWrites.length === 0
      && workbenchCutoverPassed;

    if (!boundaryPassed) {
      findings.push(
        createFinding({
          lawId: LAW_BOUNDARY,
          file: rootBoundaryImportViolations[0] ?? boundaryIdentifierViolations[0] ?? directEvidenceStoreWrites[0] ?? WORKBENCH_PATH,
          line: 1,
          severity: "fatal",
          message: "Forensics owner boundary is bypassed by forbidden imports, legacy direct writes, or missing public call-graph coverage.",
        }),
      );
    }

    if (retiredLocalDataExists) {
      findings.push(
        createFinding({
          lawId: LAW_RETIRED_ROOT,
          file: LEGACY_LOCAL_DATA_ROOT,
          line: 1,
          severity: "fatal",
          message: "Retired local-data root still exists and violates Forensics ownership cutover.",
        }),
      );
    }

    const contractImportViolations = getContractImportViolations(contractSource);
    const contractIdentifierViolations = getForbiddenTypeIdentifiers(contractSource);
    const indexIdentifierViolations = getForbiddenTypeIdentifiers(indexSource);
    if (contractImportViolations.length > 0 || contractIdentifierViolations.length > 0 || indexIdentifierViolations.length > 0) {
      findings.push(
        createFinding({
          lawId: LAW_CONTRACT,
          file: CONTRACT_PATH,
          line: 1,
          severity: "fatal",
          message: "Forensics public contract or index still leaks legacy business types or forbidden type imports.",
        }),
      );
    }

    const forbiddenRootSourcePaths = getForbiddenRootSourcePaths(rootEntries);
    if (runtimeRootExists || sharedStoreRootExists || forbiddenRootSourcePaths.length > 0) {
      findings.push(
        createFinding({
          lawId: LAW_STORAGE,
          file: runtimeRootExists ? RUNTIME_ROOT : sharedStoreRootExists ? SHARED_STORE_ROOT : forbiddenRootSourcePaths[0]!,
          line: 1,
          severity: "fatal",
          message: "Forensics storage seam still carries forbidden runtime/store topology or escaped compatibility residue.",
        }),
      );
    }

    const recordIdStringLiterals = new Set(recordIdSource.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralText()));
    const runtimeContractViolations = recordIdStringLiterals.has("eventId")
      || recordIdStringLiterals.has("actionLogId")
      || recordIdStringLiterals.has("packetId")
      || recordIdStringLiterals.has("logId")
      || recordIdStringLiterals.has("roundId")
      || resultSource.getDescendantsOfKind(SyntaxKind.StringLiteral).some((node) => node.getLiteralText() === "persisted")
      || resultSource.getDescendantsOfKind(SyntaxKind.StringLiteral).some((node) => node.getLiteralText() === "unknown");
    if (runtimeContractViolations) {
      findings.push(
        createFinding({
          lawId: LAW_RUNTIME,
          file: RECORD_ID_PATH,
          line: 1,
          severity: "error",
          message: "Forensics still guesses record ids or exposes stale persisted or unknown result vocabulary.",
        }),
      );
    }

    const rootAntiEscapeViolations = getRootAntiEscapeViolations(rootEntries);
    const inspectorAntiEscapeViolations = getInspectorAntiEscapeViolations(inspectorSource);
    if (legacyVerifyRootExists || rootAntiEscapeViolations.length > 0 || inspectorAntiEscapeViolations.length > 0) {
      findings.push(
        createFinding({
          lawId: LAW_ENFORCEMENT,
          file: legacyVerifyRootExists ? LEGACY_VERIFY_ROOT : rootAntiEscapeViolations[0] ?? inspectorAntiEscapeViolations[0] ?? INSPECTOR_PATH,
          line: 1,
          severity: "fatal",
          message: "Forensics enforcement still allows verify-root, capability-check, or anti-escape loopholes.",
        }),
      );
    }

    const requiredShapePhasePassed = findings.every((finding) => finding.lawId !== LAW_OWNER && finding.lawId !== LAW_CHILDREN);
    const forbiddenShapePhasePassed = findings.every((finding) => finding.lawId !== LAW_RETIRED_ROOT && finding.lawId !== LAW_CONTRACT && finding.lawId !== LAW_STORAGE && finding.lawId !== LAW_RUNTIME);
    const boundaryPhasePassed = findings.every((finding) => finding.lawId !== LAW_BOUNDARY);
    const antiEscapePhasePassed = findings.every((finding) => finding.lawId !== LAW_ENFORCEMENT);

    const structuredLogging = await inspectStructuredLoggingBoundary();
    const multiFrame = await inspectMultiFrameForensicsBoundary();
    const localPersistenceSchema = await inspectLocalPersistenceSchemaBoundary();

    return {
      findings: [...findings, ...structuredLogging.findings, ...multiFrame.findings, ...localPersistenceSchema.findings],
      phases: [
        createPhase(
          "required-shape",
          requiredShapePhasePassed ? "PASS" : "CODE VIOLATION",
          requiredShapePhasePassed,
          requiredShapePhasePassed
            ? "Forensics Persistence exposes the required owner root, registry, child topology, contract, and storage-port shape."
            : "Forensics Persistence is missing required owner root, registry, child topology, contract, or storage-port shape.",
        ),
        createPhase(
          "forbidden-shape",
          forbiddenShapePhasePassed ? "PASS" : "CODE VIOLATION",
          forbiddenShapePhasePassed,
          forbiddenShapePhasePassed
            ? "Retired local-data identity, forbidden contract leakage, and runtime/store topology are absent."
            : "Retired local-data identity, forbidden contract leakage, or runtime/store topology still survives.",
        ),
        createPhase(
          "boundary-attack",
          boundaryPhasePassed ? "PASS" : "CODE VIOLATION",
          boundaryPhasePassed,
          boundaryPhasePassed
            ? "Only the Forensics public owner and storage adapter seam perform final record writes."
            : "Other modules still bypass the Forensics owner or the public call graph is incomplete.",
        ),
        createPhase(
          "anti-escape",
          antiEscapePhasePassed ? "PASS" : "CODE VIOLATION",
          antiEscapePhasePassed,
          antiEscapePhasePassed
            ? "Forensics enforcement and source root are free of verify escape hatches and AST-level loopholes."
            : "Forensics enforcement or source root still contains verify escape hatches or anti-escape defects.",
        ),
        ...structuredLogging.phases,
        ...multiFrame.phases,
        ...localPersistenceSchema.phases,
      ],
    };
  },
});