import path from "node:path";

import { Node, Project, SyntaxKind, type ObjectLiteralExpression, type SourceFile } from "ts-morph";

import { listFilesRecursive, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { getAuditProject, getNodeLine, getSourceFileOrThrow, toRelativeSourcePath } from "../../core/ts-morph.js";

const LAW_ID = "GRASSEYE-LOCAL-BROWSER-SESSION-001-V1";
const LAW_PATH = ".github/instructions/cursor-rules/modules/module-local-browser-session.instructions.md";
const BLUEPRINT_PATH = "docs/法案辅助文件/GrassEye 本地真实Chrome会话与登录态持久化施工图.md";
const TYPES_PATH = "src/types/local-browser-session.ts";
const HELPER_PATH = "src/lib/browser/local-browser-session.ts";
const CONTROLLER_PATH = "src/lib/browser/current-chrome-browser-controller.ts";
const REMOVED_CONTROLLER_PATH = "src/lib/browser/playwright-browser-controller.ts";
const WORKBENCH_PATH = "src/lib/local-runtime/workbench.ts";
const SERVER_PATH = "src/app/server.ts";
const RUNTIME_PATH = "src/types/runtime.ts";
const STARTUP_ENTRY_PATH = "scripts/startup/launch-grasseye.mjs";
const STARTUP_OPEN_HELPER_PATH = "scripts/startup/lib/open-commander-console.mjs";
const GITIGNORE_PATH = ".gitignore";
const GOVERNED_ROOTS = ["src/lib/browser/", "src/lib/local-runtime/", "src/features/" + "platform-action/"] as const;
const SCRIPT_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"] as const;
const FORBIDDEN_ENV_KEYS = ["GRASSEYE_BROWSER_PROFILE_REF", "GRASSEYE_BROWSER_USER_DATA_DIR"] as const;
const FORBIDDEN_IMPORT_SPECIFIERS = ["playwright", "playwright-core"] as const;
const FORBIDDEN_IDENTIFIER_NAMES = ["PlaywrightBrowserController", "localStorage", "sessionStorage"] as const;
const FORBIDDEN_PROPERTY_NAMES = ["storageState", "addCookies", "cookies"] as const;
const REQUIRED_MODE_FIELDS = [
  "browserMode",
  "browserExecutable",
  "browserProfileRef",
  "browserProfileStatus",
  "browserProfileDirectory",
  "browserProfileProvisioning",
  "browserProfileVerificationStatus",
  "browserProfileVerificationReason",
  "loginState",
  "lastLoginCheckAt",
  "loginRequiredReason",
  "reviewRequiredReason",
] as const;
const REQUIRED_RUNTIME_FIELDS = [
  "browserMode",
  "browserProfileRef",
  "browserProfileDirectory",
  "browserProfileStatus",
  "browserProfileProvisioning",
  "browserProfileVerificationStatus",
  "browserProfileVerificationReason",
  "loginState",
] as const;

const looseScriptProject = new Project({
  useInMemoryFileSystem: true,
  skipFileDependencyResolution: true,
});

const includesAll = (text: string, markers: readonly string[]): boolean => markers.every((marker) => text.includes(marker));

const debug = (message: string): void => {
  process.stdout.write(`[audit:local-browser-session] ${message}\n`);
};

const hasScriptExtension = (filePath: string): boolean => SCRIPT_EXTENSIONS.some((extension) => filePath.endsWith(extension));

const isForbiddenTestPath = (filePath: string): boolean =>
  filePath.includes("/__tests__/")
  || filePath.startsWith("tests/")
  || filePath.includes("/tests/")
  || SCRIPT_EXTENSIONS.some((extension) => filePath.endsWith(`.test${extension}`));

const createLooseSourceFile = (relativePath: string, content: string): SourceFile => {
  const existing = looseScriptProject.getSourceFile(relativePath);
  if (existing) {
    existing.replaceWithText(content);
    return existing;
  }

  return looseScriptProject.createSourceFile(relativePath, content, { overwrite: true });
};

const getZodObjectPropertyNames = (sourceFile: SourceFile, declarationName: string): Set<string> => {
  const declaration = sourceFile.getVariableDeclaration(declarationName);
  const initializer = declaration?.getInitializerIfKind(SyntaxKind.CallExpression);
  const firstArgument = initializer?.getArguments()[0];
  if (!firstArgument || !Node.isObjectLiteralExpression(firstArgument)) {
    return new Set();
  }

  return new Set(
    firstArgument
      .getProperties()
      .filter((property): property is import("ts-morph").PropertyAssignment | import("ts-morph").ShorthandPropertyAssignment =>
        Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property))
      .map((property) => property.getName()),
  );
};

const getTypeAliasPropertyNames = (sourceFile: SourceFile, declarationName: string): Set<string> => {
  const declaration = sourceFile.getTypeAlias(declarationName);
  const typeNode = declaration?.getTypeNode();
  if (!typeNode || !Node.isTypeLiteral(typeNode)) {
    return new Set();
  }

  return new Set(
    typeNode
      .getProperties()
      .filter((property): property is import("ts-morph").PropertySignature => Node.isPropertySignature(property))
      .map((property) => property.getName()),
  );
};

const getZodEnumValues = (sourceFile: SourceFile, declarationName: string): Set<string> => {
  const declaration = sourceFile.getVariableDeclaration(declarationName);
  const initializer = declaration?.getInitializerIfKind(SyntaxKind.CallExpression);
  const firstArgument = initializer?.getArguments()[0];
  if (!firstArgument || !Node.isArrayLiteralExpression(firstArgument)) {
    return new Set();
  }

  return new Set(
    firstArgument
      .getElements()
      .filter((element): element is import("ts-morph").StringLiteral => Node.isStringLiteral(element))
      .map((element) => element.getLiteralText()),
  );
};

const getImportedNamedBindings = (sourceFile: SourceFile, moduleSpecifier: string): Set<string> => {
  const importDeclaration = sourceFile.getImportDeclarations().find((item) => item.getModuleSpecifierValue() === moduleSpecifier);
  if (!importDeclaration) {
    return new Set();
  }

  return new Set(importDeclaration.getNamedImports().map((namedImport) => namedImport.getName()));
};

const getExpressionPath = (node: Node | undefined): string[] => {
  if (!node) {
    return [];
  }

  if (Node.isPropertyAccessExpression(node)) {
    return [...getExpressionPath(node.getExpression()), node.getName()];
  }

  if (Node.isIdentifier(node)) {
    return [node.getText()];
  }

  if (Node.isElementAccessExpression(node)) {
    const argument = node.getArgumentExpression();
    if (argument && (Node.isStringLiteral(argument) || Node.isNoSubstitutionTemplateLiteral(argument))) {
      return [...getExpressionPath(node.getExpression()), argument.getLiteralText()];
    }
  }

  return [];
};

const getFunctionLike = (sourceFile: SourceFile, name: string): Node | null => {
  const variableInitializer = sourceFile.getVariableDeclaration(name)?.getInitializer();
  if (variableInitializer && (Node.isArrowFunction(variableInitializer) || Node.isFunctionExpression(variableInitializer))) {
    return variableInitializer;
  }

  return sourceFile.getFunction(name) ?? null;
};

const getReturnedObjectLiteral = (node: Node | null): ObjectLiteralExpression | null => {
  if (!node) {
    return null;
  }

  if (Node.isArrowFunction(node)) {
    const body = node.getBody();
    if (Node.isObjectLiteralExpression(body)) {
      return body;
    }
  }

  if (Node.isArrowFunction(node)) {
    const body = node.getBody();
    if (Node.isCallExpression(body)) {
      const firstArgument = body.getArguments()[0];
      return firstArgument && Node.isObjectLiteralExpression(firstArgument) ? firstArgument : null;
    }
  }

  const returnStatement = node.getDescendantsOfKind(SyntaxKind.ReturnStatement).find((statement) => {
    const expression = statement.getExpression();
    if (!expression) {
      return false;
    }

    if (Node.isObjectLiteralExpression(expression)) {
      return true;
    }

    if (Node.isCallExpression(expression)) {
      const firstArgument = expression.getArguments()[0];
      return Boolean(firstArgument && Node.isObjectLiteralExpression(firstArgument));
    }

    return false;
  });
  const expression = returnStatement?.getExpression();
  if (!expression) {
    return null;
  }

  if (Node.isObjectLiteralExpression(expression)) {
    return expression;
  }

  if (Node.isCallExpression(expression)) {
    const firstArgument = expression.getArguments()[0];
    return firstArgument && Node.isObjectLiteralExpression(firstArgument) ? firstArgument : null;
  }

  return null;
};

const getObjectLiteralArgument = (expression: import("ts-morph").CallExpression | import("ts-morph").NewExpression | null, index = 0): ObjectLiteralExpression | null => {
  const argument = expression?.getArguments()[index];
  return argument && Node.isObjectLiteralExpression(argument) ? argument : null;
};

const getObjectLiteralPropertyNames = (objectLiteral: ObjectLiteralExpression | null): Set<string> => {
  if (!objectLiteral) {
    return new Set();
  }

  return new Set(
    objectLiteral
      .getProperties()
      .filter((property): property is import("ts-morph").PropertyAssignment | import("ts-morph").ShorthandPropertyAssignment =>
        Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property))
      .map((property) => property.getName()),
  );
};

const objectLiteralReferencesIdentifier = (objectLiteral: ObjectLiteralExpression | null, identifierName: string): boolean =>
  Boolean(objectLiteral?.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => identifier.getText() === identifierName));

const getPropertyInitializerText = (objectLiteral: ObjectLiteralExpression | null, propertyName: string): string | null => {
  const property = objectLiteral?.getProperty(propertyName);
  if (!property) {
    return null;
  }

  if (Node.isShorthandPropertyAssignment(property)) {
    return property.getName();
  }

  if (!Node.isPropertyAssignment(property)) {
    return null;
  }

  return property.getInitializer()?.getText() ?? null;
};

const hasIdentifier = (sourceFile: SourceFile, identifierName: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => identifier.getText() === identifierName);

const hasProcessEnvReference = (sourceFile: SourceFile, envKey: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((expression) => {
    const pathParts = getExpressionPath(expression);
    return pathParts.length === 3
      && pathParts[0] === "process"
      && pathParts[1] === "env"
      && pathParts[2] === envKey;
  });

const findCallByIdentifier = (sourceFile: SourceFile, identifierName: string) =>
  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === identifierName;
  }) ?? null;

const hasCallByIdentifier = (node: Node, identifierName: string): boolean =>
  node.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === identifierName;
  });

const hasCallByPath = (node: Node, expectedPath: readonly string[]): boolean =>
  node.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const actualPath = getExpressionPath(callExpression.getExpression());
    return actualPath.length === expectedPath.length && actualPath.every((segment, index) => segment === expectedPath[index]);
  });

const hasTemplateLiteralMarker = (node: Node, marker: string): boolean =>
  node.getDescendants().some((descendant) => {
    if (Node.isNoSubstitutionTemplateLiteral(descendant)) {
      return descendant.getLiteralText().includes(marker);
    }

    if (Node.isTemplateExpression(descendant)) {
      return descendant.getText().includes(marker);
    }

    return false;
  });

const hasImportFrom = (sourceFile: SourceFile, moduleSpecifier: string): boolean =>
  sourceFile.getImportDeclarations().some((importDeclaration) => importDeclaration.getModuleSpecifierValue() === moduleSpecifier);

const hasForbiddenModuleReference = (sourceFile: SourceFile): { line: number; detail: string } | null => {
  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    const moduleSpecifier = importDeclaration.getModuleSpecifierValue();
    if (FORBIDDEN_IMPORT_SPECIFIERS.includes(moduleSpecifier as (typeof FORBIDDEN_IMPORT_SPECIFIERS)[number]) || moduleSpecifier.includes("playwright-browser-controller")) {
      return {
        line: getNodeLine(importDeclaration),
        detail: `forbidden import ${moduleSpecifier}`,
      };
    }
  }

  for (const exportDeclaration of sourceFile.getExportDeclarations()) {
    const moduleSpecifier = exportDeclaration.getModuleSpecifierValue();
    if (moduleSpecifier && (FORBIDDEN_IMPORT_SPECIFIERS.includes(moduleSpecifier as (typeof FORBIDDEN_IMPORT_SPECIFIERS)[number]) || moduleSpecifier.includes("playwright-browser-controller"))) {
      return {
        line: getNodeLine(exportDeclaration),
        detail: `forbidden export ${moduleSpecifier}`,
      };
    }
  }

  for (const callExpression of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expression = callExpression.getExpression();
    const firstArgument = callExpression.getArguments()[0];
    const moduleSpecifier = firstArgument && (Node.isStringLiteral(firstArgument) || Node.isNoSubstitutionTemplateLiteral(firstArgument))
      ? firstArgument.getLiteralText()
      : null;
    if (!moduleSpecifier) {
      continue;
    }

    const isRequireCall = Node.isIdentifier(expression) && expression.getText() === "require";
    const isDynamicImport = expression.getKind() === SyntaxKind.ImportKeyword;
    if ((isRequireCall || isDynamicImport) && (FORBIDDEN_IMPORT_SPECIFIERS.includes(moduleSpecifier as (typeof FORBIDDEN_IMPORT_SPECIFIERS)[number]) || moduleSpecifier.includes("playwright-browser-controller"))) {
      return {
        line: getNodeLine(callExpression),
        detail: `forbidden module load ${moduleSpecifier}`,
      };
    }
  }

  return null;
};

const hasForbiddenApiUsage = (sourceFile: SourceFile): { line: number; detail: string } | null => {
  for (const identifier of sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)) {
    if (FORBIDDEN_IDENTIFIER_NAMES.includes(identifier.getText() as (typeof FORBIDDEN_IDENTIFIER_NAMES)[number])) {
      return {
        line: getNodeLine(identifier),
        detail: `forbidden identifier ${identifier.getText()}`,
      };
    }
  }

  for (const propertyAccess of sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)) {
    if (FORBIDDEN_PROPERTY_NAMES.includes(propertyAccess.getName() as (typeof FORBIDDEN_PROPERTY_NAMES)[number])) {
      return {
        line: getNodeLine(propertyAccess),
        detail: `forbidden property access ${propertyAccess.getName()}`,
      };
    }

    const pathParts = getExpressionPath(propertyAccess);
    if (
      pathParts.length === 2
      && pathParts[0] === "chromium"
      && (pathParts[1] === "launchPersistentContext" || pathParts[1] === "launch")
    ) {
      return {
        line: getNodeLine(propertyAccess),
        detail: `forbidden browser launch path ${pathParts.join(".")}`,
      };
    }

    if (
      pathParts.length === 3
      && pathParts[0] === "process"
      && pathParts[1] === "env"
      && FORBIDDEN_ENV_KEYS.includes(pathParts[2] as (typeof FORBIDDEN_ENV_KEYS)[number])
    ) {
      return {
        line: getNodeLine(propertyAccess),
        detail: `forbidden env ${pathParts[2]}`,
      };
    }
  }

  return null;
};

export async function inspectLocalBrowserSessionBoundary(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const [law, blueprint, gitignore, repoFiles, startupEntryText, startupOpenHelperText] = await Promise.all([
    readTextFile(pathFromRepoRoot(LAW_PATH)),
    readTextFile(pathFromRepoRoot(BLUEPRINT_PATH)),
    readTextFile(pathFromRepoRoot(GITIGNORE_PATH)),
    listFilesRecursive(pathFromRepoRoot("."), { ignoreDirs: ["node_modules", "dist", ".git", ".grasseye-data"] }),
    readTextFile(pathFromRepoRoot(STARTUP_ENTRY_PATH)),
    readTextFile(pathFromRepoRoot(STARTUP_OPEN_HELPER_PATH)),
  ]);

  const findings: Finding[] = [];
  const project = getAuditProject();
  const typesSource = getSourceFileOrThrow(project, TYPES_PATH);
  const helperSource = getSourceFileOrThrow(project, HELPER_PATH);
  const controllerSource = getSourceFileOrThrow(project, CONTROLLER_PATH);
  const workbenchSource = getSourceFileOrThrow(project, WORKBENCH_PATH);
  const serverSource = getSourceFileOrThrow(project, SERVER_PATH);
  const runtimeSource = getSourceFileOrThrow(project, RUNTIME_PATH);
  const startupEntrySource = createLooseSourceFile(STARTUP_ENTRY_PATH, startupEntryText);
  const startupOpenHelperSource = createLooseSourceFile(STARTUP_OPEN_HELPER_PATH, startupOpenHelperText);
  const controllerPath = toRelativeSourcePath(controllerSource);

  debug("loaded law text, governed code surfaces, and startup script AST");

  const lawPassed = includesAll(law, ["persistent local user profile", "must not store raw cookies", "must not contain raw cookies or tokens", "Headless mode must be disabled by default"]);
  const blueprintPassed = includesAll(blueprint, [
    "real_chrome_persistent",
    ".grasseye-local/browser-profiles/<platform>/",
    "GrassEye 不读取 cookies",
    "当前本地浏览器 handoff 是固定页面打开的简单主路径",
    "open <url>",
    "HANDOFF_FIXED_URL_TO_CURRENT_LOCAL_BROWSER",
    "handoff_fixed_url_to_current_local_browser",
    "profile.last_used",
    "browserProfileDirectory",
    "launch 启动本地服务与打开 workbench 页面，不得依赖",
    "任务必须立刻进入 `review_required`",
    "打开浏览器必须有单一来源代码文件",
    "open -a <Chrome.app> <url>",
    "先复制一个受控 profile 再打开 URL",
  ]);
  if (!lawPassed) {
    findings.push(createFinding({ lawId: LAW_ID, file: LAW_PATH, line: 1, severity: "error", message: "Local browser session law is missing a persistent-profile or cookie-boundary requirement." }));
  }
  if (!blueprintPassed) {
    findings.push(createFinding({ lawId: LAW_ID, file: BLUEPRINT_PATH, line: 1, severity: "error", message: "Local browser session blueprint is missing the current-Chrome or anti-regression guidance for the removed downgrade path." }));
  }

  const browserModes = getZodEnumValues(typesSource, "BrowserModeSchema");
  const configFields = getZodObjectPropertyNames(typesSource, "LocalBrowserSessionConfigSchema");
  const stateFields = getZodObjectPropertyNames(typesSource, "LocalBrowserSessionStateSchema");
  const runtimeFields = getTypeAliasPropertyNames(runtimeSource, "BrowseRuntimeSnapshot");

  if (!browserModes.has("real_chrome_persistent")) {
    findings.push(createFinding({ lawId: LAW_ID, file: TYPES_PATH, line: 1, severity: "fatal", message: "BrowserMode must include real_chrome_persistent." }));
  }

  for (const requiredField of ["browserMode", "platform", "chromeExecutablePath", "profileRef", "userDataDir", "profileDirectory", "profileProvisioning", "profileVerificationStatus", "profileVerificationReason", "headlessAllowed", "createdAt", "updatedAt"]) {
    if (!configFields.has(requiredField)) {
      findings.push(createFinding({ lawId: LAW_ID, file: TYPES_PATH, line: 1, severity: "error", message: `LocalBrowserSessionConfigSchema is missing ${requiredField}.` }));
    }
  }

  for (const requiredField of ["browserMode", "browserProfileRef", "profileStatus", "profileDirectory", "profileProvisioning", "profileVerificationStatus", "profileVerificationReason", "loginState", "currentUrl", "lastLoginCheckAt", "reviewRequiredReason"]) {
    if (!stateFields.has(requiredField)) {
      findings.push(createFinding({ lawId: LAW_ID, file: TYPES_PATH, line: 1, severity: "error", message: `LocalBrowserSessionStateSchema is missing ${requiredField}.` }));
    }
  }

  for (const bannedField of ["cookie", "cookies", "session", "sessions", "token", "tokens", "storageState"]) {
    if (configFields.has(bannedField) || stateFields.has(bannedField)) {
      findings.push(createFinding({ lawId: LAW_ID, file: TYPES_PATH, line: 1, severity: "fatal", message: `Local browser session schemas must not expose raw ${bannedField} fields.` }));
    }
  }

  for (const runtimeField of REQUIRED_RUNTIME_FIELDS) {
    if (!runtimeFields.has(runtimeField)) {
      findings.push(createFinding({ lawId: LAW_ID, file: RUNTIME_PATH, line: 1, severity: "error", message: `BrowseRuntimeSnapshot is missing ${runtimeField}.` }));
    }
  }

  const helperFactory = getFunctionLike(helperSource, "createLocalBrowserSessionConfig");
  const helperReturn = getReturnedObjectLiteral(helperFactory);
  if (!helperReturn) {
    findings.push(createFinding({ lawId: LAW_ID, file: HELPER_PATH, line: 1, severity: "fatal", message: "Local browser session helper must return a parsed object literal config." }));
  } else {
    if (getPropertyInitializerText(helperReturn, "browserMode") !== '"real_chrome_persistent"') {
      findings.push(createFinding({ lawId: LAW_ID, file: HELPER_PATH, line: getNodeLine(helperReturn), severity: "fatal", message: "Local browser session helper must default browserMode to real_chrome_persistent." }));
    }
    if (getPropertyInitializerText(helperReturn, "headlessAllowed") !== "false") {
      findings.push(createFinding({ lawId: LAW_ID, file: HELPER_PATH, line: getNodeLine(helperReturn), severity: "fatal", message: "Local browser session helper must hard-forbid headless real-platform startup." }));
    }
  }

  const profileDirectoryResolver = getFunctionLike(helperSource, "resolveLocalChromeProfileDirectory");
  if (!profileDirectoryResolver || !hasCallByIdentifier(profileDirectoryResolver, "readLastUsedChromeProfileDirectory") || !hasIdentifier(helperSource, "DEFAULT_CHROME_PROFILE_DIRECTORY")) {
    findings.push(createFinding({ lawId: LAW_ID, file: HELPER_PATH, line: 1, severity: "error", message: "Local browser session helper must resolve Chrome profile directory via Local State before falling back to Default." }));
  }

  const startupImports = getImportedNamedBindings(startupEntrySource, "./lib/open-commander-console.mjs");
  if (!startupImports.has("openCommanderConsole")) {
    findings.push(createFinding({ lawId: LAW_ID, file: STARTUP_ENTRY_PATH, line: 1, severity: "fatal", message: "Startup entry must import openCommanderConsole from the single-source helper." }));
  }
  if (hasIdentifier(startupEntrySource, "assertExplicitBrowserProfileEnv")) {
    findings.push(createFinding({ lawId: LAW_ID, file: STARTUP_ENTRY_PATH, line: 1, severity: "fatal", message: "Startup launch must not hard gate fixed-page opening behind explicit browser profile env." }));
  }
  const startupOpenCall = startupEntrySource.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression)
      && expression.getText() === "openCommanderConsole"
      && callExpression.getArguments()[0]?.getText() === "baseUrl";
  }) ?? null;
  if (!startupOpenCall) {
    findings.push(createFinding({ lawId: LAW_ID, file: STARTUP_ENTRY_PATH, line: 1, severity: "error", message: "Startup entry must hand off the Commander Console through openCommanderConsole(baseUrl)." }));
  }
  const openReadyPageLogger = startupEntrySource.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => {
    const expression = callExpression.getExpression();
    if (!Node.isIdentifier(expression) || expression.getText() !== "log") {
      return false;
    }
    const argument = callExpression.getArguments()[0];
    if (!argument || !Node.isTemplateExpression(argument)) {
      return false;
    }
    const spanExpressions = argument.getTemplateSpans().map((span) => span.getExpression().getText());
    return argument.getHead().getLiteralText().startsWith("Opened ")
      && spanExpressions.includes("baseUrl")
      && spanExpressions.includes("openResult.browserName")
      && spanExpressions.includes("openResult.browserPath");
  }) ?? null;
  if (!openReadyPageLogger) {
    findings.push(createFinding({ lawId: LAW_ID, file: STARTUP_ENTRY_PATH, line: 1, severity: "error", message: "Startup launch must log the concrete browser path used for page opening." }));
  }

  const openCommandFactory = startupOpenHelperSource.getFunction("getOpenCommand");
  const darwinBranch = openCommandFactory?.getDescendantsOfKind(SyntaxKind.IfStatement).find((statement) => statement.getExpression().getText() === 'platform === "darwin"') ?? null;
  const darwinReturn = darwinBranch?.getThenStatement().getDescendantsOfKind(SyntaxKind.ReturnStatement).find((statement) => {
    const expression = statement.getExpression();
    return expression && Node.isObjectLiteralExpression(expression);
  }) ?? null;
  const darwinReturnObject = darwinReturn?.getExpression();
  if (!darwinReturnObject || !Node.isObjectLiteralExpression(darwinReturnObject)) {
    findings.push(createFinding({ lawId: LAW_ID, file: STARTUP_OPEN_HELPER_PATH, line: 1, severity: "error", message: "Startup open helper must define a darwin open command object." }));
  } else {
    const argsProperty = darwinReturnObject.getProperty("args");
    const argsInitializer = argsProperty && Node.isPropertyAssignment(argsProperty) ? argsProperty.getInitializer() : null;
    const usesOpenAChrome = argsInitializer
      && Node.isArrayLiteralExpression(argsInitializer)
      && argsInitializer.getElements().map((element) => element.getText()).join(",") === '"-a",browserAppPath,url';
    if (getPropertyInitializerText(darwinReturnObject, "command") !== '"open"' || !usesOpenAChrome) {
      findings.push(createFinding({ lawId: LAW_ID, file: STARTUP_OPEN_HELPER_PATH, line: getNodeLine(darwinReturnObject), severity: "error", message: "Startup open helper must use open -a <Chrome.app> <url> on darwin." }));
    }
  }
  const resolvesChromeApp = startupOpenHelperSource.getDescendantsOfKind(SyntaxKind.StringLiteral).some((literal) => literal.getLiteralText() === "/Applications/Google Chrome.app");
  if (!resolvesChromeApp) {
    findings.push(createFinding({ lawId: LAW_ID, file: STARTUP_OPEN_HELPER_PATH, line: 1, severity: "error", message: "Startup open helper must resolve the standard macOS Google Chrome.app path." }));
  }
  const openMainPageFunction = startupOpenHelperSource.getFunction("openMainPage");
  if (!openMainPageFunction || !hasCallByIdentifier(openMainPageFunction, "handoffToCurrentChromeTab")) {
    findings.push(createFinding({ lawId: LAW_ID, file: STARTUP_OPEN_HELPER_PATH, line: 1, severity: "error", message: "Startup open helper must try current-Chrome tab handoff before fallback open command execution." }));
  }

  const workbenchImports = getImportedNamedBindings(workbenchSource, "../browser/local-browser-session.js");
  const currentChromeImports = getImportedNamedBindings(workbenchSource, "../browser/current-chrome-browser-controller.js");
  if (!workbenchImports.has("createLocalBrowserSessionConfig")) {
    findings.push(createFinding({ lawId: LAW_ID, file: WORKBENCH_PATH, line: 1, severity: "fatal", message: "Workbench must keep the simple launch path via createLocalBrowserSessionConfig." }));
  }
  if (!currentChromeImports.has("CurrentChromeBrowserController")) {
    findings.push(createFinding({ lawId: LAW_ID, file: WORKBENCH_PATH, line: 1, severity: "fatal", message: "Workbench must import CurrentChromeBrowserController as the only real-platform browser path." }));
  }
  if (hasIdentifier(workbenchSource, "PlaywrightBrowserController") || hasImportFrom(workbenchSource, "../browser/playwright-browser-controller.js")) {
    findings.push(createFinding({ lawId: LAW_ID, file: WORKBENCH_PATH, line: 1, severity: "fatal", message: "Workbench must not keep the removed Playwright downgrade browser path." }));
  }
  const sessionConfigCall = findCallByIdentifier(workbenchSource, "createLocalBrowserSessionConfig");
  const sessionConfigObject = getObjectLiteralArgument(sessionConfigCall, 0);
  if (!sessionConfigCall || !sessionConfigObject || !objectLiteralReferencesIdentifier(sessionConfigObject, "profileDirectory")) {
    findings.push(createFinding({ lawId: LAW_ID, file: WORKBENCH_PATH, line: 1, severity: "fatal", message: "Workbench must call createLocalBrowserSessionConfig with the governed browser profile directory input." }));
  }
  const controllerConstruction = workbenchSource.getDescendantsOfKind(SyntaxKind.NewExpression).find((expression) => {
    const constructorTarget = expression.getExpression();
    return Node.isIdentifier(constructorTarget) && constructorTarget.getText() === "CurrentChromeBrowserController";
  }) ?? null;
  const controllerOptions = getObjectLiteralArgument(controllerConstruction, 0);
  if (!controllerConstruction || !controllerOptions || getPropertyInitializerText(controllerOptions, "sessionConfig") !== "this.browserSessionConfig") {
    findings.push(createFinding({ lawId: LAW_ID, file: WORKBENCH_PATH, line: 1, severity: "fatal", message: "Workbench must construct CurrentChromeBrowserController with this.browserSessionConfig." }));
  }
  const workbenchClass = workbenchSource.getClass("GrassEyeWorkbench");
  const modeInfoObject = getReturnedObjectLiteral(workbenchClass?.getMethod("getModeInfo") ?? null);
  const modeInfoFields = getObjectLiteralPropertyNames(modeInfoObject);
  for (const requiredField of REQUIRED_MODE_FIELDS) {
    if (!modeInfoFields.has(requiredField)) {
      findings.push(createFinding({ lawId: LAW_ID, file: WORKBENCH_PATH, line: 1, severity: "error", message: `Workbench mode info must expose ${requiredField}.` }));
    }
  }

  const workbenchConstruction = serverSource.getDescendantsOfKind(SyntaxKind.NewExpression).find((expression) => {
    const constructorTarget = expression.getExpression();
    return Node.isIdentifier(constructorTarget) && constructorTarget.getText() === "GrassEyeWorkbench";
  }) ?? null;
  const workbenchOptions = getObjectLiteralArgument(workbenchConstruction, 0);
  if (!hasProcessEnvReference(serverSource, "GRASSEYE_BROWSER_PROFILE_DIRECTORY")) {
    findings.push(createFinding({ lawId: LAW_ID, file: SERVER_PATH, line: 1, severity: "fatal", message: "Server startup must still read GRASSEYE_BROWSER_PROFILE_DIRECTORY before constructing the workbench." }));
  }
  for (const forbiddenEnvKey of FORBIDDEN_ENV_KEYS) {
    if (hasProcessEnvReference(serverSource, forbiddenEnvKey)) {
      findings.push(createFinding({ lawId: LAW_ID, file: SERVER_PATH, line: 1, severity: "fatal", message: `Server must not read ${forbiddenEnvKey}; the removed downgrade path is exclusionary.` }));
    }
  }
  if (!workbenchConstruction || !workbenchOptions) {
    findings.push(createFinding({ lawId: LAW_ID, file: SERVER_PATH, line: 1, severity: "fatal", message: "Server must construct GrassEyeWorkbench with an object literal." }));
  } else {
    if (!objectLiteralReferencesIdentifier(workbenchOptions, "browserProfileDirectory")) {
      findings.push(createFinding({ lawId: LAW_ID, file: SERVER_PATH, line: getNodeLine(workbenchOptions), severity: "error", message: "Server and workbench must thread browserProfileDirectory into the runtime boundary." }));
    }
    if (objectLiteralReferencesIdentifier(workbenchOptions, "browserProfileRef") || objectLiteralReferencesIdentifier(workbenchOptions, "browserUserDataDir")) {
      findings.push(createFinding({ lawId: LAW_ID, file: SERVER_PATH, line: getNodeLine(workbenchOptions), severity: "fatal", message: "Server must not thread the removed dedicated-profile downgrade path into the workbench." }));
    }
  }

  const controllerClass = controllerSource.getClass("CurrentChromeBrowserController");
  const controllerConstructor = controllerClass?.getConstructors()[0] ?? null;
  if (!controllerClass || !controllerConstructor) {
    findings.push(createFinding({ lawId: LAW_ID, file: controllerPath, line: 1, severity: "fatal", message: "CurrentChromeBrowserController must exist as the governed real-platform browser controller." }));
  } else {
    const hasHeadlessGuard = controllerConstructor.getDescendantsOfKind(SyntaxKind.IfStatement).some((statement) => {
      const expression = statement.getExpression();
      if (!Node.isBinaryExpression(expression)) {
        return false;
      }

      const leftPath = getExpressionPath(expression.getLeft());
      return leftPath.length === 2 && leftPath[0] === "options" && leftPath[1] === "headlessRequested" && expression.getRight().getText() === "true";
    });
    if (!hasHeadlessGuard) {
      findings.push(createFinding({ lawId: LAW_ID, file: controllerPath, line: getNodeLine(controllerConstructor), severity: "fatal", message: "CurrentChromeBrowserController must reject headlessRequested === true in its constructor." }));
    }

    for (const requiredMethod of ["open", "click", "screenshotRegion", "close"]) {
      if (!controllerClass.getMethod(requiredMethod)) {
        findings.push(createFinding({ lawId: LAW_ID, file: controllerPath, line: getNodeLine(controllerClass), severity: "error", message: `CurrentChromeBrowserController must implement ${requiredMethod}().` }));
      }
    }

    const openMethod = controllerClass.getMethod("open");
    if (!openMethod || !hasCallByIdentifier(openMethod, "runAppleScript") || !hasCallByIdentifier(openMethod, "buildOpenUrlScript")) {
      findings.push(createFinding({ lawId: LAW_ID, file: controllerPath, line: getNodeLine(controllerClass), severity: "error", message: "CurrentChromeBrowserController.open() must drive the current Google Chrome session through AppleScript." }));
    }

    const clickMethod = controllerClass.getMethod("click");
    if (!clickMethod || !hasCallByIdentifier(clickMethod, "clickAt")) {
      findings.push(createFinding({ lawId: LAW_ID, file: controllerPath, line: getNodeLine(controllerClass), severity: "error", message: "CurrentChromeBrowserController.click() must route clicks through the native clickAt helper." }));
    }

    const screenshotMethod = controllerClass.getMethod("screenshotRegion");
    const usesScreenCapture = screenshotMethod?.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
      const expression = callExpression.getExpression();
      if (!Node.isIdentifier(expression) || expression.getText() !== "runSpawn") {
        return false;
      }
      const firstArgument = callExpression.getArguments()[0];
      return Boolean(firstArgument && Node.isStringLiteral(firstArgument) && firstArgument.getLiteralText() === "screencapture");
    }) ?? false;
    if (!screenshotMethod || !usesScreenCapture) {
      findings.push(createFinding({ lawId: LAW_ID, file: controllerPath, line: getNodeLine(controllerClass), severity: "error", message: "CurrentChromeBrowserController.screenshotRegion() must capture evidence via screencapture." }));
    }

    const clickAtFunction = getFunctionLike(controllerSource, "clickAt");
    if (!clickAtFunction || !hasCallByIdentifier(clickAtFunction, "runJxa") || !hasTemplateLiteralMarker(clickAtFunction, "kCGEventLeftMouseDown")) {
      findings.push(createFinding({ lawId: LAW_ID, file: controllerPath, line: 1, severity: "error", message: "CurrentChromeBrowserController click path must use macOS CGEvent mouse events instead of browser automation." }));
    }

    const activateChromeFunction = getFunctionLike(controllerSource, "activateChrome");
    if (!activateChromeFunction || !hasCallByIdentifier(activateChromeFunction, "runAppleScript")) {
      findings.push(createFinding({ lawId: LAW_ID, file: controllerPath, line: 1, severity: "error", message: "CurrentChromeBrowserController must activate the current Google Chrome session before actions." }));
    }
  }

  debug("validated AST-level helper, startup, workbench, server, and controller boundaries");

  if (repoFiles.includes(REMOVED_CONTROLLER_PATH)) {
    findings.push(createFinding({ lawId: LAW_ID, file: REMOVED_CONTROLLER_PATH, line: 1, severity: "fatal", message: "The removed Playwright downgrade browser controller must remain physically absent from repository truth." }));
  }

  if (!gitignore.includes(".grasseye-local/browser-profiles/")) {
    findings.push(createFinding({ lawId: LAW_ID, file: GITIGNORE_PATH, line: 1, severity: "fatal", message: ".gitignore must exclude .grasseye-local/browser-profiles/." }));
  }

  const forbiddenTests = repoFiles.filter((file) => hasScriptExtension(file) && isForbiddenTestPath(file));
  if (forbiddenTests.length > 0) {
    findings.push(createFinding({ lawId: LAW_ID, file: forbiddenTests[0] ?? "tests", line: 1, severity: "fatal", message: "Local browser session enforcement forbids repository test artifacts." }));
  }

  const committedProfiles = repoFiles.filter((file) => file.startsWith(".grasseye-local/browser-profiles/"));
  if (committedProfiles.length > 0) {
    findings.push(createFinding({ lawId: LAW_ID, file: committedProfiles[0] ?? ".grasseye-local/browser-profiles", line: 1, severity: "fatal", message: "Browser profile directories must not be committed into repository truth." }));
  }

  for (const filePath of repoFiles) {
    if (!hasScriptExtension(filePath) || !GOVERNED_ROOTS.some((root) => filePath.startsWith(root))) {
      continue;
    }

    const sourceFile = project.getSourceFile(pathFromRepoRoot(filePath));
    if (!sourceFile) {
      findings.push(createFinding({ lawId: LAW_ID, file: filePath, line: 1, severity: "error", message: "Governed browser-session code must stay inside the ts-morph audit project; detached files are not enforceable." }));
      continue;
    }

    const forbiddenModuleReference = hasForbiddenModuleReference(sourceFile);
    if (forbiddenModuleReference) {
      findings.push(createFinding({ lawId: LAW_ID, file: filePath, line: forbiddenModuleReference.line, severity: "fatal", message: `Governed browser session code must not reintroduce the removed downgrade browser path: ${forbiddenModuleReference.detail}.` }));
      continue;
    }

    const forbiddenApiUsage = hasForbiddenApiUsage(sourceFile);
    if (forbiddenApiUsage) {
      findings.push(createFinding({ lawId: LAW_ID, file: filePath, line: forbiddenApiUsage.line, severity: "fatal", message: `Governed browser session code must not use forbidden persistence or downgrade APIs: ${forbiddenApiUsage.detail}.` }));
    }
  }

  debug("completed exclusionary AST scan across governed roots");

  return {
    findings,
    phases: [
      createPhase("local-browser-session-law", lawPassed ? "PASS" : "CODE VIOLATION", lawPassed, lawPassed ? "Local browser session law defines persistent-profile and cookie privacy boundaries." : "Local browser session law is missing required boundaries."),
      createPhase("local-browser-session-blueprint", blueprintPassed ? "PASS" : "CODE VIOLATION", blueprintPassed, blueprintPassed ? "Blueprint defines current-Chrome handoff, persistent-profile proof, and anti-regression boundaries for the removed downgrade path." : "Blueprint is missing required startup or anti-regression guidance."),
      createPhase("local-browser-session-type-contract", findings.some((finding) => finding.file === TYPES_PATH || finding.file === RUNTIME_PATH) ? "CODE VIOLATION" : "PASS", !findings.some((finding) => finding.file === TYPES_PATH || finding.file === RUNTIME_PATH), !findings.some((finding) => finding.file === TYPES_PATH || finding.file === RUNTIME_PATH) ? "Browser and runtime types expose governed profile metadata without raw cookie fields." : "Browser or runtime type contracts are incomplete or expose forbidden fields."),
      createPhase("local-browser-session-runtime-boundary", findings.some((finding) => [HELPER_PATH, CONTROLLER_PATH, WORKBENCH_PATH, SERVER_PATH, STARTUP_ENTRY_PATH, STARTUP_OPEN_HELPER_PATH].includes(finding.file)) ? "CODE VIOLATION" : "PASS", !findings.some((finding) => [HELPER_PATH, CONTROLLER_PATH, WORKBENCH_PATH, SERVER_PATH, STARTUP_ENTRY_PATH, STARTUP_OPEN_HELPER_PATH].includes(finding.file)), !findings.some((finding) => [HELPER_PATH, CONTROLLER_PATH, WORKBENCH_PATH, SERVER_PATH, STARTUP_ENTRY_PATH, STARTUP_OPEN_HELPER_PATH].includes(finding.file)) ? "Runtime uses CurrentChromeBrowserController, browserProfileDirectory, and current-browser fixed-page handoff only." : "Runtime browser session wiring is missing a governed current-Chrome or browserProfileDirectory boundary."),
      createPhase("local-browser-session-exclusionary-ast-guard", findings.some((finding) => finding.message.includes("removed downgrade browser path") || finding.message.includes("forbidden persistence or downgrade APIs")) ? "FAKE ENFORCEMENT" : "PASS", !findings.some((finding) => finding.message.includes("removed downgrade browser path") || finding.message.includes("forbidden persistence or downgrade APIs")), !findings.some((finding) => finding.message.includes("removed downgrade browser path") || finding.message.includes("forbidden persistence or downgrade APIs")) ? "Governed browser session code blocks Playwright downgrade paths, cookie persistence APIs, and forbidden env threading through AST-level checks." : "Governed browser session code still allows a removed downgrade path or forbidden persistence API."),
      createPhase("local-browser-session-repo-boundary", forbiddenTests.length === 0 && committedProfiles.length === 0 && !repoFiles.includes(REMOVED_CONTROLLER_PATH) && gitignore.includes(".grasseye-local/browser-profiles/") ? "PASS" : "CODE VIOLATION", forbiddenTests.length === 0 && committedProfiles.length === 0 && !repoFiles.includes(REMOVED_CONTROLLER_PATH) && gitignore.includes(".grasseye-local/browser-profiles/"), forbiddenTests.length === 0 && committedProfiles.length === 0 && !repoFiles.includes(REMOVED_CONTROLLER_PATH) && gitignore.includes(".grasseye-local/browser-profiles/") ? "Repository excludes test artifacts, committed browser profiles, and the removed Playwright browser controller file." : "Repository still allows forbidden browser session artifacts or deleted downgrade code."),
    ],
  };
}