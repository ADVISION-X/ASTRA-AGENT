import path from "node:path";

import { Node, SyntaxKind, type CallExpression, type FunctionDeclaration, type SourceFile } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import { fileExists, listFilesRecursive } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import type { Finding } from "../../core/schema.js";
import {
  createAuditProject,
  getSourceFileOrThrow,
  getTypeAliasPropertyNames,
  hasCallExpressionPath,
  hasIdentifier,
  hasInterfaceMethod,
} from "../_shared/ast-helpers.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";

const ROOT = "src/capabilities/mouse-scroll";
const CONTRACT_PATH = `${ROOT}/contract.ts`;
const ABILITY_GROUP_PATH = `${ROOT}/ability-group.ts`;
const REGISTRY_PATH = `${ROOT}/registry.ts`;
const INDEX_PATH = `${ROOT}/index.ts`;
const PRIMITIVE_PORT_PATH = `${ROOT}/primitive-port.ts`;
const SHARED_POLICY_PATH = `${ROOT}/shared/scroll-policy.ts`;
const SHARED_RESULT_PATH = `${ROOT}/shared/scroll-result.ts`;
const SHARED_FAILURE_PATH = `${ROOT}/shared/scroll-failure.ts`;
const SHARED_MAGNITUDE_PATH = `${ROOT}/shared/scroll-magnitude.ts`;
const SHARED_RUNTIME_PROOF_PATH = `${ROOT}/shared/runtime-proof.ts`;
const SHARED_COORDINATE_PATH = `${ROOT}/shared/coordinate.ts`;
const SHARED_VALIDATE_INPUT_PATH = `${ROOT}/shared/validate-input.ts`;
const CHILD_BROWSER_VIEWPORT_PATH = `${ROOT}/children/scroll-browser-viewport/implementation.ts`;
const CHILD_DESKTOP_SCREEN_PATH = `${ROOT}/children/scroll-desktop-screen/implementation.ts`;
const CHILD_REGION_PATH = `${ROOT}/children/scroll-region/implementation.ts`;
const BROWSER_CONTROLLER_PATH = "src/lib/browser/browser-controller.ts";
const BROWSER_SCROLL_PORT_ADAPTER_PATH = "src/lib/browser/mouse-scroll-primitive-port.ts";
const WORKBENCH_PATH = "src/lib/local-runtime/workbench.ts";

const REQUIRED_CHILDREN = ["scroll-browser-viewport", "scroll-desktop-screen", "scroll-region"] as const;
const RETIRED_CHILDREN = [
  "vertical-wheel-scroll",
  "horizontal-wheel-scroll",
  "browser-viewport-scroll",
  "desktop-screen-scroll",
  "region-wheel-scroll",
  "scroll-one-page",
  "scroll-two-pages",
  "scroll-next-video",
] as const;
const REQUIRED_FILES = [
  CONTRACT_PATH,
  ABILITY_GROUP_PATH,
  REGISTRY_PATH,
  INDEX_PATH,
  PRIMITIVE_PORT_PATH,
  SHARED_POLICY_PATH,
  SHARED_RESULT_PATH,
  SHARED_FAILURE_PATH,
  SHARED_MAGNITUDE_PATH,
  SHARED_RUNTIME_PROOF_PATH,
  SHARED_COORDINATE_PATH,
  SHARED_VALIDATE_INPUT_PATH,
  CHILD_BROWSER_VIEWPORT_PATH,
  CHILD_DESKTOP_SCREEN_PATH,
  CHILD_REGION_PATH,
] as const;
const REQUIRED_INPUT_FIELDS = [
  "abilityGroupId",
  "childCapabilityId",
  "sessionId",
  "roundId",
  "videoVisitId",
  "requestedBy",
  "purpose",
  "geometryGuardRef",
  "guardDecision",
  "sourceEvidenceRef",
  "sourceTargetRef",
  "coordinateSpace",
  "anchorPoint",
  "region",
  "regionRef",
  "bounds",
  "direction",
  "magnitude",
  "customDelta",
  "repeat",
  "safetyPolicy",
] as const;
const REQUIRED_RESULT_FIELDS = [
  "status",
  "abilityGroupId",
  "childCapabilityId",
  "sessionId",
  "roundId",
  "videoVisitId",
  "scrollExecutionRef",
  "primitiveExecutionRefs",
  "geometryGuardRef",
  "direction",
  "magnitude",
  "deltaX",
  "deltaY",
  "repeat",
  "coordinateSpace",
  "anchorPoint",
  "regionRef",
  "startedAt",
  "endedAt",
  "durationMs",
  "failureReason",
  "statusMessage",
  "debugLogRef",
  "runtimeProof",
] as const;
const REQUIRED_RUNTIME_PROOF_FIELDS = [
  "abilityGroupId",
  "childCapabilityId",
  "sessionId",
  "roundId",
  "videoVisitId",
  "requestedBy",
  "purpose",
  "geometryGuardRef",
  "direction",
  "magnitude",
  "deltaX",
  "deltaY",
  "coordinateSpace",
  "anchorPoint",
  "regionRef",
  "scrollExecutionRef",
  "primitiveExecutionRefs",
  "startedAt",
  "endedAt",
  "durationMs",
  "status",
  "failureReason",
] as const;
const REQUIRED_DIRECTIONS = ["up", "down", "left", "right"] as const;
const REQUIRED_MAGNITUDES = ["small", "halfPage", "onePage", "twoPages", "customDelta"] as const;
const REQUIRED_COORDINATE_SPACES = ["browserViewport", "desktopScreen"] as const;
const FORBIDDEN_IMPORT_PATH_PREFIXES = [
  "src/capabilities/geometry-guard/children/",
  "src/capabilities/screenshot/",
  "src/capabilities/visual-target/",
  "src/capabilities/ai/",
  "src/capabilities/post-action-verification/",
  "src/capabilities/forensics-persistence/",
] as const;
const FORBIDDEN_MOUSE_SCROLL_EXECUTOR_PREFIXES = [
  "src/capabilities/ai/",
  "src/capabilities/screenshot/",
  "src/capabilities/visual-target/",
  "src/capabilities/geometry-guard/",
  "src/lib/local-ai/",
  "src/features/",
] as const;
const MOUSE_SCROLL_PUBLIC_SURFACE_PATHS = new Set([CONTRACT_PATH, PRIMITIVE_PORT_PATH, INDEX_PATH]);

function getConstStringArrayValues(sourceFile: SourceFile, declarationName: string): string[] {
  const declaration = sourceFile.getVariableDeclaration(declarationName);
  const initializerNode = declaration?.getInitializer();
  const initializer = initializerNode && Node.isAsExpression(initializerNode)
    ? initializerNode.getExpressionIfKind(SyntaxKind.ArrayLiteralExpression)
    : initializerNode?.asKind(SyntaxKind.ArrayLiteralExpression);
  if (!initializer) {
    return [];
  }

  return initializer.getElements().flatMap((element) => {
    if (Node.isStringLiteral(element) || Node.isNoSubstitutionTemplateLiteral(element)) {
      return [element.getLiteralText()];
    }
    return [];
  });
}

function getUnionStringLiteralValues(sourceFile: SourceFile, declarationName: string): string[] {
  const declaration = sourceFile.getTypeAlias(declarationName);
  const typeNode = declaration?.getTypeNode();
  if (!typeNode || !Node.isUnionTypeNode(typeNode)) {
    return [];
  }

  return typeNode.getTypeNodes().flatMap((member) => {
    if (Node.isLiteralTypeNode(member)) {
      const literal = member.getLiteral();
      if (Node.isStringLiteral(literal) || Node.isNoSubstitutionTemplateLiteral(literal)) {
        return [literal.getLiteralText()];
      }
    }

    return [];
  });
}

function setsMatch(values: readonly string[], expected: readonly string[]): boolean {
  if (values.length !== expected.length) {
    return false;
  }

  const actualSet = new Set(values);
  return expected.every((entry) => actualSet.has(entry));
}

function getRegistryChildIds(sourceFile: SourceFile): string[] {
  const fn = sourceFile.getFunction("createMouseScrollCapabilityRegistry");
  const returnStatement = fn?.getBody()?.getDescendantsOfKind(SyntaxKind.ReturnStatement)[0];
  const expression = returnStatement?.getExpression();
  if (!expression || !Node.isNewExpression(expression)) {
    return [];
  }

  const [entriesArg] = expression.getArguments();
  if (!entriesArg || !Node.isArrayLiteralExpression(entriesArg)) {
    return [];
  }

  return entriesArg.getElements().flatMap((entry) => {
    if (!Node.isArrayLiteralExpression(entry)) {
      return [];
    }

    const [key] = entry.getElements();
    if (key && (Node.isStringLiteral(key) || Node.isNoSubstitutionTemplateLiteral(key))) {
      return [key.getLiteralText()];
    }

    return [];
  });
}

function getResolvedModulePath(sourceFile: SourceFile, importPath: string): string | null {
  for (const declaration of sourceFile.getImportDeclarations()) {
    const target = declaration.getModuleSpecifierSourceFile();
    if (!target) {
      continue;
    }

    const relativePath = toRepoRelativePath(target.getFilePath());
    if (relativePath === importPath) {
      return relativePath;
    }
  }

  return null;
}

function getResolvedImportTargets(sourceFile: SourceFile): string[] {
  return sourceFile.getImportDeclarations().flatMap((declaration) => {
    const target = declaration.getModuleSpecifierSourceFile();
    return target ? [toRepoRelativePath(target.getFilePath())] : [];
  });
}

function getResolvedExportTargets(sourceFile: SourceFile): string[] {
  return sourceFile.getExportDeclarations().flatMap((declaration) => {
    const target = declaration.getModuleSpecifierSourceFile();
    return target ? [toRepoRelativePath(target.getFilePath())] : [];
  });
}

function hasRequireCall(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === "require";
  });
}

function hasDynamicImport(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => callExpression.getExpression().getKind() === SyntaxKind.ImportKeyword);
}

function hasAnyEscape(sourceFile: SourceFile): boolean {
  if (sourceFile.getDescendantsOfKind(SyntaxKind.AnyKeyword).length > 0) {
    return true;
  }

  return sourceFile.getDescendantsOfKind(SyntaxKind.AsExpression).some((expression) => {
    const typeNode = expression.getTypeNode();
    if (!typeNode) {
      return false;
    }

    if (typeNode.getKind() === SyntaxKind.AnyKeyword) {
      return true;
    }

    const inner = expression.getExpression();
    return Node.isAsExpression(inner) && inner.getTypeNode()?.getKind() === SyntaxKind.UnknownKeyword;
  });
}

function hasForbiddenDirectiveComment(sourceFile: SourceFile): boolean {
  const seen = new Set<string>();
  const directives = ["@ts-ignore", "@ts-expect-error", "eslint-disable"];

  for (const descendant of sourceFile.getDescendants()) {
    for (const range of descendant.getLeadingCommentRanges()) {
      const key = `${range.getPos()}:${range.getEnd()}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      const text = range.getText();
      if (directives.some((directive) => text.includes(directive))) {
        return true;
      }
    }
  }

  return false;
}

function getMouseScrollRootSourceFiles(project: ReturnType<typeof createAuditProject>): SourceFile[] {
  return project.getSourceFiles().filter((sourceFile) => {
    const relativePath = toRepoRelativePath(sourceFile.getFilePath());
    return relativePath.startsWith(`${ROOT}/`);
  });
}

function isForbiddenImportTarget(importPath: string): boolean {
  if (importPath === BROWSER_CONTROLLER_PATH) {
    return true;
  }

  return FORBIDDEN_IMPORT_PATH_PREFIXES.some((prefix) => importPath.startsWith(prefix));
}

function getCallExpressionByIdentifier(sourceFile: SourceFile, identifierName: string): CallExpression | null {
  for (const callExpression of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expression = callExpression.getExpression();
    if (Node.isIdentifier(expression) && expression.getText() === identifierName) {
      return callExpression;
    }
  }

  return null;
}

function getFirstFunctionOrThrow(sourceFile: SourceFile, functionName: string): FunctionDeclaration {
  const fn = sourceFile.getFunction(functionName);
  if (!fn) {
    throw new Error(`Missing function ${functionName} in ${toRepoRelativePath(sourceFile.getFilePath())}`);
  }

  return fn;
}

function hasForbiddenCapabilityExecution(sourceFile: SourceFile): boolean {
  const forbiddenTypeNames = new Set([
    "ScreenshotAbilityGroup",
    "VisualTargetAbilityGroup",
    "AiAbilityGroup",
    "MouseClickAbilityGroup",
    "PostActionVerificationAbilityGroup",
    "ForensicsPersistenceAbilityGroup",
  ]);

  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    if (!Node.isPropertyAccessExpression(expression) || expression.getName() !== "execute") {
      return false;
    }

    const type = expression.getExpression().getType();
    const symbols = [type.getSymbol(), type.getAliasSymbol()].filter((value): value is NonNullable<typeof value> => value !== undefined);
    return symbols.some((symbol) => forbiddenTypeNames.has(symbol.getName()));
  });
}

function isForbiddenMouseScrollCaller(filePath: string): boolean {
  return FORBIDDEN_MOUSE_SCROLL_EXECUTOR_PREFIXES.some((prefix) => filePath.startsWith(prefix));
}

export default createPendingDomainInspector({
  inspector: "GrassEye Mouse Scroll Capability Owner Inspector",
  inspectorId: "mouse-scroll-capability-owner",
  capabilityDomain: "mouse-scroll-capability",
  inspectorEntry: "scripts/audit/domains/mouse-scroll-capability/inspector.ts",
  ownedPaths: [ROOT],
  pendingSummary: "mouse-scroll-capability law exists but independent scroll ownership is not fully cut over yet",
  implementedSummary: "mouse-scroll-capability is implemented as the canonical governed scroll owner with AST-backed enforcement",
  extraChecks: async () => {
    const project = createAuditProject();
    const contractSource = getSourceFileOrThrow(project, CONTRACT_PATH);
    const abilityGroupSource = getSourceFileOrThrow(project, ABILITY_GROUP_PATH);
    const registrySource = getSourceFileOrThrow(project, REGISTRY_PATH);
    const indexSource = getSourceFileOrThrow(project, INDEX_PATH);
    const primitivePortSource = getSourceFileOrThrow(project, PRIMITIVE_PORT_PATH);
    const runtimeProofSource = getSourceFileOrThrow(project, SHARED_RUNTIME_PROOF_PATH);
    const resultSource = getSourceFileOrThrow(project, SHARED_RESULT_PATH);
    const magnitudeSource = getSourceFileOrThrow(project, SHARED_MAGNITUDE_PATH);
    const coordinateSource = getSourceFileOrThrow(project, SHARED_COORDINATE_PATH);
    const validateInputSource = getSourceFileOrThrow(project, SHARED_VALIDATE_INPUT_PATH);
    const browserScrollPortAdapterSource = getSourceFileOrThrow(project, BROWSER_SCROLL_PORT_ADAPTER_PATH);
    const workbenchSource = getSourceFileOrThrow(project, WORKBENCH_PATH);
    const childBrowserViewportSource = getSourceFileOrThrow(project, CHILD_BROWSER_VIEWPORT_PATH);
    const childDesktopScreenSource = getSourceFileOrThrow(project, CHILD_DESKTOP_SCREEN_PATH);
    const childRegionSource = getSourceFileOrThrow(project, CHILD_REGION_PATH);
    const mouseScrollSourceFiles = getMouseScrollRootSourceFiles(project);
    const findings: Finding[] = [];

    const requiredPresence = await Promise.all(
      REQUIRED_FILES.map(async (filePath) => ({
        filePath,
        exists: await fileExists(pathFromRepoRoot(filePath)),
      })),
    );
    for (const item of requiredPresence) {
      if (!item.exists) {
        findings.push(createFinding({
          lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V1",
          file: item.filePath,
          line: 1,
          severity: "fatal",
          message: "Mouse Scroll required canonical file is missing.",
        }));
      }
    }

    const contractInputFields = getTypeAliasPropertyNames(contractSource, "MouseScrollAbilityInput");
    const contractResultFields = getTypeAliasPropertyNames(contractSource, "MouseScrollAbilityResult");
    const runtimeProofFields = getTypeAliasPropertyNames(runtimeProofSource, "MouseScrollRuntimeProof");
    const directions = getConstStringArrayValues(magnitudeSource, "MOUSE_SCROLL_DIRECTIONS");
    const magnitudes = getConstStringArrayValues(magnitudeSource, "MOUSE_SCROLL_MAGNITUDES");
    const coordinateSpaces = getConstStringArrayValues(coordinateSource, "MOUSE_SCROLL_COORDINATE_SPACES");
    const registryChildIds = getRegistryChildIds(registrySource);
    const inputShapeOk = REQUIRED_INPUT_FIELDS.every((field) => contractInputFields.has(field));
    const resultShapeOk = REQUIRED_RESULT_FIELDS.every((field) => contractResultFields.has(field));
    const runtimeProofShapeOk = REQUIRED_RUNTIME_PROOF_FIELDS.every((field) => runtimeProofFields.has(field));
    const runtimeProofStatuses = getUnionStringLiteralValues(runtimeProofSource, "MouseScrollRuntimeProofStatus");
    const statusShapeOk = setsMatch(runtimeProofStatuses, ["success", "failed", "review_required"]);
    const contractPortsOk = hasInterfaceMethod(contractSource, "MouseScrollAbilityGroup", "execute")
      && hasInterfaceMethod(primitivePortSource, "MouseScrollPrimitivePort", "scroll")
      && getResolvedModulePath(contractSource, PRIMITIVE_PORT_PATH) === PRIMITIVE_PORT_PATH
      && getResolvedModulePath(contractSource, SHARED_RUNTIME_PROOF_PATH) === SHARED_RUNTIME_PROOF_PATH;
    const enumShapesOk = setsMatch(directions, REQUIRED_DIRECTIONS)
      && setsMatch(magnitudes, REQUIRED_MAGNITUDES)
      && setsMatch(coordinateSpaces, REQUIRED_COORDINATE_SPACES);
    const registryShapeOk = setsMatch(registryChildIds, REQUIRED_CHILDREN);
    if (!inputShapeOk || !resultShapeOk || !runtimeProofShapeOk || !statusShapeOk || !contractPortsOk || !enumShapesOk || !registryShapeOk) {
      findings.push(createFinding({
        lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-004-V1",
        file: CONTRACT_PATH,
        line: 1,
        severity: "error",
        message: "Mouse Scroll contract, runtime proof, enums, and registry child topology must stay governed and complete.",
      }));
    }

    const forbiddenContractLeak = hasIdentifier(contractSource, "BrowserController")
      || hasIdentifier(contractSource, "BrowserActionResult")
      || hasIdentifier(contractSource, "fallbackUsed")
      || hasIdentifier(contractSource, "browserAction")
      || hasIdentifier(contractSource, "actionLogRef");
    if (forbiddenContractLeak) {
      findings.push(createFinding({
        lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V1",
        file: CONTRACT_PATH,
        line: 1,
        severity: "fatal",
        message: "Mouse Scroll public contract must not leak BrowserController, BrowserActionResult, actionLogRef, browserAction, or fallbackUsed.",
      }));
    }

    const retiredChildFiles = await Promise.all(
      RETIRED_CHILDREN.map(async (childId) => ({
        childId,
        exists: await fileExists(pathFromRepoRoot(`${ROOT}/children/${childId}/implementation.ts`)),
      })),
    );
    const retiredChildLeak = retiredChildFiles.find((item) => item.exists);
    if (retiredChildLeak) {
      findings.push(createFinding({
        lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-003-V1",
        file: `${ROOT}/children/${retiredChildLeak.childId}/implementation.ts`,
        line: 1,
        severity: "fatal",
        message: "Retired Mouse Scroll child implementation still exists.",
      }));
    }

    const capabilityCheckLeak = (await listFilesRecursive(pathFromRepoRoot(ROOT), { extensions: [".ts"] }))
      .map((filePath) => toRepoRelativePath(filePath))
      .find((filePath) => path.basename(filePath) === "capability-check.ts");
    if (capabilityCheckLeak) {
      findings.push(createFinding({
        lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-002-V1",
        file: capabilityCheckLeak,
        line: 1,
        severity: "fatal",
        message: "capability-check.ts must not survive under the Mouse Scroll root.",
      }));
    }

    const verifyLeak = mouseScrollSourceFiles.find((sourceFile) => {
      const functions = sourceFile.getFunctions().map((fn) => fn.getName()).filter((name): name is string => Boolean(name));
      const variables = sourceFile.getVariableDeclarations().map((declaration) => declaration.getName());
      return [...functions, ...variables].some((name) => name.startsWith("verify"));
    });
    if (verifyLeak) {
      findings.push(createFinding({
        lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-002-V1",
        file: toRepoRelativePath(verifyLeak.getFilePath()),
        line: 1,
        severity: "fatal",
        message: "verify* helpers must not survive under the Mouse Scroll root.",
      }));
    }

    const forbiddenImportLeak = mouseScrollSourceFiles.find((sourceFile) => {
      const relativePath = toRepoRelativePath(sourceFile.getFilePath());
      if (relativePath === PRIMITIVE_PORT_PATH) {
        return false;
      }

      return getResolvedImportTargets(sourceFile).some((importPath) => isForbiddenImportTarget(importPath));
    });
    if (forbiddenImportLeak) {
      findings.push(createFinding({
        lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-002-V1",
        file: toRepoRelativePath(forbiddenImportLeak.getFilePath()),
        line: 1,
        severity: "fatal",
        message: "Mouse Scroll root must not import BrowserController or forbidden sibling capability owners.",
      }));
    }

    const antiEscapeLeak = mouseScrollSourceFiles.find((sourceFile) => {
      if (toRepoRelativePath(sourceFile.getFilePath()) === BROWSER_SCROLL_PORT_ADAPTER_PATH) {
        return false;
      }

      return hasDynamicImport(sourceFile)
        || hasRequireCall(sourceFile)
        || hasAnyEscape(sourceFile)
        || hasForbiddenDirectiveComment(sourceFile);
    });
    if (antiEscapeLeak) {
      findings.push(createFinding({
        lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-002-V1",
        file: toRepoRelativePath(antiEscapeLeak.getFilePath()),
        line: 1,
        severity: "fatal",
        message: "Mouse Scroll root must not rely on dynamic import, require(), any, comment-directive, or unknown-cast escape hatches.",
      }));
    }

    const forbiddenRuntimeLeak = mouseScrollSourceFiles.find((sourceFile) => {
      const relativePath = toRepoRelativePath(sourceFile.getFilePath());
      if (relativePath === BROWSER_SCROLL_PORT_ADAPTER_PATH) {
        return false;
      }

      return hasIdentifier(sourceFile, "imageEvidence")
        || hasIdentifier(sourceFile, "fallbackUsed")
        || hasIdentifier(sourceFile, "browserAction")
        || hasIdentifier(sourceFile, "actionLogRef")
        || hasForbiddenCapabilityExecution(sourceFile);
    });
    if (forbiddenRuntimeLeak) {
      findings.push(createFinding({
        lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-002-V1",
        file: toRepoRelativePath(forbiddenRuntimeLeak.getFilePath()),
        line: 1,
        severity: "fatal",
        message: "Mouse Scroll root still contains forbidden runtime leakage or cross-capability execution.",
      }));
    }

    const childExportLeak = indexSource.getExportDeclarations().find((declaration) => {
      const target = declaration.getModuleSpecifierSourceFile();
      if (!target) {
        return false;
      }

      return toRepoRelativePath(target.getFilePath()).startsWith(`${ROOT}/children/`);
    });
    if (childExportLeak) {
      findings.push(createFinding({
        lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-002-V1",
        file: INDEX_PATH,
        line: childExportLeak.getStartLineNumber(),
        severity: "fatal",
        message: "Mouse Scroll index must not barrel export child implementations.",
      }));
    }

    const externalChildImportLeak = project.getSourceFiles().find((sourceFile) => {
      const relativePath = toRepoRelativePath(sourceFile.getFilePath());
      if (relativePath.startsWith(`${ROOT}/`)) {
        return false;
      }

      return sourceFile.getImportDeclarations().some((declaration) => {
        const target = declaration.getModuleSpecifierSourceFile();
        return target !== undefined && toRepoRelativePath(target.getFilePath()).startsWith(`${ROOT}/children/`);
      });
    });
    if (externalChildImportLeak) {
      findings.push(createFinding({
        lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V1",
        file: toRepoRelativePath(externalChildImportLeak.getFilePath()),
        line: 1,
        severity: "fatal",
        message: "External modules must not import Mouse Scroll child implementations directly.",
      }));
    }

    const externalChildExportLeak = project.getSourceFiles().find((sourceFile) => {
      const relativePath = toRepoRelativePath(sourceFile.getFilePath());
      if (relativePath.startsWith(`${ROOT}/`)) {
        return false;
      }

      return getResolvedExportTargets(sourceFile).some((exportPath) => exportPath.startsWith(`${ROOT}/children/`));
    });
    if (externalChildExportLeak) {
      findings.push(createFinding({
        lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-002-V1",
        file: toRepoRelativePath(externalChildExportLeak.getFilePath()),
        line: 1,
        severity: "fatal",
        message: "External modules must not re-export Mouse Scroll child implementations.",
      }));
    }

    const mouseScrollPublicSurfaceLeak = project.getSourceFiles().find((sourceFile) => {
      const relativePath = toRepoRelativePath(sourceFile.getFilePath());
      if (relativePath.startsWith(`${ROOT}/`) || relativePath === BROWSER_SCROLL_PORT_ADAPTER_PATH || relativePath === WORKBENCH_PATH) {
        return false;
      }

      return sourceFile.getImportDeclarations().some((declaration) => {
        const target = declaration.getModuleSpecifierSourceFile();
        if (!target) {
          return false;
        }

        const importPath = toRepoRelativePath(target.getFilePath());
        return importPath === PRIMITIVE_PORT_PATH;
      });
    });
    if (mouseScrollPublicSurfaceLeak) {
      findings.push(createFinding({
        lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V1",
        file: toRepoRelativePath(mouseScrollPublicSurfaceLeak.getFilePath()),
        line: 1,
        severity: "fatal",
        message: "Browser scroll primitive ownership must stay behind the dedicated primitive port adapter and composition root.",
      }));
    }

    const createMouseScrollAbilityGroupCall = getCallExpressionByIdentifier(workbenchSource, "createMouseScrollAbilityGroup");
    const workbenchCompositionOk = (() => {
      if (!createMouseScrollAbilityGroupCall) {
        return false;
      }

      const [firstArgument] = createMouseScrollAbilityGroupCall.getArguments();
      if (!firstArgument || !Node.isObjectLiteralExpression(firstArgument)) {
        return false;
      }

      const primitivePortProperty = firstArgument.getProperty("primitivePort");
      if (!primitivePortProperty || !Node.isPropertyAssignment(primitivePortProperty)) {
        return false;
      }

      const initializer = primitivePortProperty.getInitializer();
      if (!initializer || !Node.isCallExpression(initializer)) {
        return false;
      }

      const expression = initializer.getExpression();
      if (!Node.isIdentifier(expression) || expression.getText() !== "createBrowserControllerMouseScrollPrimitivePort") {
        return false;
      }

      const [adapterArg] = initializer.getArguments();
      if (!adapterArg || !Node.isObjectLiteralExpression(adapterArg)) {
        return false;
      }

      const browserControllerProperty = adapterArg.getProperty("browserController");
      if (!browserControllerProperty || !Node.isPropertyAssignment(browserControllerProperty)) {
        return false;
      }

      return browserControllerProperty.getInitializer()?.getText() === "this.browserController";
    })();
    if (!workbenchCompositionOk) {
      findings.push(createFinding({
        lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V1",
        file: WORKBENCH_PATH,
        line: createMouseScrollAbilityGroupCall?.getStartLineNumber() ?? 1,
        severity: "error",
        message: "Composition root must inject Mouse Scroll through createBrowserControllerMouseScrollPrimitivePort.",
      }));
    }

    const browserControllerScrollCalls = project.getSourceFiles().flatMap((sourceFile) => {
      const relativePath = toRepoRelativePath(sourceFile.getFilePath());
      return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).flatMap((callExpression) => {
        const expression = callExpression.getExpression();
        if (!Node.isPropertyAccessExpression(expression) || expression.getName() !== "scroll") {
          return [];
        }

        const type = expression.getExpression().getType();
        const symbols = [type.getSymbol(), type.getAliasSymbol()].filter((value): value is NonNullable<typeof value> => value !== undefined);
        if (!symbols.some((symbol) => symbol.getName() === "BrowserController")) {
          return [];
        }

        return [{ file: relativePath, line: callExpression.getStartLineNumber() }];
      });
    });
    const browserControllerScrollLeak = browserControllerScrollCalls.find((entry) => entry.file !== BROWSER_SCROLL_PORT_ADAPTER_PATH);
    if (browserControllerScrollLeak) {
      findings.push(createFinding({
        lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V1",
        file: browserControllerScrollLeak.file,
        line: browserControllerScrollLeak.line,
        severity: "fatal",
        message: "Direct BrowserController.scroll usage must stay sealed behind the Mouse Scroll primitive port adapter.",
      }));
    }

    const adapterScrollCallOk = browserControllerScrollCalls.some((entry) => entry.file === BROWSER_SCROLL_PORT_ADAPTER_PATH)
      && getResolvedModulePath(browserScrollPortAdapterSource, BROWSER_CONTROLLER_PATH) === BROWSER_CONTROLLER_PATH
      && getResolvedModulePath(browserScrollPortAdapterSource, PRIMITIVE_PORT_PATH) === PRIMITIVE_PORT_PATH;
    if (!adapterScrollCallOk) {
      findings.push(createFinding({
        lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V1",
        file: BROWSER_SCROLL_PORT_ADAPTER_PATH,
        line: 1,
        severity: "error",
        message: "Mouse Scroll primitive port adapter must be the only BrowserController-backed scroll bridge.",
      }));
    }

    const mouseScrollExecuteCalls = project.getSourceFiles().flatMap((sourceFile) => {
      const relativePath = toRepoRelativePath(sourceFile.getFilePath());
      return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).flatMap((callExpression) => {
        const expression = callExpression.getExpression();
        if (!Node.isPropertyAccessExpression(expression) || expression.getName() !== "execute") {
          return [];
        }

        const type = expression.getExpression().getType();
        const symbols = [type.getSymbol(), type.getAliasSymbol()].filter((value): value is NonNullable<typeof value> => value !== undefined);
        if (!symbols.some((symbol) => symbol.getName() === "MouseScrollAbilityGroup")) {
          return [];
        }

        return [{ file: relativePath, line: callExpression.getStartLineNumber() }];
      });
    });
    const forbiddenExecuteCaller = mouseScrollExecuteCalls.find((entry) => isForbiddenMouseScrollCaller(entry.file));
    if (forbiddenExecuteCaller) {
      findings.push(createFinding({
        lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V1",
        file: forbiddenExecuteCaller.file,
        line: forbiddenExecuteCaller.line,
        severity: "fatal",
        message: "AI, screenshot, geometry, or other forbidden owners must not execute Mouse Scroll.",
      }));
    }

    const childImplementationSources = [
      childBrowserViewportSource,
      childDesktopScreenSource,
      childRegionSource,
    ];
    for (const childSource of childImplementationSources) {
      const childPath = toRepoRelativePath(childSource.getFilePath());
      const executeMethod = childSource.getDescendantsOfKind(SyntaxKind.MethodDeclaration).find((method) => method.getName() === "execute");
      const validateCall = hasCallExpressionPath(childSource, ["validateMouseScrollAbilityInput"]);
      const deltaCall = hasCallExpressionPath(childSource, ["resolveMouseScrollDelta"]);
      const primitiveCall = hasCallExpressionPath(childSource, ["context", "primitivePort", "scroll"]);
      const successCall = hasCallExpressionPath(childSource, ["buildMouseScrollSuccess"]);
      const failureCall = hasCallExpressionPath(childSource, ["buildMouseScrollFailure"]);
      const reviewCall = hasCallExpressionPath(childSource, ["buildMouseScrollReviewRequired"]);
      if (!executeMethod || !validateCall || !deltaCall || !primitiveCall || !successCall || !failureCall || !reviewCall) {
        findings.push(createFinding({
          lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-004-V1",
          file: childPath,
          line: executeMethod?.getStartLineNumber() ?? 1,
          severity: "error",
          message: "Each Mouse Scroll child must validate input, resolve delta, call primitivePort.scroll, and emit governed success/failure proof.",
        }));
      }
    }

    const validateInputOk = (() => {
      const fn = getFirstFunctionOrThrow(validateInputSource, "validateMouseScrollAbilityInput");
      return hasIdentifier(fn, "geometryGuardRef")
        && hasIdentifier(fn, "guardDecision")
        && hasIdentifier(fn, "coordinateSpace")
        && hasIdentifier(fn, "repeat")
        && hasIdentifier(fn, "regionRef");
    })();
    const validateCustomDeltaOk = Boolean(getFirstFunctionOrThrow(validateInputSource, "validateCustomDelta"))
      && hasIdentifier(validateInputSource, "customDelta");
    if (!validateInputOk || !validateCustomDeltaOk) {
      findings.push(createFinding({
        lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V1",
        file: SHARED_VALIDATE_INPUT_PATH,
        line: 1,
        severity: "error",
        message: "Mouse Scroll input validation must enforce geometry approval, coordinate-space boundary, repeat bounds, and region/source refs.",
      }));
    }

    const resultBuilderOk = hasCallExpressionPath(resultSource, ["buildMouseScrollRuntimeProof"])
      && hasIdentifier(resultSource, "scrollExecutionRef")
      && hasIdentifier(resultSource, "primitiveExecutionRefs")
      && hasIdentifier(resultSource, "geometryGuardRef")
      && hasIdentifier(resultSource, "debugLogRef")
      && !hasIdentifier(resultSource, "browserActionId")
      && !hasIdentifier(resultSource, "actionLogRef")
      && !hasIdentifier(resultSource, "fallbackUsed");
    if (!resultBuilderOk) {
      findings.push(createFinding({
        lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-004-V1",
        file: SHARED_RESULT_PATH,
        line: 1,
        severity: "error",
        message: "Mouse Scroll result builder must emit runtimeProof and must not forge action-log identity from browserActionId or fallback fields.",
      }));
    }

    const requiredShapePassed = requiredPresence.every((item) => item.exists)
      && inputShapeOk
      && resultShapeOk
      && runtimeProofShapeOk
      && statusShapeOk
      && contractPortsOk
      && enumShapesOk
      && registryShapeOk
      && workbenchCompositionOk
      && adapterScrollCallOk
      && validateInputOk
      && validateCustomDeltaOk
      && resultBuilderOk;
    const forbiddenShapePassed = !forbiddenContractLeak
      && retiredChildLeak === undefined
      && capabilityCheckLeak === undefined
      && verifyLeak === undefined
      && forbiddenImportLeak === undefined
      && antiEscapeLeak === undefined
      && forbiddenRuntimeLeak === undefined
      && childExportLeak === undefined
      && externalChildImportLeak === undefined
      && externalChildExportLeak === undefined
      && mouseScrollPublicSurfaceLeak === undefined
      && forbiddenExecuteCaller === undefined
      && browserControllerScrollLeak === undefined;
    const boundaryPassed = workbenchCompositionOk
      && adapterScrollCallOk
      && externalChildImportLeak === undefined
      && mouseScrollPublicSurfaceLeak === undefined
      && forbiddenExecuteCaller === undefined;
    const antiEscapePassed = antiEscapeLeak === undefined
      && childExportLeak === undefined
      && externalChildExportLeak === undefined;

    return {
      findings,
      phases: [
        createPhase(
          "mouse-scroll-required-shape",
          requiredShapePassed ? "PASS" : "CODE VIOLATION",
          requiredShapePassed,
          requiredShapePassed
            ? "Mouse Scroll canonical root exposes governed input, result, runtime proof, registry, and composition-root wiring."
            : "Mouse Scroll required contract, runtime proof, registry, or composition wiring is incomplete.",
        ),
        createPhase(
          "mouse-scroll-forbidden-shape",
          forbiddenShapePassed ? "PASS" : "CODE VIOLATION",
          forbiddenShapePassed,
          forbiddenShapePassed
            ? "Mouse Scroll root is sealed against BrowserController leakage, forbidden sibling imports, retired children, and runtime truth pollution."
            : "Mouse Scroll root still contains forbidden shapes, imports, or runtime leakage.",
        ),
        createPhase(
          "mouse-scroll-boundary-attack",
          boundaryPassed ? "PASS" : "CODE VIOLATION",
          boundaryPassed,
          boundaryPassed
            ? "Mouse Scroll ownership stays behind the public ability-group contract, primitive-port adapter, and composition root."
            : "Mouse Scroll ownership can still be bypassed or absorbed outside its governed boundary.",
        ),
        createPhase(
          "mouse-scroll-anti-escape",
          antiEscapePassed ? "PASS" : "CODE VIOLATION",
          antiEscapePassed,
          antiEscapePassed
            ? "Dynamic import, require, any-cast, child barrel export, and re-export escape routes are sealed."
            : "Mouse Scroll anti-escape enforcement still leaves a barrel, dynamic, or cast-based bypass path.",
        ),
      ],
    };
  },
});
