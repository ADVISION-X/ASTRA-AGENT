import { Node, SyntaxKind, type ExportDeclaration, type ImportDeclaration, type SourceFile } from "ts-morph";

import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { createAuditProject, getSourceFileOrThrow, getZodEnumValues } from "../_shared/ast-helpers.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";

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
const RUNTIME_ROOT = `${ROOT}/runtime`;
const PORTS_ROOT = `${ROOT}/ports`;
const SHARED_ROOT = `${ROOT}/shared`;
const SCHEMA_PATH = `${ROOT}/schema.ts`;
const CONTRACT_PATH = `${ROOT}/contract.ts`;
const ABILITY_GROUP_PATH = `${ROOT}/ability-group.ts`;
const REGISTRY_PATH = `${ROOT}/registry.ts`;
const INDEX_PATH = `${ROOT}/index.ts`;
const RECORD_ID_PATH = `${ROOT}/record-id.ts`;
const STORAGE_ADAPTER_PATH = "src/lib/storage/evidence-store/forensics-storage-adapter.ts";
const WORKBENCH_PATH = "src/lib/local-runtime/workbench.ts";
const INSPECTOR_PATH = "scripts/audit/domains/forensics-persistence-capability/inspector.ts";
const LEGACY_LOCAL_DATA_ROOT = "src/features/local-data";
const LEGACY_STORAGE_PORT_PATH = `${ROOT}/storage-ports.ts`;

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

const REQUIRED_RUNTIME_FILES = [
  "forensics-executor.ts",
  "forensics-write-gate.ts",
  "forensics-policy-gate.ts",
  "forensics-integrity-gate.ts",
  "forensics-envelope-builder.ts",
  "forensics-hash-builder.ts",
  "forensics-result-builder.ts",
  "forensics-proof-builder.ts",
  "forensics-dispatch-failure.ts",
  "forensics-idempotency.ts",
  "forensics-clock.ts",
] as const;

const REQUIRED_PORT_FILES = [
  "forensics-storage-port.ts",
  "forensics-artifact-storage-port.ts",
  "forensics-clock-port.ts",
] as const;

const REQUIRED_SHARED_FILES = [
  "forensics-record-ref.ts",
  "forensics-artifact-ref.ts",
  "forensics-failure.ts",
  "forensics-policy.ts",
  "forensics-result.ts",
  "forensics-proof.ts",
] as const;

const REQUIRED_SCHEMA_ENUM_VALUES = [
  "write-structured-runtime-event",
  "write-structured-action-log",
  "write-evidence-record",
  "write-ai-result-record",
  "finalize-browse-ledger",
  "finalize-evidence-packet",
  "finalize-failed-record",
  "update-runtime-snapshot",
] as const;

const FORBIDDEN_IMPORT_ROOTS = [
  "src/capabilities/ai/",
  "src/capabilities/open/",
  "src/capabilities/screenshot/",
  "src/capabilities/mouse-click/",
  "src/capabilities/mouse-scroll/",
  "src/capabilities/page-state/",
  "src/capabilities/geometry-guard/",
] as const;

const FORBIDDEN_PATH_SEGMENTS = new Set(["mock", "fake", "fixture", "demo"]);
const FORBIDDEN_STORAGE_METHODS = new Set(["appendRecord", "replaceRecordByRound", "replaceRecordBySession", "updateRuntimeSnapshot"]);
const COMMENT_DIRECTIVES = new Set(["@ts-ignore", "@ts-expect-error", "eslint-disable"]);

function getResolvedModulePath(declaration: ImportDeclaration | ExportDeclaration): string | null {
  const sourceFile = declaration.getModuleSpecifierSourceFile();
  return sourceFile ? toRepoRelativePath(sourceFile.getFilePath()) : null;
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
  for (const commentText of collectComments(sourceFile)) {
    for (const directive of COMMENT_DIRECTIVES) {
      if (commentText.indexOf(directive) >= 0) {
        return true;
      }
    }
  }
  return false;
}

function flattenPropertyAccess(node: Node | undefined): string[] {
  if (!node) {
    return [];
  }

  if (Node.isPropertyAccessExpression(node)) {
    return [...flattenPropertyAccess(node.getExpression()), node.getName()];
  }

  if (Node.isIdentifier(node)) {
    return [node.getText()];
  }

  if (Node.isElementAccessExpression(node)) {
    const argument = node.getArgumentExpression();
    if (argument && (Node.isStringLiteral(argument) || Node.isNoSubstitutionTemplateLiteral(argument))) {
      return [...flattenPropertyAccess(node.getExpression()), argument.getLiteralText()];
    }
  }

  return [];
}

function isPathUnderRoot(relativePath: string, root: string): boolean {
  return relativePath === root || relativePath.startsWith(`${root}/`);
}

function pathHasForbiddenSegment(relativePath: string): boolean {
  return relativePath
    .split("/")
    .filter((segment) => segment.length > 0)
    .some((segment) => FORBIDDEN_PATH_SEGMENTS.has(segment));
}

function hasDynamicImportOrRequire(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return expression.getKind() === SyntaxKind.ImportKeyword
      || (Node.isIdentifier(expression) && expression.getText() === "require");
  });
}

function hasExportStar(sourceFile: SourceFile): boolean {
  return sourceFile.getExportDeclarations().some((declaration) => declaration.isNamespaceExport());
}

function hasForbiddenCast(sourceFile: SourceFile): boolean {
  const asExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.AsExpression);
  for (const expression of asExpressions) {
    const typeNode = expression.getTypeNode();
    if (!typeNode) {
      continue;
    }
    if (typeNode.getKind() === SyntaxKind.AnyKeyword || typeNode.getText() === "unknown") {
      return true;
    }
  }

  const typeAssertions = sourceFile.getDescendantsOfKind(SyntaxKind.TypeAssertionExpression);
  for (const expression of typeAssertions) {
    const typeNode = expression.getTypeNode();
    if (!typeNode) {
      continue;
    }
    if (typeNode.getKind() === SyntaxKind.AnyKeyword || typeNode.getText() === "unknown") {
      return true;
    }
  }

  return false;
}

function hasRecordUnknownType(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.TypeReference).some((typeReference) => {
    if (typeReference.getTypeName().getText() !== "Record") {
      return false;
    }
    const typeArguments = typeReference.getTypeArguments();
    return typeArguments.length === 2
      && typeArguments[0]?.getText() === "string"
      && typeArguments[1]?.getText() === "unknown";
  });
}

function getFunctionLine(sourceFile: SourceFile, functionName: string): number {
  const declaration = sourceFile.getFunction(functionName)
    ?? sourceFile.getVariableDeclaration(functionName)?.getInitializerIfKind(SyntaxKind.ArrowFunction)
    ?? sourceFile.getVariableDeclaration(functionName)?.getInitializerIfKind(SyntaxKind.FunctionExpression);
  return declaration?.getStartLineNumber() ?? 1;
}

function getIdentifierReferencePaths(sourceFile: SourceFile, identifierName: string): Set<string> {
  const declaration = sourceFile.getFunction(identifierName)
    ?? sourceFile.getVariableDeclaration(identifierName)
    ?? sourceFile.getClass(identifierName);
  if (!declaration) {
    return new Set();
  }

  const references = declaration.findReferencesAsNodes();
  return new Set(
    references.map((node) => toRepoRelativePath(node.getSourceFile().getFilePath())),
  );
}

function symbolResolvesToPath(identifier: Node | undefined, expectedPath: string): boolean {
  if (!identifier || !Node.isIdentifier(identifier)) {
    return false;
  }

  const symbol = identifier.getSymbol();
  const resolved = symbol?.getAliasedSymbol() ?? symbol;
  if (!resolved) {
    return false;
  }

  return resolved.getDeclarations().some((declaration) => toRepoRelativePath(declaration.getSourceFile().getFilePath()) === expectedPath);
}

function sourceHasCallPath(sourceFile: SourceFile, pathParts: readonly string[]): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expressionPath = flattenPropertyAccess(callExpression.getExpression());
    return expressionPath.length === pathParts.length && expressionPath.every((part, index) => part === pathParts[index]);
  });
}

function sourceUsesForbiddenImports(sourceFile: SourceFile): boolean {
  return sourceFile.getImportDeclarations().some((declaration) => {
    const resolvedPath = getResolvedModulePath(declaration);
    return resolvedPath !== null && FORBIDDEN_IMPORT_ROOTS.some((root) => resolvedPath.startsWith(root));
  });
}

function childImplementationBypassesExecutor(sourceFile: SourceFile): boolean {
  const executeCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression)
      && expression.getText() === "executeForensicsChild"
      && symbolResolvesToPath(expression, `${RUNTIME_ROOT}/forensics-executor.ts`);
  });

  if (executeCalls.length !== 1) {
    return true;
  }

  return sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((expression) => {
    const path = flattenPropertyAccess(expression);
    return path.length === 3
      && path[0] === "context"
      && path[1] === "recordStorage"
      && FORBIDDEN_STORAGE_METHODS.has(path[2] ?? "");
  });
}

function sourceUsesAnyKeyword(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.AnyKeyword).length > 0;
}

function hasWriteGateSnapshotPath(sourceFile: SourceFile): boolean {
  const writeFunction = sourceFile.getFunction("writeForensicsEnvelope");
  if (!writeFunction) {
    return false;
  }

  return sourceHasCallPath(sourceFile, ["input", "recordStorage", "updateRuntimeSnapshot"]);
}

function hasExecutorOutputSchemaParse(sourceFile: SourceFile): boolean {
  return sourceHasCallPath(sourceFile, ["input", "child", "outputSchema", "parse"]);
}

function hasHashBuilderShape(sourceFile: SourceFile): boolean {
  const hashFunction = sourceFile.getFunction("buildCanonicalForensicsHash");
  const serializeFunction = sourceFile.getFunction("serializeCanonicalJson");
  if (!hashFunction || !serializeFunction) {
    return false;
  }

  const references = getIdentifierReferencePaths(sourceFile, "serializeCanonicalJson");
  return references.has(`${RUNTIME_ROOT}/forensics-hash-builder.ts`)
    && references.has(`${RUNTIME_ROOT}/forensics-idempotency.ts`)
    && sourceHasCallPath(sourceFile, ["createHash"]);
}

function indexLeaksInternals(sourceFile: SourceFile): boolean {
  if (hasExportStar(sourceFile)) {
    return true;
  }

  return sourceFile.getExportDeclarations().some((declaration) => {
    const target = getResolvedModulePath(declaration);
    if (!target) {
      return false;
    }

    return isPathUnderRoot(target, `${ROOT}/runtime`)
      || isPathUnderRoot(target, `${ROOT}/children`)
      || (isPathUnderRoot(target, `${ROOT}/shared`) && target !== `${ROOT}/schema.ts`);
  });
}

function abilityGroupTouchesStorage(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((expression) => {
    const path = flattenPropertyAccess(expression);
    if (path.length < 3) {
      return false;
    }

    return (path[0] === "context" || path[0] === "input")
      && (path[1] === "recordStorage" || path[1] === "artifactStorage");
  });
}

function abilityGroupHasThrow(sourceFile: SourceFile): boolean {
  const executeFunction = sourceFile.getVariableDeclaration("execute")?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  return executeFunction?.getDescendantsOfKind(SyntaxKind.ThrowStatement).length ? true : false;
}

export default createPendingDomainInspector({
  inspector: "forensics-persistence-owner",
  inspectorId: "forensics-persistence-owner",
  capabilityDomain: "forensics-persistence-capability",
  inspectorEntry: INSPECTOR_PATH,
  ownedPaths: [ROOT, STORAGE_ADAPTER_PATH],
  pendingSummary: "forensics-persistence capability is not implemented",
  extraChecks: async () => {
    const findings: Finding[] = [];
    const project = createAuditProject();

    const requiredFiles = [
      SCHEMA_PATH,
      CONTRACT_PATH,
      ABILITY_GROUP_PATH,
      REGISTRY_PATH,
      INDEX_PATH,
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

    const missingFiles: string[] = [];
    for (const relativePath of requiredFiles) {
      if (!(await fileExists(pathFromRepoRoot(relativePath)))) {
        missingFiles.push(relativePath);
      }
    }
    if (missingFiles.length > 0) {
      findings.push(createFinding({
        lawId: LAW_OWNER,
        file: missingFiles[0] ?? ROOT,
        line: 1,
        severity: "fatal",
        message: "Forensics Persistence is missing required capability root files.",
        detail: missingFiles.join(", "),
      }));
    }

    const schemaSource = getSourceFileOrThrow(project, SCHEMA_PATH);
    const abilityGroupSource = getSourceFileOrThrow(project, ABILITY_GROUP_PATH);
    const registrySource = getSourceFileOrThrow(project, REGISTRY_PATH);
    const indexSource = getSourceFileOrThrow(project, INDEX_PATH);
    const executorSource = getSourceFileOrThrow(project, `${RUNTIME_ROOT}/forensics-executor.ts`);
    const writeGateSource = getSourceFileOrThrow(project, `${RUNTIME_ROOT}/forensics-write-gate.ts`);
    const hashBuilderSource = getSourceFileOrThrow(project, `${RUNTIME_ROOT}/forensics-hash-builder.ts`);
    const resultBuilderSource = getSourceFileOrThrow(project, `${RUNTIME_ROOT}/forensics-result-builder.ts`);
    const proofBuilderSource = getSourceFileOrThrow(project, `${RUNTIME_ROOT}/forensics-proof-builder.ts`);
    const adapterSource = getSourceFileOrThrow(project, STORAGE_ADAPTER_PATH);
    const workbenchSource = getSourceFileOrThrow(project, WORKBENCH_PATH);
    const inspectorSource = getSourceFileOrThrow(project, INSPECTOR_PATH);

    const childIds = new Set(getZodEnumValues(schemaSource, "ForensicsChildCapabilityIdSchema"));
    const missingChildIds = REQUIRED_SCHEMA_ENUM_VALUES.filter((childId) => !childIds.has(childId));
    if (missingChildIds.length > 0) {
      findings.push(createFinding({
        lawId: LAW_CONTRACT,
        file: SCHEMA_PATH,
        line: 1,
        severity: "error",
        message: "Forensics child schema ids are incomplete.",
        detail: missingChildIds.join(", "),
      }));
    }

    if (hasRecordUnknownType(schemaSource)) {
      findings.push(createFinding({
        lawId: LAW_CONTRACT,
        file: SCHEMA_PATH,
        line: 1,
        severity: "fatal",
        message: "Forensics schema still exposes Record<string, unknown> as a production payload shape.",
      }));
    }

    if (abilityGroupTouchesStorage(abilityGroupSource) || abilityGroupHasThrow(abilityGroupSource)) {
      findings.push(createFinding({
        lawId: LAW_OWNER,
        file: ABILITY_GROUP_PATH,
        line: 1,
        severity: "error",
        message: "Forensics ability-group must stay thin and governed; it cannot write storage directly or throw through execute.",
      }));
    }

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
    if (missingRegisteredChildren.length > 0) {
      findings.push(createFinding({
        lawId: LAW_CHILDREN,
        file: REGISTRY_PATH,
        line: 1,
        severity: "fatal",
        message: "Forensics registry is missing required child capabilities.",
        detail: missingRegisteredChildren.join(", "),
      }));
    }

    for (const childId of REQUIRED_CHILDREN) {
      const implementationPath = `${CHILDREN_ROOT}/${childId}/implementation.ts`;
      const sourceFile = getSourceFileOrThrow(project, implementationPath);
      if (childImplementationBypassesExecutor(sourceFile)) {
        findings.push(createFinding({
          lawId: LAW_CHILDREN,
          file: implementationPath,
          line: 1,
          severity: "error",
          message: "Forensics child implementations must execute through the shared executor and cannot write storage directly.",
        }));
      }
    }

    if (
      !sourceHasCallPath(executorSource, ["evaluateForensicsPolicy"])
      || !sourceHasCallPath(executorSource, ["evaluateForensicsIntegrity"])
      || !sourceHasCallPath(executorSource, ["buildForensicsEnvelope"])
      || !sourceHasCallPath(executorSource, ["writeForensicsEnvelope"])
      || !sourceHasCallPath(executorSource, ["persistForensicsArtifacts"])
      || !sourceHasCallPath(resultBuilderSource, ["buildForensicsProof"])
      || !hasExecutorOutputSchemaParse(executorSource)
    ) {
      findings.push(createFinding({
        lawId: LAW_RUNTIME,
        file: `${RUNTIME_ROOT}/forensics-executor.ts`,
        line: getFunctionLine(executorSource, "executeForensicsChild"),
        severity: "fatal",
        message: "Forensics executor is missing one or more required runtime gates or output-schema enforcement.",
      }));
    }

    const policyReferences = getIdentifierReferencePaths(
      getSourceFileOrThrow(project, `${RUNTIME_ROOT}/forensics-policy-gate.ts`),
      "evaluateForensicsPolicy",
    );
    const integrityReferences = getIdentifierReferencePaths(
      getSourceFileOrThrow(project, `${RUNTIME_ROOT}/forensics-integrity-gate.ts`),
      "evaluateForensicsIntegrity",
    );
    const proofReferences = getIdentifierReferencePaths(proofBuilderSource, "buildForensicsProof");
    if (
      !policyReferences.has(`${RUNTIME_ROOT}/forensics-executor.ts`)
      || !integrityReferences.has(`${RUNTIME_ROOT}/forensics-executor.ts`)
      || !proofReferences.has(`${RUNTIME_ROOT}/forensics-result-builder.ts`)
    ) {
      findings.push(createFinding({
        lawId: LAW_RUNTIME,
        file: `${RUNTIME_ROOT}/forensics-result-builder.ts`,
        line: 1,
        severity: "error",
        message: "Forensics runtime references do not close across policy, integrity, and proof builders.",
      }));
    }

    if (!hasHashBuilderShape(hashBuilderSource)) {
      findings.push(createFinding({
        lawId: LAW_RUNTIME,
        file: `${RUNTIME_ROOT}/forensics-hash-builder.ts`,
        line: 1,
        severity: "error",
        message: "Forensics integrity hashing is missing canonical serialization or the dedicated hash builder seam.",
      }));
    }

    const forbiddenHashSites = project.getSourceFiles(pathFromRepoRoot(`${ROOT}/**/*.ts`)).filter((sourceFile) => {
      const relativePath = toRepoRelativePath(sourceFile.getFilePath());
      if (relativePath === `${RUNTIME_ROOT}/forensics-hash-builder.ts`) {
        return false;
      }

      return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
        const expression = callExpression.getExpression();
        return Node.isPropertyAccessExpression(expression)
          && expression.getName() === "stringify"
          && Node.isIdentifier(expression.getExpression())
          && expression.getExpression().getText() === "JSON";
      });
    });
    if (forbiddenHashSites.length > 0) {
      const firstForbiddenHashSite = forbiddenHashSites[0];
      findings.push(createFinding({
        lawId: LAW_RUNTIME,
        file: firstForbiddenHashSite ? toRepoRelativePath(firstForbiddenHashSite.getFilePath()) : `${RUNTIME_ROOT}/forensics-hash-builder.ts`,
        line: 1,
        severity: "error",
        message: "Forensics runtime cannot hash evidence through ad hoc JSON.stringify calls outside the canonical hash builder.",
      }));
    }

    if (!hasWriteGateSnapshotPath(writeGateSource) || !sourceHasCallPath(adapterSource, ["evidenceStore", "saveStructuredRuntimeEvent"])) {
      findings.push(createFinding({
        lawId: LAW_STORAGE,
        file: `${RUNTIME_ROOT}/forensics-write-gate.ts`,
        line: 1,
        severity: "error",
        message: "Runtime snapshot persistence is not isolated behind the dedicated snapshot write path.",
      }));
    }

    const workbenchHasSplitPorts = workbenchSource.getImportDeclarations().some((declaration) => {
      const target = getResolvedModulePath(declaration);
      return target === STORAGE_ADAPTER_PATH
        && declaration.getNamedImports().some((namedImport) => {
          const importName = namedImport.getName();
          return importName === "createEvidenceStoreForensicsRecordStoragePort"
            || importName === "createEvidenceStoreForensicsArtifactStoragePort";
        });
    });
    if (!workbenchHasSplitPorts) {
      findings.push(createFinding({
        lawId: LAW_STORAGE,
        file: WORKBENCH_PATH,
        line: 1,
        severity: "error",
        message: "Workbench must compose Forensics through the dedicated record and artifact storage ports.",
      }));
    }

    const forensicsSources = project.getSourceFiles(pathFromRepoRoot(`${ROOT}/**/*.ts`));
    const boundaryViolations = forensicsSources.filter((sourceFile) => sourceUsesForbiddenImports(sourceFile));
    if (boundaryViolations.length > 0) {
      const firstBoundaryViolation = boundaryViolations[0];
      findings.push(createFinding({
        lawId: LAW_BOUNDARY,
        file: firstBoundaryViolation ? toRepoRelativePath(firstBoundaryViolation.getFilePath()) : ROOT,
        line: 1,
        severity: "fatal",
        message: "Forensics Persistence cannot import AI, browser, screenshot, mouse, page-state, or geometry capability internals.",
      }));
    }

    const antiEscapeViolation = forensicsSources.find((sourceFile) => {
      const relativePath = toRepoRelativePath(sourceFile.getFilePath());
      return hasCommentDirective(sourceFile)
        || hasDynamicImportOrRequire(sourceFile)
        || hasForbiddenCast(sourceFile)
        || sourceUsesAnyKeyword(sourceFile)
        || pathHasForbiddenSegment(relativePath);
    });
    if (antiEscapeViolation || hasCommentDirective(inspectorSource) || hasDynamicImportOrRequire(inspectorSource) || hasForbiddenCast(inspectorSource)) {
      findings.push(createFinding({
        lawId: LAW_ENFORCEMENT,
        file: antiEscapeViolation ? toRepoRelativePath(antiEscapeViolation.getFilePath()) : INSPECTOR_PATH,
        line: 1,
        severity: "fatal",
        message: "Forensics capability or its inspector still exposes anti-escape loopholes.",
      }));
    }

    if (indexLeaksInternals(indexSource)) {
      findings.push(createFinding({
        lawId: LAW_RETIRED_ROOT,
        file: INDEX_PATH,
        line: 1,
        severity: "error",
        message: "Forensics public index cannot leak runtime internals, children, or export-star barrels.",
      }));
    }

    if (await fileExists(pathFromRepoRoot(LEGACY_LOCAL_DATA_ROOT)) || await fileExists(pathFromRepoRoot(LEGACY_STORAGE_PORT_PATH))) {
      findings.push(createFinding({
        lawId: LAW_RETIRED_ROOT,
        file: (await fileExists(pathFromRepoRoot(LEGACY_STORAGE_PORT_PATH))) ? LEGACY_STORAGE_PORT_PATH : LEGACY_LOCAL_DATA_ROOT,
        line: 1,
        severity: "fatal",
        message: "Retired local-data or legacy storage-port surfaces still overlap the Forensics owner boundary.",
      }));
    }

    const requiredShapePassed = findings.every((finding) => finding.lawId !== LAW_OWNER && finding.lawId !== LAW_CHILDREN && finding.lawId !== LAW_CONTRACT);
    const forbiddenShapePassed = findings.every((finding) => finding.lawId !== LAW_RETIRED_ROOT && finding.lawId !== LAW_STORAGE && finding.lawId !== LAW_RUNTIME);
    const boundaryPassed = findings.every((finding) => finding.lawId !== LAW_BOUNDARY);
    const antiEscapePassed = findings.every((finding) => finding.lawId !== LAW_ENFORCEMENT);

    return {
      findings,
      phases: [
        createPhase(
          "required-shape",
          requiredShapePassed ? "PASS" : "CODE VIOLATION",
          requiredShapePassed,
          requiredShapePassed
            ? "Forensics Persistence exposes the required root, runtime modules, schemas, ports, and child topology."
            : "Forensics Persistence is missing required root, runtime modules, schemas, ports, or child topology.",
        ),
        createPhase(
          "forbidden-shape",
          forbiddenShapePassed ? "PASS" : "CODE VIOLATION",
          forbiddenShapePassed,
          forbiddenShapePassed
            ? "Legacy roots, direct hash shortcuts, public barrel leaks, and wrong snapshot paths are absent."
            : "Legacy roots, direct hash shortcuts, public barrel leaks, or wrong snapshot paths still survive.",
        ),
        createPhase(
          "boundary-attack",
          boundaryPassed ? "PASS" : "CODE VIOLATION",
          boundaryPassed,
          boundaryPassed
            ? "Forensics stays inside its persistence boundary and upstream wiring goes through governed ports."
            : "Forensics still crosses capability boundaries or upstream wiring bypasses governed ports.",
        ),
        createPhase(
          "anti-escape",
          antiEscapePassed ? "PASS" : "FAKE ENFORCEMENT",
          antiEscapePassed,
          antiEscapePassed
            ? "Forensics source and inspector are free of comment escapes, casts, dynamic imports, and test-path laundering."
            : "Forensics source or inspector still exposes comment escapes, casts, dynamic imports, or test-path laundering.",
        ),
      ],
    };
  },
});
