import path from "node:path";
import { readdir } from "node:fs/promises";

import { Node, SyntaxKind, type ExportDeclaration, type ImportDeclaration, type SourceFile } from "ts-morph";

import { fileExists, listFilesRecursive } from "../../core/filesystem.js";
import { createFinding, createPhase } from "../../core/result.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import type { Finding } from "../../core/schema.js";
import {
  createAuditProject,
  flattenPropertyAccess,
  hasCallExpressionPath,
  hasInterfaceMethod,
} from "../_shared/ast-helpers.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";

const ROOT = "src/capabilities/mouse-click";
const ABILITY_GROUP_PATH = `${ROOT}/ability-group.ts`;
const CONTRACT_PATH = `${ROOT}/contract.ts`;
const INDEX_PATH = `${ROOT}/index.ts`;
const REGISTRY_PATH = `${ROOT}/registry.ts`;
const SCHEMA_PATH = `${ROOT}/schema.ts`;
const EXECUTOR_PATH = `${ROOT}/runtime/mouse-click-executor.ts`;
const RUNNER_PATH = `${ROOT}/runtime/primitive-click-runner.ts`;
const PROOF_BUILDER_PATH = `${ROOT}/runtime/mouse-click-proof-builder.ts`;
const RESULT_BUILDER_PATH = `${ROOT}/runtime/mouse-click-result-builder.ts`;
const FAILURE_PATH = `${ROOT}/runtime/mouse-click-dispatch-failure.ts`;
const INPUT_GATE_PATH = `${ROOT}/runtime/mouse-click-input-gate.ts`;
const GEOMETRY_GATE_PATH = `${ROOT}/runtime/geometry-proof-gate.ts`;
const POLICY_GATE_PATH = `${ROOT}/runtime/click-policy-gate.ts`;
const SAFETY_GATE_PATH = `${ROOT}/runtime/pre-click-safety-gate.ts`;
const IDEMPOTENCY_PATH = `${ROOT}/runtime/mouse-click-idempotency.ts`;
const CLOCK_PATH = `${ROOT}/runtime/mouse-click-clock.ts`;
const CLOCK_PORT_PATH = `${ROOT}/ports/mouse-click-clock-port.ts`;
const PRIMITIVE_PORT_PATH = `${ROOT}/ports/mouse-click-primitive-port.ts`;
const BROWSER_CHILD_DIR = `${ROOT}/children/click-browser-coordinate`;
const DESKTOP_CHILD_DIR = `${ROOT}/children/click-desktop-coordinate`;
const BROWSER_CHILD_IMPL = `${BROWSER_CHILD_DIR}/implementation.ts`;
const DESKTOP_CHILD_IMPL = `${DESKTOP_CHILD_DIR}/implementation.ts`;
const VISION_RUNTIME_PATH = "src/lib/local-runtime/tiktok-platform/vision-coordinate-runtime.ts";
const PRIMITIVE_IMPL_PATH = "src/lib/browser/mouse-click-primitive-port.ts";
const WORKBENCH_PATH = "src/lib/local-runtime/workbench.ts";

const REQUIRED_FILES = [
  ABILITY_GROUP_PATH,
  CONTRACT_PATH,
  INDEX_PATH,
  REGISTRY_PATH,
  SCHEMA_PATH,
  EXECUTOR_PATH,
  RUNNER_PATH,
  PROOF_BUILDER_PATH,
  RESULT_BUILDER_PATH,
  FAILURE_PATH,
  INPUT_GATE_PATH,
  GEOMETRY_GATE_PATH,
  POLICY_GATE_PATH,
  SAFETY_GATE_PATH,
  IDEMPOTENCY_PATH,
  CLOCK_PATH,
  CLOCK_PORT_PATH,
  PRIMITIVE_PORT_PATH,
  `${ROOT}/shared/mouse-click-types.ts`,
  `${ROOT}/shared/mouse-click-policy.ts`,
  `${ROOT}/shared/mouse-click-result.ts`,
  `${ROOT}/shared/mouse-click-proof.ts`,
  `${ROOT}/shared/mouse-click-failure.ts`,
  `${BROWSER_CHILD_DIR}/contract.ts`,
  `${BROWSER_CHILD_DIR}/schema.ts`,
  BROWSER_CHILD_IMPL,
  `${DESKTOP_CHILD_DIR}/contract.ts`,
  `${DESKTOP_CHILD_DIR}/schema.ts`,
  DESKTOP_CHILD_IMPL,
] as const;

const FORBIDDEN_DELETED_FILES = [
  `${ROOT}/primitive-port.ts`,
  `${ROOT}/shared/click-result.ts`,
  `${ROOT}/shared/runtime-proof.ts`,
  `${ROOT}/shared/validate-input.ts`,
  `${ROOT}/shared/coordinate.ts`,
  `${ROOT}/shared/click-policy.ts`,
  `${ROOT}/shared/click-failure.ts`,
] as const;

const FORBIDDEN_IMPORT_PREFIXES = [
  "src/capabilities/ai/",
  "src/capabilities/screenshot/",
  "src/capabilities/page-state/",
  "src/capabilities/geometry-guard/",
  "src/capabilities/forensics-persistence/",
  "src/capabilities/open/",
] as const;

const FORBIDDEN_TEXT_TOKENS = ["as any", "as unknown as", "@ts-ignore", "@ts-expect-error", "eslint-disable", "require("] as const;

function getSourceFile(project: ReturnType<typeof createAuditProject>, repoRelativePath: string): SourceFile | null {
  return project.getSourceFile(pathFromRepoRoot(repoRelativePath)) ?? null;
}

function hasText(sourceText: string, fragment: string): boolean {
  return sourceText.includes(fragment);
}

function hasFileText(sourceFile: SourceFile, fragment: string): boolean {
  return sourceFile.getFullText().includes(fragment);
}

function resolveRelativeRepoPath(fromRepoRelativePath: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) {
    return null;
  }

  return path.posix.normalize(path.posix.join(path.posix.dirname(fromRepoRelativePath), specifier.replaceAll("\\", "/")));
}

function getDeclarationTargetPath(declaration: ImportDeclaration | ExportDeclaration): string | null {
  const targetSourceFile = declaration.getModuleSpecifierSourceFile();
  if (targetSourceFile) {
    return toRepoRelativePath(targetSourceFile.getFilePath());
  }

  const specifier = declaration.getModuleSpecifierValue();
  if (!specifier) {
    return null;
  }

  return resolveRelativeRepoPath(toRepoRelativePath(declaration.getSourceFile().getFilePath()), specifier);
}

function getRegistryChildren(sourceFile: SourceFile): string[] {
  const childrenDecl = sourceFile.getVariableDeclaration("CHILDREN");
  const initializer = childrenDecl?.getInitializer();
  const arrayLiteral = initializer && Node.isAsExpression(initializer)
    ? initializer.getExpressionIfKind(SyntaxKind.ArrayLiteralExpression)
    : initializer?.asKind(SyntaxKind.ArrayLiteralExpression);
  if (!arrayLiteral) {
    return [];
  }

  return arrayLiteral.getElements().flatMap((element) => {
    if (!Node.isCallExpression(element)) {
      return [];
    }

    const expressionText = element.getExpression().getText();
    if (expressionText === "createClickBrowserCoordinateCapability") {
      return ["click-browser-coordinate"];
    }
    if (expressionText === "createClickDesktopCoordinateCapability") {
      return ["click-desktop-coordinate"];
    }
    return [];
  });
}

async function listDirectoryEntries(repoRelativePath: string): Promise<string[]> {
  const absolutePath = pathFromRepoRoot(repoRelativePath);
  if (!(await fileExists(absolutePath))) {
    return [];
  }

  return (await readdir(absolutePath, { withFileTypes: true })).map((entry) => entry.name).sort();
}

function sourceHasForbiddenImport(sourceFile: SourceFile): boolean {
  return sourceFile.getImportDeclarations().some((declaration) => {
    const targetPath = getDeclarationTargetPath(declaration);
    if (!targetPath) {
      return false;
    }

    return FORBIDDEN_IMPORT_PREFIXES.some((prefix) => targetPath.startsWith(prefix));
  });
}

function sourceHasPrimitiveClickCall(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expressionPath = flattenPropertyAccess(callExpression.getExpression()).join(".");
    return expressionPath === "context.primitivePort.click" || expressionPath === "input.context.primitivePort.click";
  });
}

function sourceHasDynamicImport(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => callExpression.getExpression().getKind() === SyntaxKind.ImportKeyword);
}

function sourceHasThrow(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.ThrowStatement).length > 0;
}

function getExternalImportsOfFile(project: ReturnType<typeof createAuditProject>, targetPath: string): string[] {
  return project.getSourceFiles().flatMap((sourceFile) => {
    const importerPath = toRepoRelativePath(sourceFile.getFilePath());
    return sourceFile.getImportDeclarations().flatMap((declaration) => {
      const importedPath = getDeclarationTargetPath(declaration);
      if (importedPath === targetPath && importerPath !== WORKBENCH_PATH) {
        return [importerPath];
      }
      return [];
    });
  });
}

function getExternalImportsWithPrefix(project: ReturnType<typeof createAuditProject>, targetPrefix: string): string[] {
  return project.getSourceFiles().flatMap((sourceFile) => {
    const importerPath = toRepoRelativePath(sourceFile.getFilePath());
    if (importerPath.startsWith(`${ROOT}/`)) {
      return [];
    }

    return sourceFile.getImportDeclarations().flatMap((declaration) => {
      const importedPath = getDeclarationTargetPath(declaration);
      return importedPath && importedPath.startsWith(targetPrefix) ? [importerPath] : [];
    });
  });
}

export default createPendingDomainInspector({
  inspector: "GrassEye Mouse Click Capability Owner Inspector",
  inspectorId: "mouse-click-capability-owner",
  capabilityDomain: "mouse-click-capability",
  inspectorEntry: "scripts/audit/domains/mouse-click-capability/inspector.ts",
  ownedPaths: [ROOT],
  pendingSummary: "mouse-click-capability law exists but production-grade click execution boundaries are not fully enforced yet",
  implementedSummary: "mouse-click-capability is implemented as a governed schema-first primitive execution owner with AST-backed enforcement",
  extraChecks: async () => {
    const project = createAuditProject();
    const findings: Finding[] = [];
    const mouseClickFiles = await listFilesRecursive(pathFromRepoRoot(ROOT), { extensions: [".ts"] });
    const sourceFiles = mouseClickFiles
      .map((filePath) => project.getSourceFile(filePath))
      .filter((sourceFile): sourceFile is SourceFile => Boolean(sourceFile));
    const schemaSource = getSourceFile(project, SCHEMA_PATH);
    const contractSource = getSourceFile(project, CONTRACT_PATH);
    const abilityGroupSource = getSourceFile(project, ABILITY_GROUP_PATH);
    const registrySource = getSourceFile(project, REGISTRY_PATH);
    const indexSource = getSourceFile(project, INDEX_PATH);
    const executorSource = getSourceFile(project, EXECUTOR_PATH);
    const runnerSource = getSourceFile(project, RUNNER_PATH);
    const browserChildSource = getSourceFile(project, BROWSER_CHILD_IMPL);
    const desktopChildSource = getSourceFile(project, DESKTOP_CHILD_IMPL);
    const visionRuntimeSource = getSourceFile(project, VISION_RUNTIME_PATH);

    for (const filePath of REQUIRED_FILES) {
      if (!(await fileExists(pathFromRepoRoot(filePath)))) {
        findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V1", file: filePath, line: 1, severity: "fatal", message: "Mouse Click required production file is missing." }));
      }
    }

    for (const filePath of FORBIDDEN_DELETED_FILES) {
      if (await fileExists(pathFromRepoRoot(filePath))) {
        findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V1", file: filePath, line: 1, severity: "fatal", message: "Deleted Mouse Click legacy file still exists in active source truth." }));
      }
    }

    if (!contractSource || !hasInterfaceMethod(contractSource, "MouseClickAbilityGroup", "execute")) {
      findings.push(createFinding({ lawId: "GRASSEYE-CAPABILITY-GROUP-002-V1", file: CONTRACT_PATH, line: 1, severity: "fatal", message: "Mouse Click must expose a stable public execute contract." }));
    }

    if (schemaSource) {
      const schemaText = schemaSource.getFullText();
      if (!hasText(schemaText, '"click-browser-coordinate"') || !hasText(schemaText, '"click-desktop-coordinate"')) {
        findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V1", file: SCHEMA_PATH, line: 1, severity: "fatal", message: "Mouse Click schema child ids must match canonical browser and desktop children." }));
      }
      if (!schemaSource.getVariableDeclaration("MouseClickAbilityInputSchema") || !schemaSource.getVariableDeclaration("MouseClickAbilityResultSchema")) {
        findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-003-V1", file: SCHEMA_PATH, line: 1, severity: "fatal", message: "Mouse Click must expose public input and result runtime schemas." }));
      }
      if (!hasFileText(schemaSource, "geometryGuardProof") || !hasFileText(schemaSource, "normalizedClickPoint") || !hasFileText(schemaSource, "postActionVerificationRequired")) {
        findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-003-V1", file: SCHEMA_PATH, line: 1, severity: "fatal", message: "Mouse Click schema must require geometry proof input and governed verification output fields." }));
      }
    }

    if (abilityGroupSource) {
      if (!hasFileText(abilityGroupSource, "parseMouseClickAbilityInput") && !hasFileText(abilityGroupSource, "MouseClickAbilityInputSchema.safeParse")) {
        findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-003-V1", file: ABILITY_GROUP_PATH, line: 1, severity: "fatal", message: "Mouse Click public entry must parse input schema before dispatch." }));
      }
      if (!hasFileText(abilityGroupSource, "MouseClickAbilityResultSchema.parse")) {
        findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-003-V1", file: ABILITY_GROUP_PATH, line: 1, severity: "fatal", message: "Mouse Click public entry must validate output schema before return." }));
      }
      if (sourceHasThrow(abilityGroupSource)) {
        findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V1", file: ABILITY_GROUP_PATH, line: 1, severity: "fatal", message: "Mouse Click public execute must not throw across the public boundary." }));
      }
    }

    if (registrySource && schemaSource) {
      const registryChildren = getRegistryChildren(registrySource);
      const schemaChildren = ["click-browser-coordinate", "click-desktop-coordinate"].filter((childId) => hasFileText(schemaSource, `"${childId}"`));
      if (registryChildren.join(",") !== schemaChildren.join(",")) {
        findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V1", file: REGISTRY_PATH, line: 1, severity: "fatal", message: "Mouse Click registry and schema child ids must stay in lockstep." }));
      }
    }

    if (indexSource) {
      if (indexSource.getExportDeclarations().some((declaration) => declaration.isNamespaceExport() || declaration.getText().startsWith("export *"))) {
        findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V1", file: INDEX_PATH, line: 1, severity: "fatal", message: "Mouse Click index must not use export * or barrel laundering." }));
      }
    }

    for (const childDir of [BROWSER_CHILD_DIR, DESKTOP_CHILD_DIR]) {
      const entries = await listDirectoryEntries(childDir);
      if (entries.join(",") !== ["contract.ts", "implementation.ts", "schema.ts"].join(",")) {
        findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V1", file: childDir, line: 1, severity: "fatal", message: "Each Mouse Click child must contain only contract.ts, schema.ts, and implementation.ts." }));
      }
    }

    if (!browserChildSource || !hasCallExpressionPath(browserChildSource, ["executeMouseClick"])) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V1", file: BROWSER_CHILD_IMPL, line: 1, severity: "fatal", message: "Browser child must delegate through executeMouseClick." }));
    }
    if (!desktopChildSource || !hasCallExpressionPath(desktopChildSource, ["executeMouseClick"])) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V1", file: DESKTOP_CHILD_IMPL, line: 1, severity: "fatal", message: "Desktop child must delegate through executeMouseClick." }));
    }

    if (!runnerSource || !sourceHasPrimitiveClickCall(runnerSource)) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V1", file: RUNNER_PATH, line: 1, severity: "fatal", message: "primitivePort.click must exist inside primitive-click-runner." }));
    }

    const primitiveLeak = sourceFiles
      .filter((sourceFile) => toRepoRelativePath(sourceFile.getFilePath()) !== RUNNER_PATH)
      .find((sourceFile) => sourceHasPrimitiveClickCall(sourceFile));
    if (primitiveLeak) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V1", file: toRepoRelativePath(primitiveLeak.getFilePath()), line: 1, severity: "fatal", message: "primitivePort.click must not appear outside primitive-click-runner." }));
    }

    if (executorSource) {
      const executorText = executorSource.getFullText();
      if (!hasText(executorText, "validateGeometryProof") || !hasText(executorText, "validateClickPolicy") || !hasText(executorText, "validatePreClickSafety") || !hasText(executorText, "runPrimitiveClick") || !hasText(executorText, "buildMouseClickResult")) {
        findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V1", file: EXECUTOR_PATH, line: 1, severity: "fatal", message: "Mouse Click executor must compose geometry gate, policy gate, safety gate, primitive runner, and result builder." }));
      }
    }

    for (const sourceFile of sourceFiles) {
      const relativePath = toRepoRelativePath(sourceFile.getFilePath());
      if (sourceHasForbiddenImport(sourceFile)) {
        findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V1", file: relativePath, line: 1, severity: "fatal", message: "Mouse Click must not import AI, Screenshot, Page State, Geometry Guard, Forensics, or Open internals." }));
      }
      if (sourceHasDynamicImport(sourceFile)) {
        findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V1", file: relativePath, line: 1, severity: "fatal", message: "Mouse Click must not use dynamic import escape paths." }));
      }
      if (relativePath !== CLOCK_PATH && (hasFileText(sourceFile, "new Date(") || hasFileText(sourceFile, "Date.parse("))) {
        findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V1", file: relativePath, line: 1, severity: "fatal", message: "Mouse Click must source time from the clock port and must not use new Date or Date.parse directly." }));
      }
      for (const token of FORBIDDEN_TEXT_TOKENS) {
        if (hasFileText(sourceFile, token)) {
          findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V1", file: relativePath, line: 1, severity: "fatal", message: `Mouse Click contains forbidden escape token: ${token}.` }));
        }
      }
    }

    if (!visionRuntimeSource || !hasFileText(visionRuntimeSource, "geometryGuardProof") || !hasFileText(visionRuntimeSource, "sourceCoordinateProofRef")) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-003-V1", file: VISION_RUNTIME_PATH, line: 1, severity: "fatal", message: "Visual click handoff must pass geometryGuardProof and sourceCoordinateProofRef into Mouse Click." }));
    }

    const primitiveImplementationImports = getExternalImportsOfFile(project, PRIMITIVE_IMPL_PATH);
    if (primitiveImplementationImports.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-001-V1", file: primitiveImplementationImports[0]!, line: 1, severity: "fatal", message: "The primitive adapter implementation must not be imported outside the workbench composition root." }));
    }

    const childImplementationImports = getExternalImportsWithPrefix(project, `${ROOT}/children/`);
    if (childImplementationImports.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-CAPABILITY-GROUP-002-V1", file: childImplementationImports[0]!, line: 1, severity: "fatal", message: "Mouse Click child implementations must stay private to the owning ability group." }));
    }

    const requiredShapePass = findings.every((finding) => !finding.message.includes("required production file") && !finding.message.includes("legacy file still exists") && !finding.message.includes("registry and schema child ids") && !finding.message.includes("child must contain only") && !finding.message.includes("compose geometry gate"));
    const forbiddenPass = findings.every((finding) => !finding.message.includes("must not") && !finding.message.includes("must not throw") && !finding.message.includes("must source time"));
    const boundaryPass = findings.every((finding) => !finding.message.includes("handoff") && !finding.message.includes("import outside") && !finding.message.includes("private to the owning ability group") && !finding.message.includes("Open internals"));
    const antiEscapePass = findings.every((finding) => !finding.message.includes("escape token") && !finding.message.includes("dynamic import escape paths") && !finding.message.includes("barrel laundering"));

    return {
      findings,
      phases: [
        createPhase("required-shape", requiredShapePass ? "PASS" : "CODE VIOLATION", requiredShapePass, requiredShapePass ? "Mouse Click production topology exists with schema, runtime executor chain, ports, and child triplets." : "Mouse Click required production topology is incomplete or drifted."),
        createPhase("forbidden-shape", forbiddenPass ? "PASS" : "CODE VIOLATION", forbiddenPass, forbiddenPass ? "Mouse Click avoids naked throws, direct primitive leaks, legacy files, and direct wall-clock usage." : "Mouse Click still contains forbidden execution shapes or legacy remnants."),
        createPhase("boundary-attack", boundaryPass ? "PASS" : "CODE VIOLATION", boundaryPass, boundaryPass ? "Mouse Click stays behind the workbench boundary and receives Geometry Guard proof handoff from visual runtime." : "Mouse Click boundary still leaks through forbidden imports or invalid handoff paths."),
        createPhase("anti-escape", antiEscapePass ? "PASS" : "CODE VIOLATION", antiEscapePass, antiEscapePass ? "Mouse Click avoids dynamic import, export laundering, and type/comment escape hatches." : "Mouse Click still contains escape hatches that can bypass enforcement."),
      ],
    };
  },
});