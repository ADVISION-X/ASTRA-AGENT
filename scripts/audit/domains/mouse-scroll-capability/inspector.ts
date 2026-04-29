import path from "node:path";

import { Node, SyntaxKind, type ExportDeclaration, type ImportDeclaration, type SourceFile } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import type { Finding } from "../../core/schema.js";
import { createAuditProject } from "../_shared/ast-helpers.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";

const ROOT = "src/capabilities/mouse-scroll";
const ABILITY_GROUP_PATH = `${ROOT}/ability-group.ts`;
const CONTRACT_PATH = `${ROOT}/contract.ts`;
const SCHEMA_PATH = `${ROOT}/schema.ts`;
const REGISTRY_PATH = `${ROOT}/registry.ts`;
const INDEX_PATH = `${ROOT}/index.ts`;
const EXECUTOR_PATH = `${ROOT}/runtime/mouse-scroll-executor.ts`;
const INPUT_GATE_PATH = `${ROOT}/runtime/mouse-scroll-input-gate.ts`;
const GEOMETRY_GATE_PATH = `${ROOT}/runtime/geometry-scroll-proof-gate.ts`;
const POLICY_GATE_PATH = `${ROOT}/runtime/scroll-policy-gate.ts`;
const SAFETY_GATE_PATH = `${ROOT}/runtime/pre-scroll-safety-gate.ts`;
const DELTA_RESOLVER_PATH = `${ROOT}/runtime/scroll-delta-resolver.ts`;
const RUNNER_PATH = `${ROOT}/runtime/primitive-scroll-runner.ts`;
const RESULT_BUILDER_PATH = `${ROOT}/runtime/mouse-scroll-result-builder.ts`;
const PROOF_BUILDER_PATH = `${ROOT}/runtime/mouse-scroll-proof-builder.ts`;
const DISPATCH_FAILURE_PATH = `${ROOT}/runtime/mouse-scroll-dispatch-failure.ts`;
const IDEMPOTENCY_PATH = `${ROOT}/runtime/mouse-scroll-idempotency.ts`;
const CLOCK_PATH = `${ROOT}/runtime/mouse-scroll-clock.ts`;
const CLOCK_PORT_PATH = `${ROOT}/ports/mouse-scroll-clock-port.ts`;
const PRIMITIVE_PORT_PATH = `${ROOT}/ports/mouse-scroll-primitive-port.ts`;
const SHARED_TYPES_PATH = `${ROOT}/shared/mouse-scroll-types.ts`;
const SHARED_POLICY_PATH = `${ROOT}/shared/mouse-scroll-policy.ts`;
const SHARED_RESULT_PATH = `${ROOT}/shared/mouse-scroll-result.ts`;
const SHARED_PROOF_PATH = `${ROOT}/shared/mouse-scroll-proof.ts`;
const SHARED_FAILURE_PATH = `${ROOT}/shared/mouse-scroll-failure.ts`;
const CHILD_BROWSER_IMPL_PATH = `${ROOT}/children/scroll-browser-viewport/implementation.ts`;
const CHILD_BROWSER_CONTRACT_PATH = `${ROOT}/children/scroll-browser-viewport/contract.ts`;
const CHILD_BROWSER_SCHEMA_PATH = `${ROOT}/children/scroll-browser-viewport/schema.ts`;
const CHILD_DESKTOP_IMPL_PATH = `${ROOT}/children/scroll-desktop-screen/implementation.ts`;
const CHILD_DESKTOP_CONTRACT_PATH = `${ROOT}/children/scroll-desktop-screen/contract.ts`;
const CHILD_DESKTOP_SCHEMA_PATH = `${ROOT}/children/scroll-desktop-screen/schema.ts`;
const CHILD_REGION_IMPL_PATH = `${ROOT}/children/scroll-region/implementation.ts`;
const CHILD_REGION_CONTRACT_PATH = `${ROOT}/children/scroll-region/contract.ts`;
const CHILD_REGION_SCHEMA_PATH = `${ROOT}/children/scroll-region/schema.ts`;
const ACTIONS_PATH = "src/lib/local-runtime/tiktok-platform/actions.ts";
const BROWSER_ADAPTER_PATH = "src/lib/browser/mouse-scroll-primitive-port.ts";
const LEGACY_FORBIDDEN_FILES = [
  `${ROOT}/primitive-port.ts`,
  `${ROOT}/shared/coordinate.ts`,
  `${ROOT}/shared/runtime-proof.ts`,
  `${ROOT}/shared/scroll-failure.ts`,
  `${ROOT}/shared/scroll-magnitude.ts`,
  `${ROOT}/shared/scroll-policy.ts`,
  `${ROOT}/shared/scroll-result.ts`,
  `${ROOT}/shared/validate-input.ts`,
] as const;
const REQUIRED_FILES = [
  ABILITY_GROUP_PATH,
  CONTRACT_PATH,
  SCHEMA_PATH,
  REGISTRY_PATH,
  INDEX_PATH,
  EXECUTOR_PATH,
  INPUT_GATE_PATH,
  GEOMETRY_GATE_PATH,
  POLICY_GATE_PATH,
  SAFETY_GATE_PATH,
  DELTA_RESOLVER_PATH,
  RUNNER_PATH,
  RESULT_BUILDER_PATH,
  PROOF_BUILDER_PATH,
  DISPATCH_FAILURE_PATH,
  IDEMPOTENCY_PATH,
  CLOCK_PATH,
  CLOCK_PORT_PATH,
  PRIMITIVE_PORT_PATH,
  SHARED_TYPES_PATH,
  SHARED_POLICY_PATH,
  SHARED_RESULT_PATH,
  SHARED_PROOF_PATH,
  SHARED_FAILURE_PATH,
  CHILD_BROWSER_IMPL_PATH,
  CHILD_BROWSER_CONTRACT_PATH,
  CHILD_BROWSER_SCHEMA_PATH,
  CHILD_DESKTOP_IMPL_PATH,
  CHILD_DESKTOP_CONTRACT_PATH,
  CHILD_DESKTOP_SCHEMA_PATH,
  CHILD_REGION_IMPL_PATH,
  CHILD_REGION_CONTRACT_PATH,
  CHILD_REGION_SCHEMA_PATH,
] as const;
const FORBIDDEN_IMPORT_PREFIXES = [
  "src/capabilities/ai/",
  "src/capabilities/screenshot/",
  "src/capabilities/page-state/",
  "src/capabilities/geometry-guard/",
  "src/capabilities/forensics-persistence/",
  "src/capabilities/open/",
] as const;
const ANTI_ESCAPE_DIRECTIVES = ["@ts-ignore", "@ts-expect-error", "eslint-disable"] as const;

function getSourceFile(project: ReturnType<typeof createAuditProject>, repoRelativePath: string): SourceFile | null {
  return project.getSourceFile(pathFromRepoRoot(repoRelativePath)) ?? null;
}

function getDeclarationTargetPath(declaration: ImportDeclaration | ExportDeclaration): string | null {
  const targetSourceFile = declaration.getModuleSpecifierSourceFile();
  if (targetSourceFile) {
    return toRepoRelativePath(targetSourceFile.getFilePath());
  }
  const specifier = declaration.getModuleSpecifierValue();
  if (!specifier || !specifier.startsWith(".")) {
    return null;
  }
  return path.posix.normalize(path.posix.join(path.posix.dirname(toRepoRelativePath(declaration.getSourceFile().getFilePath())), specifier));
}

function getMouseScrollFiles(project: ReturnType<typeof createAuditProject>): SourceFile[] {
  return project.getSourceFiles().filter((sourceFile) => toRepoRelativePath(sourceFile.getFilePath()).startsWith(`${ROOT}/`));
}

function hasExportStar(sourceFile: SourceFile): boolean {
  return sourceFile.getExportDeclarations().some((declaration) => declaration.isNamespaceExport());
}

function hasForbiddenImportTarget(sourceFile: SourceFile): boolean {
  return sourceFile.getImportDeclarations().some((declaration) => {
    const targetPath = getDeclarationTargetPath(declaration);
    return targetPath !== null && FORBIDDEN_IMPORT_PREFIXES.some((prefix) => targetPath.startsWith(prefix));
  });
}

function hasDynamicImport(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => callExpression.getExpression().getKind() === SyntaxKind.ImportKeyword);
}

function hasRequireCall(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === "require";
  });
}

function hasAnyEscape(sourceFile: SourceFile): boolean {
  if (sourceFile.getDescendantsOfKind(SyntaxKind.AnyKeyword).length > 0) {
    return true;
  }
  return sourceFile.getDescendantsOfKind(SyntaxKind.AsExpression).some((expression) => {
    const typeNode = expression.getTypeNode();
    if (typeNode?.getKind() === SyntaxKind.AnyKeyword) {
      return true;
    }
    const inner = expression.getExpression();
    return Node.isAsExpression(inner) && inner.getTypeNode()?.getKind() === SyntaxKind.UnknownKeyword;
  });
}

function hasForbiddenDirectiveComment(sourceFile: SourceFile): boolean {
  const seen = new Set<string>();
  for (const descendant of sourceFile.getDescendants()) {
    for (const range of descendant.getLeadingCommentRanges()) {
      const key = `${range.getPos()}:${range.getEnd()}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      const text = range.getText();
      if (ANTI_ESCAPE_DIRECTIVES.some((directive) => text.includes(directive))) {
        return true;
      }
    }
  }
  return false;
}

function hasPrimitiveScrollOutsideRunner(project: ReturnType<typeof createAuditProject>): boolean {
  return getMouseScrollFiles(project).some((sourceFile) => {
    const repoPath = toRepoRelativePath(sourceFile.getFilePath());
    if (repoPath === RUNNER_PATH) {
      return false;
    }
    return sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((expression) => expression.getText().endsWith("primitivePort.scroll"));
  });
}

function hasNewDateOrDateParse(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendants().some((descendant) => {
    if (Node.isNewExpression(descendant)) {
      return descendant.getExpression().getText() === "Date";
    }
    return Node.isPropertyAccessExpression(descendant) && descendant.getText() === "Date.parse";
  });
}

function fileContainsIdentifierCall(sourceFile: SourceFile, identifierName: string): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === identifierName;
  });
}

function childImplementationUsesExecutor(sourceFile: SourceFile): boolean {
  return sourceFile.getImportDeclarations().some((declaration) => getDeclarationTargetPath(declaration) === EXECUTOR_PATH)
    && fileContainsIdentifierCall(sourceFile, "executeMouseScroll");
}

function childImplementationParsesOutput(sourceFile: SourceFile, schemaName: string): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isPropertyAccessExpression(expression)
      && expression.getExpression().getText() === schemaName
      && expression.getName() === "parse";
  });
}

function resultBuilderUsesProofBuilder(sourceFile: SourceFile): boolean {
  return sourceFile.getImportDeclarations().some((declaration) => getDeclarationTargetPath(declaration) === PROOF_BUILDER_PATH)
    && fileContainsIdentifierCall(sourceFile, "buildMouseScrollRuntimeProof");
}

function resultBuilderProtectsExecutableFields(sourceFile: SourceFile): boolean {
  let protectedDeltaCount = 0;
  let protectedAnchorCount = 0;

  for (const expression of sourceFile.getDescendantsOfKind(SyntaxKind.ConditionalExpression)) {
    if (expression.getCondition().getText() !== 'input.status === "success"') {
      continue;
    }
    if (expression.getWhenFalse().getText() !== "null") {
      continue;
    }

    const whenTrueText = expression.getWhenTrue().getText();
    if (whenTrueText === "input.executableDelta") {
      protectedDeltaCount += 1;
    }
    if (whenTrueText === "input.executableAnchor") {
      protectedAnchorCount += 1;
    }
  }

  return protectedDeltaCount >= 2 && protectedAnchorCount >= 2;
}

function deltaResolverRejectsZeroFallback(sourceFile: SourceFile): boolean {
  const hasZeroDeltaFinding = sourceFile.getDescendants().some((descendant) => {
    return (Node.isStringLiteral(descendant) || Node.isNoSubstitutionTemplateLiteral(descendant))
      && descendant.getLiteralText() === "zero_delta";
  });
  const hasExplicitZeroDeltaGuard = sourceFile.getFullText().includes("if (executableDelta.deltaX === 0 && executableDelta.deltaY === 0)");
  const hasNullishZeroFallback = sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((expression) => {
    const operator = expression.getOperatorToken().getText();
    return (operator === "??" || operator === "||") && expression.getRight().getText() === "0";
  });
  return hasZeroDeltaFinding && hasExplicitZeroDeltaGuard && !hasNullishZeroFallback;
}

function actionCallRequiresGeometryProof(sourceFile: SourceFile): boolean {
  const callExpression = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).find((candidate) => {
    const expression = candidate.getExpression();
    return Node.isPropertyAccessExpression(expression) && expression.getText().endsWith("mouseScrollAbilityGroup.execute");
  });
  const argument = callExpression?.getArguments()[0];
  if (!argument || !Node.isObjectLiteralExpression(argument)) {
    return false;
  }
  const propertyNames = new Set(
    argument.getProperties().flatMap((property) => {
      if (Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property)) {
        return [property.getName()];
      }
      return [];
    }),
  );
  return propertyNames.has("geometryScrollProof") && propertyNames.has("sourceCoordinateProofRef");
}

function getCrossDomainMouseScrollImports(project: ReturnType<typeof createAuditProject>): string[] {
  return project.getSourceFiles().flatMap((sourceFile) => {
    const repoPath = toRepoRelativePath(sourceFile.getFilePath());
    if (repoPath.startsWith(`${ROOT}/`)) {
      return [];
    }
    const importsMouseScroll = sourceFile.getImportDeclarations().some((declaration) => {
      const targetPath = getDeclarationTargetPath(declaration);
      return targetPath !== null && (targetPath === INDEX_PATH || targetPath === CONTRACT_PATH);
    });
    if (!importsMouseScroll) {
      return [];
    }
    if (repoPath.startsWith("src/lib/local-runtime/tiktok-platform/") || repoPath === "src/lib/local-runtime/workbench.ts") {
      return [];
    }
    return [repoPath];
  });
}

export default createPendingDomainInspector({
  inspector: "GrassEye Mouse Scroll Capability Owner Inspector",
  inspectorId: "mouse-scroll-capability-owner",
  capabilityDomain: "mouse-scroll-capability",
  inspectorEntry: "scripts/audit/domains/mouse-scroll-capability/inspector.ts",
  ownedPaths: [ROOT],
  pendingSummary: "mouse-scroll-capability law exists but production-grade scroll execution boundaries are not fully enforced yet",
  implementedSummary: "mouse-scroll-capability is implemented as a schema-gated, geometry-approved, idempotent scroll owner with AST-backed enforcement",
  extraChecks: async () => {
    const project = createAuditProject();
    const findings: Finding[] = [];

    const requiredFiles = await Promise.all(REQUIRED_FILES.map((filePath) => fileExists(pathFromRepoRoot(filePath))));
    const missingRequiredFile = REQUIRED_FILES.find((_, index) => !requiredFiles[index]);
    if (missingRequiredFile) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V1", file: missingRequiredFile, line: 1, severity: "fatal", message: "Mouse Scroll required schema/runtime/child topology is incomplete." }));
    }

    const legacyFiles = await Promise.all(LEGACY_FORBIDDEN_FILES.map((filePath) => fileExists(pathFromRepoRoot(filePath))));
    const lingeringLegacyFile = LEGACY_FORBIDDEN_FILES.find((_, index) => legacyFiles[index]);
    if (lingeringLegacyFile) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-003-V1", file: lingeringLegacyFile, line: 1, severity: "fatal", message: "Legacy mouse-scroll patch-era files still exist; delete-only or delete-then-rebuild cutover is incomplete." }));
    }

    const indexSource = getSourceFile(project, INDEX_PATH);
    if (!indexSource || hasExportStar(indexSource)) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V1", file: INDEX_PATH, line: 1, severity: "fatal", message: "Mouse Scroll public index must use explicit exports and must not use export *." }));
    }

    const mouseScrollFiles = getMouseScrollFiles(project);
    const forbiddenImportFile = mouseScrollFiles.find((sourceFile) => hasForbiddenImportTarget(sourceFile));
    if (forbiddenImportFile) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-002-V1", file: toRepoRelativePath(forbiddenImportFile.getFilePath()), line: 1, severity: "fatal", message: "Mouse Scroll imports a forbidden external ability domain and breaks ownership purity." }));
    }

    if (hasPrimitiveScrollOutsideRunner(project)) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V1", file: ROOT, line: 1, severity: "fatal", message: "primitivePort.scroll may only execute inside primitive-scroll-runner.ts." }));
    }

    const clockViolator = mouseScrollFiles.find((sourceFile) => {
      const repoPath = toRepoRelativePath(sourceFile.getFilePath());
      if (repoPath === CLOCK_PATH) {
        return false;
      }
      return hasNewDateOrDateParse(sourceFile);
    });
    if (clockViolator) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-004-V1", file: toRepoRelativePath(clockViolator.getFilePath()), line: 1, severity: "fatal", message: "Mouse Scroll runtime must use the clock port; new Date and Date.parse are forbidden inside the capability root." }));
    }

    const escapeFile = mouseScrollFiles.find((sourceFile) => hasAnyEscape(sourceFile) || hasForbiddenDirectiveComment(sourceFile) || hasDynamicImport(sourceFile) || hasRequireCall(sourceFile));
    if (escapeFile) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-002-V1", file: toRepoRelativePath(escapeFile.getFilePath()), line: 1, severity: "fatal", message: "Mouse Scroll contains anti-escape constructs such as any, unknown-as-any, directives, require, or dynamic import." }));
    }

    const executorSource = getSourceFile(project, EXECUTOR_PATH);
    if (!executorSource
      || !fileContainsIdentifierCall(executorSource, "validateGeometryScrollProof")
      || !fileContainsIdentifierCall(executorSource, "validateScrollPolicy")
      || !fileContainsIdentifierCall(executorSource, "validatePreScrollSafety")
      || !fileContainsIdentifierCall(executorSource, "resolveScrollDelta")
      || !fileContainsIdentifierCall(executorSource, "runPrimitiveScroll")) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V1", file: EXECUTOR_PATH, line: 1, severity: "fatal", message: "mouse-scroll-executor must orchestrate geometry proof gate, policy gate, safety gate, delta resolver, and primitive runner." }));
    }

    const resultBuilderSource = getSourceFile(project, RESULT_BUILDER_PATH);
    if (!resultBuilderSource || !resultBuilderUsesProofBuilder(resultBuilderSource) || !resultBuilderProtectsExecutableFields(resultBuilderSource)) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-004-V1", file: RESULT_BUILDER_PATH, line: 1, severity: "fatal", message: "Mouse Scroll result builder must call the proof builder and must null executable delta and anchor on failed or review_required results." }));
    }

    const deltaResolverSource = getSourceFile(project, DELTA_RESOLVER_PATH);
    if (!deltaResolverSource || !deltaResolverRejectsZeroFallback(deltaResolverSource)) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-003-V1", file: DELTA_RESOLVER_PATH, line: 1, severity: "fatal", message: "Mouse Scroll delta resolver must reject zero delta and must not fall back invalid customDelta to 0." }));
    }

    const browserChildSource = getSourceFile(project, CHILD_BROWSER_IMPL_PATH);
    const desktopChildSource = getSourceFile(project, CHILD_DESKTOP_IMPL_PATH);
    const regionChildSource = getSourceFile(project, CHILD_REGION_IMPL_PATH);
    if (!browserChildSource || !childImplementationUsesExecutor(browserChildSource) || !childImplementationParsesOutput(browserChildSource, "ScrollBrowserViewportResultSchema")) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-003-V1", file: CHILD_BROWSER_IMPL_PATH, line: 1, severity: "fatal", message: "scroll-browser-viewport child must be a thin execute wrapper around mouse-scroll-executor with output schema parse." }));
    }
    if (!desktopChildSource || !childImplementationUsesExecutor(desktopChildSource) || !childImplementationParsesOutput(desktopChildSource, "ScrollDesktopScreenResultSchema")) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-003-V1", file: CHILD_DESKTOP_IMPL_PATH, line: 1, severity: "fatal", message: "scroll-desktop-screen child must be a thin execute wrapper around mouse-scroll-executor with output schema parse." }));
    }
    if (!regionChildSource || !childImplementationUsesExecutor(regionChildSource) || !childImplementationParsesOutput(regionChildSource, "ScrollRegionResultSchema")) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-003-V1", file: CHILD_REGION_IMPL_PATH, line: 1, severity: "fatal", message: "scroll-region child must be a thin execute wrapper around mouse-scroll-executor with output schema parse." }));
    }

    const actionsSource = getSourceFile(project, ACTIONS_PATH);
    if (!actionsSource || !actionCallRequiresGeometryProof(actionsSource)) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V1", file: ACTIONS_PATH, line: 1, severity: "fatal", message: "Mouse Scroll call sites must bind geometryScrollProof and sourceCoordinateProofRef before execution." }));
    }

    const crossDomainImports = getCrossDomainMouseScrollImports(project);
    if (crossDomainImports.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V1", file: crossDomainImports[0]!, line: 1, severity: "fatal", message: "Mouse Scroll public surface is imported from a forbidden cross-domain caller." }));
    }

    const browserAdapterSource = getSourceFile(project, BROWSER_ADAPTER_PATH);
    if (!browserAdapterSource || !browserAdapterSource.getImportDeclarations().some((declaration) => getDeclarationTargetPath(declaration) === PRIMITIVE_PORT_PATH)) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V1", file: BROWSER_ADAPTER_PATH, line: 1, severity: "fatal", message: "Browser primitive adapter must import the governed mouse-scroll primitive port from ports/mouse-scroll-primitive-port.ts." }));
    }

    return {
      findings,
      phases: [
        createPhase("required-shape", findings.some((finding) => finding.message.includes("topology")) ? "LAW-SCRIPT DRIFT" : "PASS", findings.every((finding) => !finding.message.includes("topology")), "mouse-scroll required shape uses schema/runtime/child contracts"),
        createPhase("forbidden-shape", findings.some((finding) => finding.message.includes("primitivePort.scroll") || finding.message.includes("export *") || finding.message.includes("new Date") || finding.message.includes("anti-escape")) ? "CODE VIOLATION" : "PASS", findings.every((finding) => !finding.message.includes("primitivePort.scroll") && !finding.message.includes("export *") && !finding.message.includes("new Date") && !finding.message.includes("anti-escape")), "mouse-scroll forbidden legacy and escape shapes are blocked"),
        createPhase("boundary-shape", findings.some((finding) => finding.message.includes("forbidden external ability domain") || finding.message.includes("call sites") || finding.message.includes("cross-domain caller")) ? "CODE VIOLATION" : "PASS", findings.every((finding) => !finding.message.includes("forbidden external ability domain") && !finding.message.includes("call sites") && !finding.message.includes("cross-domain caller")), "mouse-scroll boundary is geometry-approved and caller-scoped"),
      ],
    };
  },
});