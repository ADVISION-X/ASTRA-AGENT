import { readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { getAuditProject, getNodeLine, getSourceFileOrThrow } from "../../core/ts-morph.js";

import { localBrowserSessionInspectionConstants as config } from "./inspection-constants.js";
import { localBrowserSessionInspectionUtils as utils } from "./inspection-utils.js";
import { Node, SyntaxKind } from "ts-morph";

const {
  CONTROLLER_PATH,
  HELPER_PATH,
  LAW_ID,
  REQUIRED_MODE_FIELDS,
  SERVER_PATH,
  STARTUP_ENTRY_PATH,
  STARTUP_OPEN_HELPER_PATH,
  WORKBENCH_PATH,
} = config;
const {
  createLooseSourceFile,
  debug,
  findCallByIdentifier,
  getFunctionLike,
  getImportedNamedBindings,
  getObjectLiteralArgument,
  getObjectLiteralPropertyNames,
  getPropertyInitializerText,
  getReturnedObjectLiteral,
  hasCallByIdentifier,
  hasIdentifier,
  hasImportFrom,
  hasProcessEnvReference,
  hasTemplateLiteralMarker,
  objectLiteralReferencesIdentifier,
  resolveControllerPath,
} = utils;

const pushHelperFindings = (findings: Finding[], helperSource: import("ts-morph").SourceFile): void => {
  const helperFactory = getFunctionLike(helperSource, "createLocalBrowserSessionConfig");
  const helperReturn = getReturnedObjectLiteral(helperFactory);
  if (!helperReturn) {
    findings.push(createFinding({ lawId: LAW_ID, file: HELPER_PATH, line: 1, severity: "fatal", message: "Local browser session helper must return a parsed object literal config." }));
    return;
  }

  if (getPropertyInitializerText(helperReturn, "browserMode") !== '"real_chrome_persistent"') {
    findings.push(createFinding({ lawId: LAW_ID, file: HELPER_PATH, line: getNodeLine(helperReturn), severity: "fatal", message: "Local browser session helper must default browserMode to real_chrome_persistent." }));
  }
  if (getPropertyInitializerText(helperReturn, "headlessAllowed") !== "false") {
    findings.push(createFinding({ lawId: LAW_ID, file: HELPER_PATH, line: getNodeLine(helperReturn), severity: "fatal", message: "Local browser session helper must hard-forbid headless real-platform startup." }));
  }

  const profileDirectoryResolver = getFunctionLike(helperSource, "resolveLocalChromeProfileDirectory");
  if (!profileDirectoryResolver || !hasCallByIdentifier(profileDirectoryResolver, "readLastUsedChromeProfileDirectory") || !hasIdentifier(helperSource, "DEFAULT_CHROME_PROFILE_DIRECTORY")) {
    findings.push(createFinding({ lawId: LAW_ID, file: HELPER_PATH, line: 1, severity: "error", message: "Local browser session helper must resolve Chrome profile directory via Local State before falling back to Default." }));
  }
};

const pushStartupEntryFindings = (findings: Finding[], startupEntrySource: import("ts-morph").SourceFile): void => {
  const startupImports = getImportedNamedBindings(startupEntrySource, "./lib/open-commander-console.mjs");
  if (!startupImports.has("openCommanderConsole")) {
    findings.push(createFinding({ lawId: LAW_ID, file: STARTUP_ENTRY_PATH, line: 1, severity: "fatal", message: "Startup entry must import openCommanderConsole from the single-source helper." }));
  }
  if (hasIdentifier(startupEntrySource, "assertExplicitBrowserProfileEnv")) {
    findings.push(createFinding({ lawId: LAW_ID, file: STARTUP_ENTRY_PATH, line: 1, severity: "fatal", message: "Startup launch must not hard gate fixed-page opening behind explicit browser profile env." }));
  }

  const startupOpenCall = startupEntrySource.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === "openCommanderConsole" && callExpression.getArguments()[0]?.getText() === "baseUrl";
  }) ?? null;
  if (!startupOpenCall) {
    findings.push(createFinding({ lawId: LAW_ID, file: STARTUP_ENTRY_PATH, line: 1, severity: "error", message: "Startup entry must hand off the Commander Console through openCommanderConsole(baseUrl)." }));
  }
};

const getDarwinOpenCommandReturnObject = (startupOpenHelperSource: import("ts-morph").SourceFile) => {
  const openCommandFactory = startupOpenHelperSource.getFunction("getOpenCommand");
  const darwinBranch = openCommandFactory?.getDescendantsOfKind(SyntaxKind.IfStatement).find((statement) => statement.getExpression().getText() === 'platform === "darwin"') ?? null;
  const darwinReturn = darwinBranch?.getThenStatement().getDescendantsOfKind(SyntaxKind.ReturnStatement).find((statement) => Node.isObjectLiteralExpression(statement.getExpression())) ?? null;
  const darwinReturnObject = darwinReturn?.getExpression();
  return darwinReturnObject && Node.isObjectLiteralExpression(darwinReturnObject) ? darwinReturnObject : null;
};

const usesOpenAChromeArgs = (darwinReturnObject: import("ts-morph").ObjectLiteralExpression): boolean => {
  const argsProperty = darwinReturnObject.getProperty("args");
  const argsInitializer = argsProperty && Node.isPropertyAssignment(argsProperty) ? argsProperty.getInitializer() : null;
  return Boolean(argsInitializer && Node.isArrayLiteralExpression(argsInitializer) && argsInitializer.getElements().map((element) => element.getText()).join(",") === '"-a",browserAppPath,url');
};

const pushStartupHelperOpenCommandFindings = (findings: Finding[], startupOpenHelperSource: import("ts-morph").SourceFile): void => {
  const darwinReturnObject = getDarwinOpenCommandReturnObject(startupOpenHelperSource);
  if (!darwinReturnObject) {
    findings.push(createFinding({ lawId: LAW_ID, file: STARTUP_OPEN_HELPER_PATH, line: 1, severity: "error", message: "Startup open helper must define a darwin open command object." }));
  } else {
    if (getPropertyInitializerText(darwinReturnObject, "command") !== '"open"' || !usesOpenAChromeArgs(darwinReturnObject)) {
      findings.push(createFinding({ lawId: LAW_ID, file: STARTUP_OPEN_HELPER_PATH, line: getNodeLine(darwinReturnObject), severity: "error", message: "Startup open helper must use open -a <Chrome.app> <url> on darwin." }));
    }
  }
};

const pushStartupHelperChromeAppFindings = (findings: Finding[], startupOpenHelperSource: import("ts-morph").SourceFile): void => {
  const resolvesChromeApp = startupOpenHelperSource.getDescendantsOfKind(SyntaxKind.StringLiteral).some((literal) => literal.getLiteralText() === "/Applications/Google Chrome.app");
  const openMainPageFunction = startupOpenHelperSource.getFunction("openMainPage");
  if (!resolvesChromeApp) {
    findings.push(createFinding({ lawId: LAW_ID, file: STARTUP_OPEN_HELPER_PATH, line: 1, severity: "error", message: "Startup open helper must resolve the standard macOS Google Chrome.app path." }));
  }
  if (!openMainPageFunction || !hasCallByIdentifier(openMainPageFunction, "handoffToCurrentChromeTab")) {
    findings.push(createFinding({ lawId: LAW_ID, file: STARTUP_OPEN_HELPER_PATH, line: 1, severity: "error", message: "Startup open helper must try current-Chrome tab handoff before fallback open command execution." }));
  }
};

const pushStartupHelperFindings = (findings: Finding[], startupOpenHelperSource: import("ts-morph").SourceFile): void => {
  pushStartupHelperOpenCommandFindings(findings, startupOpenHelperSource);
  pushStartupHelperChromeAppFindings(findings, startupOpenHelperSource);
};

const pushStartupFindings = (findings: Finding[], startupEntrySource: import("ts-morph").SourceFile, startupOpenHelperSource: import("ts-morph").SourceFile): void => {
  pushStartupEntryFindings(findings, startupEntrySource);
  pushStartupHelperFindings(findings, startupOpenHelperSource);
};

const pushWorkbenchImportFindings = (findings: Finding[], workbenchSource: import("ts-morph").SourceFile): void => {
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
};

const pushWorkbenchRuntimeWiringFindings = (findings: Finding[], workbenchSource: import("ts-morph").SourceFile): void => {
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
};

const pushWorkbenchModeInfoFindings = (findings: Finding[], workbenchSource: import("ts-morph").SourceFile): void => {
  const modeInfoObject = getReturnedObjectLiteral(workbenchSource.getClass("GrassEyeWorkbench")?.getMethod("getModeInfo") ?? null);
  const modeInfoFields = getObjectLiteralPropertyNames(modeInfoObject);
  for (const requiredField of REQUIRED_MODE_FIELDS) {
    if (!modeInfoFields.has(requiredField)) {
      findings.push(createFinding({ lawId: LAW_ID, file: WORKBENCH_PATH, line: 1, severity: "error", message: `Workbench mode info must expose ${requiredField}.` }));
    }
  }
};

const pushWorkbenchFindings = (findings: Finding[], workbenchSource: import("ts-morph").SourceFile): void => {
  pushWorkbenchImportFindings(findings, workbenchSource);
  pushWorkbenchRuntimeWiringFindings(findings, workbenchSource);
  pushWorkbenchModeInfoFindings(findings, workbenchSource);
};

const pushServerFindings = (findings: Finding[], serverSource: import("ts-morph").SourceFile): void => {
  const workbenchConstruction = serverSource.getDescendantsOfKind(SyntaxKind.NewExpression).find((expression) => {
    const constructorTarget = expression.getExpression();
    return Node.isIdentifier(constructorTarget) && constructorTarget.getText() === "GrassEyeWorkbench";
  }) ?? null;
  const workbenchOptions = getObjectLiteralArgument(workbenchConstruction, 0);
  if (!hasProcessEnvReference(serverSource, "GRASSEYE_BROWSER_PROFILE_DIRECTORY")) {
    findings.push(createFinding({ lawId: LAW_ID, file: SERVER_PATH, line: 1, severity: "fatal", message: "Server startup must still read GRASSEYE_BROWSER_PROFILE_DIRECTORY before constructing the workbench." }));
  }
  if (!workbenchConstruction || !workbenchOptions) {
    findings.push(createFinding({ lawId: LAW_ID, file: SERVER_PATH, line: 1, severity: "fatal", message: "Server must construct GrassEyeWorkbench with an object literal." }));
    return;
  }

  if (!objectLiteralReferencesIdentifier(workbenchOptions, "browserProfileDirectory")) {
    findings.push(createFinding({ lawId: LAW_ID, file: SERVER_PATH, line: getNodeLine(workbenchOptions), severity: "error", message: "Server and workbench must thread browserProfileDirectory into the runtime boundary." }));
  }
  if (objectLiteralReferencesIdentifier(workbenchOptions, "browserProfileRef") || objectLiteralReferencesIdentifier(workbenchOptions, "browserUserDataDir")) {
    findings.push(createFinding({ lawId: LAW_ID, file: SERVER_PATH, line: getNodeLine(workbenchOptions), severity: "fatal", message: "Server must not thread the removed dedicated-profile downgrade path into the workbench." }));
  }
};

const pushWorkbenchAndServerFindings = (findings: Finding[], workbenchSource: import("ts-morph").SourceFile, serverSource: import("ts-morph").SourceFile): void => {
  pushWorkbenchFindings(findings, workbenchSource);
  pushServerFindings(findings, serverSource);
};

const pushControllerContractFindings = (
  findings: Finding[],
  controllerClass: import("ts-morph").ClassDeclaration,
  controllerConstructor: import("ts-morph").ConstructorDeclaration,
  controllerPath: string,
): void => {
  const hasHeadlessGuard = controllerConstructor.getDescendantsOfKind(SyntaxKind.IfStatement).some((statement) => {
    const expression = statement.getExpression();
    if (!Node.isBinaryExpression(expression)) {
      return false;
    }

    const leftText = expression.getLeft().getText();
    return leftText === "options.headlessRequested" && expression.getRight().getText() === "true";
  });
  if (!hasHeadlessGuard) {
    findings.push(createFinding({ lawId: LAW_ID, file: controllerPath, line: getNodeLine(controllerConstructor), severity: "fatal", message: "CurrentChromeBrowserController must reject headlessRequested === true in its constructor." }));
  }

  for (const requiredMethod of ["open", "click", "screenshotRegion", "close"]) {
    if (!controllerClass.getMethod(requiredMethod)) {
      findings.push(createFinding({ lawId: LAW_ID, file: controllerPath, line: getNodeLine(controllerClass), severity: "error", message: `CurrentChromeBrowserController must implement ${requiredMethod}().` }));
    }
  }
};

const pushControllerMethodFindings = (findings: Finding[], controllerClass: import("ts-morph").ClassDeclaration, controllerPath: string): void => {
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
    const firstArgument = callExpression.getArguments()[0];
    return Node.isIdentifier(expression) && expression.getText() === "runSpawn" && Boolean(firstArgument && Node.isStringLiteral(firstArgument) && firstArgument.getLiteralText() === "screencapture");
  }) ?? false;
  if (!screenshotMethod || !usesScreenCapture) {
    findings.push(createFinding({ lawId: LAW_ID, file: controllerPath, line: getNodeLine(controllerClass), severity: "error", message: "CurrentChromeBrowserController.screenshotRegion() must capture evidence via screencapture." }));
  }
};

const pushControllerNativeActionFindings = (findings: Finding[], controllerSource: import("ts-morph").SourceFile, controllerPath: string): void => {
  const clickAtFunction = getFunctionLike(controllerSource, "clickAt");
  if (!clickAtFunction || !hasCallByIdentifier(clickAtFunction, "runJxa") || !hasTemplateLiteralMarker(clickAtFunction, "kCGEventLeftMouseDown")) {
    findings.push(createFinding({ lawId: LAW_ID, file: controllerPath, line: 1, severity: "error", message: "CurrentChromeBrowserController click path must use macOS CGEvent mouse events instead of browser automation." }));
  }
  const activateChromeFunction = getFunctionLike(controllerSource, "activateChrome");
  if (!activateChromeFunction || !hasCallByIdentifier(activateChromeFunction, "runAppleScript")) {
    findings.push(createFinding({ lawId: LAW_ID, file: controllerPath, line: 1, severity: "error", message: "CurrentChromeBrowserController must activate the current Google Chrome session before actions." }));
  }
};

const pushControllerFindings = (findings: Finding[], controllerSource: import("ts-morph").SourceFile): void => {
  const controllerClass = controllerSource.getClass("CurrentChromeBrowserController");
  const controllerConstructor = controllerClass?.getConstructors()[0] ?? null;
  const controllerPath = resolveControllerPath(controllerSource);
  if (!controllerClass || !controllerConstructor) {
    findings.push(createFinding({ lawId: LAW_ID, file: controllerPath, line: 1, severity: "fatal", message: "CurrentChromeBrowserController must exist as the governed real-platform browser controller." }));
    return;
  }
  pushControllerContractFindings(findings, controllerClass, controllerConstructor, controllerPath);
  pushControllerMethodFindings(findings, controllerClass, controllerPath);
  pushControllerNativeActionFindings(findings, controllerSource, controllerPath);
};

export async function runLocalBrowserSessionRuntimeChecks(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const [startupEntryText, startupOpenHelperText] = await Promise.all([
    readTextFile(pathFromRepoRoot(STARTUP_ENTRY_PATH)),
    readTextFile(pathFromRepoRoot(STARTUP_OPEN_HELPER_PATH)),
  ]);
  const findings: Finding[] = [];
  const project = getAuditProject();
  const helperSource = getSourceFileOrThrow(project, HELPER_PATH);
  const controllerSource = getSourceFileOrThrow(project, CONTROLLER_PATH);
  const workbenchSource = getSourceFileOrThrow(project, WORKBENCH_PATH);
  const serverSource = getSourceFileOrThrow(project, SERVER_PATH);
  const startupEntrySource = createLooseSourceFile(STARTUP_ENTRY_PATH, startupEntryText);
  const startupOpenHelperSource = createLooseSourceFile(STARTUP_OPEN_HELPER_PATH, startupOpenHelperText);

  debug("loaded runtime surfaces for local-browser-session checks");
  pushHelperFindings(findings, helperSource);
  pushStartupFindings(findings, startupEntrySource, startupOpenHelperSource);
  pushWorkbenchAndServerFindings(findings, workbenchSource, serverSource);
  pushControllerFindings(findings, controllerSource);
  debug("validated local-browser-session helper, startup, workbench, server, and controller boundaries");

  const runtimeBoundaryPassed = !findings.some((finding) => [HELPER_PATH, CONTROLLER_PATH, WORKBENCH_PATH, SERVER_PATH, STARTUP_ENTRY_PATH, STARTUP_OPEN_HELPER_PATH].includes(finding.file));
  return {
    findings,
    phases: [
      createPhase("local-browser-session-runtime-boundary", runtimeBoundaryPassed ? "PASS" : "CODE VIOLATION", runtimeBoundaryPassed, runtimeBoundaryPassed ? "Runtime uses CurrentChromeBrowserController, browserProfileDirectory, and current-browser fixed-page handoff only." : "Runtime browser session wiring is missing a governed current-Chrome or browserProfileDirectory boundary."),
    ],
  };
}
