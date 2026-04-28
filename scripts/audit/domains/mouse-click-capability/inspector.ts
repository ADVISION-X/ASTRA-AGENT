import path from "node:path";
import { readdir, readFile } from "node:fs/promises";

import { Node, SyntaxKind, type ExportDeclaration, type ImportDeclaration, type SourceFile } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import { fileExists, listFilesRecursive } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import type { Finding } from "../../core/schema.js";
import {
  createAuditProject,
  getTypeAliasPropertyNames,
  hasCallExpressionPath,
  hasInterfaceMethod,
  hasPropertyAccessPath,
  hasStringLiteral,
} from "../_shared/ast-helpers.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";

const ROOT = "src/capabilities/mouse-click";
const CONTRACT_PATH = `${ROOT}/contract.ts`;
const ABILITY_GROUP_PATH = `${ROOT}/ability-group.ts`;
const REGISTRY_PATH = `${ROOT}/registry.ts`;
const INDEX_PATH = `${ROOT}/index.ts`;
const PRIMITIVE_PORT_PATH = `${ROOT}/primitive-port.ts`;
const CLICK_POLICY_PATH = `${ROOT}/shared/click-policy.ts`;
const CLICK_RESULT_PATH = `${ROOT}/shared/click-result.ts`;
const CLICK_FAILURE_PATH = `${ROOT}/shared/click-failure.ts`;
const RUNTIME_PROOF_PATH = `${ROOT}/shared/runtime-proof.ts`;
const COORDINATE_PATH = `${ROOT}/shared/coordinate.ts`;
const VALIDATE_INPUT_PATH = `${ROOT}/shared/validate-input.ts`;
const BROWSER_CHILD_PATH = `${ROOT}/children/click-browser-coordinate/implementation.ts`;
const DESKTOP_CHILD_PATH = `${ROOT}/children/click-desktop-coordinate/implementation.ts`;
const WORKBENCH_PATH = "src/lib/local-runtime/workbench.ts";
const VISION_RUNTIME_PATH = "src/lib/local-runtime/tiktok-platform/vision-coordinate-runtime.ts";
const PACKAGE_JSON_PATH = "package.json";
const VERIFY_SCRIPTS_ROOT = "scripts/verify";

const ALLOWED_CHILD_DIRECTORY_NAMES = ["click-browser-coordinate", "click-desktop-coordinate"] as const;
const ALLOWED_REGISTRY_FACTORIES = new Map<string, string>([
  ["click-browser-coordinate", "createClickBrowserCoordinateCapability"],
  ["click-desktop-coordinate", "createClickDesktopCoordinateCapability"],
]);

const REQUIRED_ROOT_FILES = [
  CONTRACT_PATH,
  ABILITY_GROUP_PATH,
  REGISTRY_PATH,
  INDEX_PATH,
  PRIMITIVE_PORT_PATH,
  CLICK_POLICY_PATH,
  CLICK_RESULT_PATH,
  CLICK_FAILURE_PATH,
  RUNTIME_PROOF_PATH,
  COORDINATE_PATH,
  BROWSER_CHILD_PATH,
  DESKTOP_CHILD_PATH,
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
  "coordinate",
  "button",
  "clickCount",
  "safetyPolicy",
] as const;

const REQUIRED_RESULT_FIELDS = [
  "status",
  "abilityGroupId",
  "childCapabilityId",
  "sessionId",
  "roundId",
  "videoVisitId",
  "actionExecutionRef",
  "primitiveExecutionRef",
  "geometryGuardRef",
  "x",
  "y",
  "coordinateSpace",
  "button",
  "clickCount",
  "startedAt",
  "endedAt",
  "durationMs",
  "failureReason",
  "statusMessage",
  "debugLogRef",
  "runtimeProof",
] as const;

const FORBIDDEN_CHILD_ROOTS = [
  `${ROOT}/children/click-left-point`,
  `${ROOT}/children/click-right-point`,
  `${ROOT}/children/double-click-left-point`,
  `${ROOT}/children/click-screen-coordinate`,
] as const;

const FORBIDDEN_REPO_IMPORT_PATHS = new Set(["src/lib/browser/browser-controller.ts"]);

const FORBIDDEN_REPO_IMPORT_PREFIXES = [
  "src/capabilities/geometry-guard/children/",
  "src/capabilities/screenshot/children/",
  "src/capabilities/visual-target/children/",
  "src/capabilities/ai/",
  "src/capabilities/post-action-verification/",
  "src/capabilities/forensics-persistence/",
] as const;

const FORBIDDEN_AST_TOKENS = [
  "imageEvidence",
  "scaleMapping",
  "MouseClickScaleMapping",
  "fallbackUsed",
  "browserAction",
  "BrowserActionId",
  "actionLogRef",
  "click-left-point",
  "click-right-point",
  "double-click-left-point",
  "click-screen-coordinate",
] as const;

const FORBIDDEN_ESCAPE_SEGMENTS = new Set(["legacy", "compat", "bridge", "v2"]);

function getSourceFile(project: ReturnType<typeof createAuditProject>, repoRelativePath: string): SourceFile | null {
  return project.getSourceFile(pathFromRepoRoot(repoRelativePath)) ?? null;
}

function getObjectLiteralPropertyNames(node: Node | undefined): Set<string> {
  if (!node || !Node.isObjectLiteralExpression(node)) {
    return new Set();
  }

  return new Set(
    node.getProperties().flatMap((property) => {
      if (Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property)) {
        return [property.getName()];
      }
      return [];
    }),
  );
}

function resolveRelativeRepoPath(fromRepoRelativePath: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) {
    return null;
  }

  return path.posix.normalize(
    path.posix.join(path.posix.dirname(fromRepoRelativePath), specifier.replaceAll("\\", "/")),
  );
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

function hasPathPrefix(repoRelativePath: string, prefix: string): boolean {
  return repoRelativePath === prefix.slice(0, -1) || repoRelativePath.startsWith(prefix);
}

function hasForbiddenImportTarget(sourceFile: SourceFile): boolean {
  return sourceFile.getImportDeclarations().some((declaration) => {
    const targetPath = getDeclarationTargetPath(declaration);
    if (!targetPath) {
      return false;
    }

    if (FORBIDDEN_REPO_IMPORT_PATHS.has(targetPath)) {
      return true;
    }

    return FORBIDDEN_REPO_IMPORT_PREFIXES.some((prefix) => hasPathPrefix(targetPath, prefix));
  });
}

function hasForbiddenAstToken(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendants().some((descendant) => {
    if (Node.isIdentifier(descendant)) {
      return FORBIDDEN_AST_TOKENS.some((token) => descendant.getText() === token);
    }

    if (
      Node.isPropertyAssignment(descendant)
      || Node.isPropertySignature(descendant)
      || Node.isShorthandPropertyAssignment(descendant)
    ) {
      return FORBIDDEN_AST_TOKENS.some((token) => descendant.getName() === token);
    }

    if (Node.isStringLiteral(descendant) || Node.isNoSubstitutionTemplateLiteral(descendant)) {
      return FORBIDDEN_AST_TOKENS.some((token) => descendant.getLiteralText() === token);
    }

    return false;
  });
}

function getRegistryEntries(sourceFile: SourceFile): Array<{ childCapabilityId: string; factoryName: string | null }> {
  const registryFactory = sourceFile.getFunction("createMouseClickCapabilityRegistry");
  const newMapExpression = registryFactory?.getDescendantsOfKind(SyntaxKind.NewExpression).find((expression) => expression.getExpression().getText() === "Map");
  const [argument] = newMapExpression?.getArguments() ?? [];
  if (!argument || !Node.isArrayLiteralExpression(argument)) {
    return [];
  }

  return argument.getElements().flatMap((element) => {
    if (!Node.isArrayLiteralExpression(element)) {
      return [];
    }

    const [childCapabilityIdNode, factoryNode] = element.getElements();
    if (!Node.isStringLiteral(childCapabilityIdNode) || !Node.isCallExpression(factoryNode)) {
      return [];
    }

    const expression = factoryNode.getExpression();
    return [{
      childCapabilityId: childCapabilityIdNode.getLiteralText(),
      factoryName: Node.isIdentifier(expression) ? expression.getText() : null,
    }];
  });
}

function filePathHasEscapeSegment(repoRelativePath: string): boolean {
  const segments = repoRelativePath.split("/");
  return segments.some((segment) => FORBIDDEN_ESCAPE_SEGMENTS.has(segment) || segment.endsWith("-v2"));
}

async function getDirectChildDirectoryNames(repoRelativePath: string): Promise<string[]> {
  const absolutePath = pathFromRepoRoot(repoRelativePath);
  if (!(await fileExists(absolutePath))) {
    return [];
  }

  const entries = await readdir(absolutePath, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

async function getDirectoryEntries(repoRelativePath: string): Promise<string[]> {
  const absolutePath = pathFromRepoRoot(repoRelativePath);
  if (!(await fileExists(absolutePath))) {
    return [];
  }

  return (await readdir(absolutePath, { withFileTypes: true }))
    .map((entry) => entry.name)
    .sort();
}

async function getPackageScripts(): Promise<Record<string, string>> {
  const packageText = await readFile(pathFromRepoRoot(PACKAGE_JSON_PATH), "utf8");
  const packageJson = JSON.parse(packageText) as { scripts?: Record<string, string> };
  return packageJson.scripts ?? {};
}

function hasValidateInputImport(sourceFile: SourceFile): boolean {
  return sourceFile.getImportDeclarations().some((declaration) => {
    if (getDeclarationTargetPath(declaration) !== VALIDATE_INPUT_PATH) {
      return false;
    }

    return declaration.getNamedImports().some((importSpecifier) => importSpecifier.getName() === "validateMouseClickAbilityInput");
  });
}

function childImplementationUsesValidation(
  sourceFile: SourceFile,
  childCapabilityId: string,
  coordinateSpace: "browserViewport" | "desktopScreen",
): boolean {
  return hasValidateInputImport(sourceFile)
    && sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
      const expression = callExpression.getExpression();
      return Node.isIdentifier(expression) && expression.getText() === "validateMouseClickAbilityInput";
    })
    && hasCallExpressionPath(sourceFile, ["context", "primitivePort", "click"])
    && hasStringLiteral(sourceFile, childCapabilityId)
    && hasStringLiteral(sourceFile, coordinateSpace);
}

function validationFunctionEnforcesGuard(sourceFile: SourceFile): boolean {
  const validationFunction = sourceFile.getFunction("validateMouseClickAbilityInput");
  if (!validationFunction) {
    return false;
  }

  return hasPropertyAccessPath(validationFunction, ["input", "geometryGuardRef"])
    && hasPropertyAccessPath(validationFunction, ["input", "guardDecision"])
    && hasStringLiteral(validationFunction, "allow")
    && hasPropertyAccessPath(validationFunction, ["input", "sourceEvidenceRef"])
    && hasPropertyAccessPath(validationFunction, ["input", "sourceTargetRef"])
    && hasPropertyAccessPath(validationFunction, ["input", "safetyPolicy", "allowOperatorManual"])
    && hasPropertyAccessPath(validationFunction, ["input", "safetyPolicy", "operatorManualApprovalRef"])
    && hasPropertyAccessPath(validationFunction, ["input", "safetyPolicy", "allowRightClick"])
    && hasPropertyAccessPath(validationFunction, ["input", "safetyPolicy", "allowDoubleClick"])
    && hasPropertyAccessPath(validationFunction, ["input", "safetyPolicy", "blockIfNoSourceRef"])
    && hasPropertyAccessPath(validationFunction, ["input", "safetyPolicy", "maxDurationMs"]);
}

export default createPendingDomainInspector({
  inspector: "GrassEye Mouse Click Capability Owner Inspector",
  inspectorId: "mouse-click-capability-owner",
  capabilityDomain: "mouse-click-capability",
  inspectorEntry: "scripts/audit/domains/mouse-click-capability/inspector.ts",
  ownedPaths: [ROOT],
  pendingSummary: "mouse-click-capability law exists but production-grade click execution boundaries are not fully enforced yet",
  implementedSummary: "mouse-click-capability is implemented as a primitive-port-backed, Geometry Guard-gated click owner with AST-backed enforcement",
  extraChecks: async () => {
    const project = createAuditProject();
    const contractSource = getSourceFile(project, CONTRACT_PATH);
    const registrySource = getSourceFile(project, REGISTRY_PATH);
    const indexSource = getSourceFile(project, INDEX_PATH);
    const primitivePortSource = getSourceFile(project, PRIMITIVE_PORT_PATH);
    const validateInputSource = getSourceFile(project, VALIDATE_INPUT_PATH);
    const browserChildSource = getSourceFile(project, BROWSER_CHILD_PATH);
    const desktopChildSource = getSourceFile(project, DESKTOP_CHILD_PATH);
    const workbenchSource = getSourceFile(project, WORKBENCH_PATH);
    const visionRuntimeSource = getSourceFile(project, VISION_RUNTIME_PATH);
    const mouseClickRootFiles = await listFilesRecursive(pathFromRepoRoot(ROOT), { extensions: [".ts"] });
    const verifyScriptFiles = await listFilesRecursive(pathFromRepoRoot(VERIFY_SCRIPTS_ROOT), { extensions: [".js", ".mjs", ".ts"] });
    const childDirectoryNames = await getDirectChildDirectoryNames(`${ROOT}/children`);
    const findings: Finding[] = [];

    const requiredFileFlags = await Promise.all(REQUIRED_ROOT_FILES.map((filePath) => fileExists(pathFromRepoRoot(filePath))));
    const missingRequiredFile = REQUIRED_ROOT_FILES.find((_, index) => !requiredFileFlags[index]);
    if (missingRequiredFile) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V1", file: missingRequiredFile, line: 1, severity: "fatal", message: "Mouse Click canonical topology is incomplete; required primitive-port/shared/children files are missing." }));
    }

    const inputFields = contractSource ? getTypeAliasPropertyNames(contractSource, "MouseClickAbilityInput") : new Set<string>();
    const resultFields = contractSource ? getTypeAliasPropertyNames(contractSource, "MouseClickAbilityResult") : new Set<string>();
    const contractPassed = contractSource !== null && primitivePortSource !== null
      ? REQUIRED_INPUT_FIELDS.every((field) => inputFields.has(field))
        && REQUIRED_RESULT_FIELDS.every((field) => resultFields.has(field))
        && hasInterfaceMethod(contractSource, "MouseClickAbilityGroup", "execute")
        && hasInterfaceMethod(primitivePortSource, "MouseClickPrimitivePort", "click")
        && !contractSource.getTypeAlias("MouseClickScaleMapping")
        && !contractSource.getImportDeclarations().some((declaration) => getDeclarationTargetPath(declaration) === "src/lib/browser/browser-controller.ts")
        && !contractSource.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => {
          const text = identifier.getText();
          return text === "BrowserController" || text === "BrowserActionResult" || text === "BrowserActionId";
        })
        && !["fallbackUsed", "browserAction", "actionLogRef"].some((field) => resultFields.has(field))
      : false;
    if (!contractPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-003-V1", file: CONTRACT_PATH, line: 1, severity: "fatal", message: "Mouse Click public contract must expose Geometry Guard-gated input, runtime proof fields, and no BrowserController/BrowserActionResult leakage." }));
    }

    const missingChildDirectories = ALLOWED_CHILD_DIRECTORY_NAMES.filter((directoryName) => !childDirectoryNames.includes(directoryName));
    const unexpectedChildDirectories = childDirectoryNames.filter((directoryName) => !ALLOWED_CHILD_DIRECTORY_NAMES.includes(directoryName as (typeof ALLOWED_CHILD_DIRECTORY_NAMES)[number]));
    if (missingChildDirectories.length > 0 || unexpectedChildDirectories.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V1", file: `${ROOT}/children`, line: 1, severity: "fatal", message: "Mouse Click children directory must contain only click-browser-coordinate and click-desktop-coordinate." }));
    }

    const rootSourceFiles = mouseClickRootFiles.map((filePath) => project.getSourceFile(filePath)).filter((value): value is NonNullable<typeof value> => Boolean(value));

    const forbiddenRootImports = rootSourceFiles.flatMap((sourceFile) => {
      const relativePath = toRepoRelativePath(sourceFile.getFilePath());
      return hasForbiddenImportTarget(sourceFile) ? [relativePath] : [];
    });
    if (forbiddenRootImports.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V1", file: forbiddenRootImports[0]!, line: 1, severity: "fatal", message: "Mouse Click root must not import browser-controller, other groups' child implementations, AI, Post-action Verification, or Forensics internals." }));
    }

    const forbiddenTokensInRoot = rootSourceFiles.flatMap((sourceFile) => {
      const relativePath = toRepoRelativePath(sourceFile.getFilePath());
      return hasForbiddenAstToken(sourceFile) ? [relativePath] : [];
    });
    if (forbiddenTokensInRoot.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V1", file: forbiddenTokensInRoot[0]!, line: 1, severity: "fatal", message: "Mouse Click positive code still contains forbidden legacy coordinate, fallback, browserAction, or retired child tokens." }));
    }

    const capabilityCheckFiles = mouseClickRootFiles.map((filePath) => toRepoRelativePath(filePath)).filter((filePath) => filePath.endsWith("/capability-check.ts"));
    if (capabilityCheckFiles.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-004-V1", file: capabilityCheckFiles[0]!, line: 1, severity: "fatal", message: "capability-check.ts must not exist under Mouse Click; enforcement belongs to the domain inspector." }));
    }

    const verifyFunctions = rootSourceFiles.flatMap((sourceFile) => {
      const relativePath = toRepoRelativePath(sourceFile.getFilePath());
      const matchingFunctions = sourceFile.getFunctions().filter((fn) => (fn.getName() ?? "").startsWith("verify"));
      const matchingVariables = sourceFile.getVariableDeclarations().filter((declaration) => declaration.getName().startsWith("verify"));
      return matchingFunctions.length > 0 || matchingVariables.length > 0 ? [relativePath] : [];
    });
    if (verifyFunctions.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-004-V1", file: verifyFunctions[0]!, line: 1, severity: "fatal", message: "verify* functions must not exist under Mouse Click canonical root." }));
    }

    const mouseClickVerifyScripts = verifyScriptFiles
      .map((filePath) => toRepoRelativePath(filePath))
      .filter((filePath) => path.posix.basename(filePath).includes("mouse-click"));
    if (mouseClickVerifyScripts.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-004-V1", file: mouseClickVerifyScripts[0]!, line: 1, severity: "fatal", message: "scripts/verify must not provide Mouse Click-specific acceptance escape paths." }));
    }

    const packageScripts = await getPackageScripts();
    const mouseClickVerifyScriptEntry = Object.entries(packageScripts).find(([scriptName, scriptCommand]) => {
      const normalizedName = scriptName.toLowerCase();
      const normalizedCommand = scriptCommand.toLowerCase();
      return (normalizedName.includes("verify") || normalizedCommand.includes("scripts/verify"))
        && (normalizedName.includes("mouse-click") || normalizedCommand.includes("mouse-click"));
    });
    if (mouseClickVerifyScriptEntry) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-004-V1", file: PACKAGE_JSON_PATH, line: 1, severity: "fatal", message: "package.json must not expose Mouse Click verify-script acceptance commands." }));
    }

    const indexExportsChildren = indexSource !== null
      ? indexSource.getExportDeclarations().some((declaration) => {
        const targetPath = getDeclarationTargetPath(declaration);
        return Boolean(targetPath && hasPathPrefix(targetPath, `${ROOT}/children/`));
      })
      : false;
    if (indexExportsChildren) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V1", file: INDEX_PATH, line: 1, severity: "fatal", message: "Mouse Click index must not barrel export child implementations." }));
    }

    const externalChildImports = project.getSourceFiles().flatMap((sourceFile) => {
      const relativePath = toRepoRelativePath(sourceFile.getFilePath());
      return sourceFile.getImportDeclarations().flatMap((declaration) => {
        const targetPath = getDeclarationTargetPath(declaration);
        return targetPath && hasPathPrefix(targetPath, `${ROOT}/children/`) && !relativePath.startsWith(`${ROOT}/`) ? [relativePath] : [];
      });
    });
    if (externalChildImports.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-CAPABILITY-GROUP-002-V1", file: externalChildImports[0]!, line: 1, severity: "fatal", message: "Mouse Click child implementations must remain private to the owning ability group." }));
    }

    const dynamicChildImports = project.getSourceFiles().flatMap((sourceFile) => {
      const relativePath = toRepoRelativePath(sourceFile.getFilePath());
      return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).flatMap((callExpression) => {
        if (callExpression.getExpression().getKind() !== SyntaxKind.ImportKeyword) {
          return [];
        }

        const [argument] = callExpression.getArguments();
        const importTarget = (Node.isStringLiteral(argument) || Node.isNoSubstitutionTemplateLiteral(argument))
          ? resolveRelativeRepoPath(relativePath, argument.getLiteralText())
          : null;
        if (importTarget && hasPathPrefix(importTarget, `${ROOT}/children/`)) {
          return [relativePath];
        }
        return [];
      });
    });
    if (dynamicChildImports.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V1", file: dynamicChildImports[0]!, line: 1, severity: "fatal", message: "Mouse Click child implementations must not be loaded through dynamic import escape paths." }));
    }

    const registryEntries = registrySource ? getRegistryEntries(registrySource) : [];
    const registryPassed = registryEntries.length === ALLOWED_REGISTRY_FACTORIES.size
      && registryEntries.every((entry) => ALLOWED_REGISTRY_FACTORIES.get(entry.childCapabilityId) === entry.factoryName);
    if (!registryPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V1", file: REGISTRY_PATH, line: 1, severity: "fatal", message: "Mouse Click registry must contain only browser and desktop execution children." }));
    }

    const invalidChildFile = await Promise.any(
      ALLOWED_CHILD_DIRECTORY_NAMES.map(async (directoryName) => {
        const entries = await getDirectoryEntries(`${ROOT}/children/${directoryName}`);
        const isValid = entries.length === 1 && entries[0] === "implementation.ts";
        return isValid ? null : `${ROOT}/children/${directoryName}`;
      }),
    ).catch(() => null);
    if (invalidChildFile) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V1", file: invalidChildFile, line: 1, severity: "fatal", message: "Each Mouse Click child root must contain only implementation.ts as executable surface." }));
    }

    const validationPassed = validateInputSource !== null && browserChildSource !== null && desktopChildSource !== null
      ? validationFunctionEnforcesGuard(validateInputSource)
        && childImplementationUsesValidation(browserChildSource, "click-browser-coordinate", "browserViewport")
        && childImplementationUsesValidation(desktopChildSource, "click-desktop-coordinate", "desktopScreen")
      : false;
    if (!validationPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-003-V1", file: VALIDATE_INPUT_PATH, line: 1, severity: "fatal", message: "Mouse Click must enforce Geometry Guard allow, source-ref policy, and right/double-click policy through shared validation and child execution paths." }));
    }

    const createGroupCalls = workbenchSource?.getDescendantsOfKind(SyntaxKind.CallExpression).filter((callExpression) => {
      const expression = callExpression.getExpression();
      return Node.isIdentifier(expression) && expression.getText() === "createMouseClickAbilityGroup";
    }) ?? [];
    const workbenchUsesPrimitivePort = createGroupCalls.some((callExpression) => {
      const [argument] = callExpression.getArguments();
      const propertyNames = getObjectLiteralPropertyNames(argument);
      return propertyNames.has("primitivePort") && !propertyNames.has("browserController");
    });
    if (!workbenchUsesPrimitivePort) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-001-V1", file: WORKBENCH_PATH, line: 1, severity: "error", message: "Workbench composition root must inject MouseClickPrimitivePort rather than BrowserController directly into Mouse Click." }));
    }

    const executeCalls = visionRuntimeSource?.getDescendantsOfKind(SyntaxKind.CallExpression).filter((callExpression) => {
      const expression = callExpression.getExpression();
      return Node.isPropertyAccessExpression(expression) && expression.getName() === "execute" && expression.getExpression().getText() === "this.mouseClickAbilityGroup";
    }) ?? [];
    const geometryGuardGatedClick = executeCalls.some((callExpression) => {
      const [argument] = callExpression.getArguments();
      if (!Node.isObjectLiteralExpression(argument)) {
        return false;
      }

      const propertyNames = getObjectLiteralPropertyNames(argument);
      const coordinateAssignment = argument.getProperty("coordinate");
      const coordinateNames = Node.isPropertyAssignment(coordinateAssignment)
        ? getObjectLiteralPropertyNames(coordinateAssignment.getInitializer())
        : new Set<string>();

      return propertyNames.has("geometryGuardRef")
        && propertyNames.has("guardDecision")
        && propertyNames.has("button")
        && propertyNames.has("clickCount")
        && coordinateNames.has("boundsWidth")
        && coordinateNames.has("boundsHeight")
        && !coordinateNames.has("scaleMapping");
    });
    if (!geometryGuardGatedClick) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-003-V1", file: VISION_RUNTIME_PATH, line: 1, severity: "error", message: "Upstream Mouse Click calls must pass geometryGuardRef, guardDecision, button, clickCount, and bounds without scaleMapping." }));
    }

    const forbiddenRootsExist = await Promise.all(FORBIDDEN_CHILD_ROOTS.map((filePath) => fileExists(pathFromRepoRoot(filePath))));
    const retiredChildStillExists = FORBIDDEN_CHILD_ROOTS.find((_, index) => forbiddenRootsExist[index]);
    if (retiredChildStillExists) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V1", file: retiredChildStillExists, line: 1, severity: "fatal", message: "Retired Mouse Click child roots must be physically deleted after topology cutover." }));
    }

    const antiEscapePassed = mouseClickRootFiles.every((filePath) => !filePathHasEscapeSegment(toRepoRelativePath(filePath)))
      && childDirectoryNames.every((directoryName) => !filePathHasEscapeSegment(`${ROOT}/children/${directoryName}`));
    if (!antiEscapePassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V1", file: ROOT, line: 1, severity: "fatal", message: "Mouse Click canonical root must not contain bridge, compat, legacy, or v2 escape paths." }));
    }

    const requiredShapePassed = !missingRequiredFile && contractPassed && registryPassed && missingChildDirectories.length === 0 && unexpectedChildDirectories.length === 0 && !invalidChildFile;
    const forbiddenShapePassed = retiredChildStillExists === undefined
      && forbiddenRootImports.length === 0
      && forbiddenTokensInRoot.length === 0
      && capabilityCheckFiles.length === 0
      && verifyFunctions.length === 0
      && mouseClickVerifyScripts.length === 0
      && !mouseClickVerifyScriptEntry;
    const boundaryAttackPassed = workbenchUsesPrimitivePort && geometryGuardGatedClick && validationPassed && externalChildImports.length === 0;
    const antiEscapePhasePassed = antiEscapePassed && dynamicChildImports.length === 0 && !indexExportsChildren;

    return {
      findings,
      phases: [
        createPhase("mouse-click-required-shape", requiredShapePassed ? "PASS" : "CODE VIOLATION", requiredShapePassed, requiredShapePassed ? "Mouse Click exposes the required primitive-port topology, exact child registry, and one governed contract." : "Mouse Click required shape is incomplete, child topology drifted, or registry shape is no longer exact."),
        createPhase("mouse-click-forbidden-shape", forbiddenShapePassed ? "PASS" : "CODE VIOLATION", forbiddenShapePassed, forbiddenShapePassed ? "Mouse Click root is free of BrowserController leakage, mapping logic, retired child roots, and verify-script escape hatches." : "Mouse Click root still contains forbidden imports, legacy tokens, retired child roots, or verify-script escape hatches."),
        createPhase("mouse-click-boundary-attack", boundaryAttackPassed ? "PASS" : "CODE VIOLATION", boundaryAttackPassed, boundaryAttackPassed ? "Composition root injects primitivePort and child execution stays behind Geometry Guard validation." : "Mouse Click boundary wiring still bypasses primitivePort injection, shared validation, or Geometry Guard-gated input."),
        createPhase("mouse-click-anti-escape", antiEscapePhasePassed ? "PASS" : "CODE VIOLATION", antiEscapePhasePassed, antiEscapePhasePassed ? "Mouse Click has no child leakage, dynamic-import escape, or legacy/bridge/v2 topology." : "Mouse Click still exposes an anti-escape gap through child leakage, dynamic imports, or legacy topology."),
      ],
    };
  },
});