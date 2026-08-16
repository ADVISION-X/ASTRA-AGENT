import {
  Node,
  SyntaxKind,
  type CallExpression,
  type ObjectLiteralExpression,
  type SourceFile,
  type Symbol as MorphSymbol,
} from "ts-morph";

import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { toRepoPath } from "../../shared/paths.js";
import { RuntimeLogSpineLaw, type RuntimeLogSpineFinding } from "./constants.js";
import { isAuthorizedRuntimeLogHelperPath } from "./runtime-log-scope.js";

const browserActionMethods: ReadonlySet<string> = new Set([
  "open",
  "scroll",
  "click",
  "move",
  "clickLocatedDomElement",
  "textInput",
  "evaluate",
  "setFileInputFiles",
  "screenshotRegion",
  "closeTarget",
  "close",
]);

const terminalBrowserEvents = new Set(["BROWSER_ACTION_COMPLETED", "BROWSER_ACTION_FAILED", "BROWSER_ACTION_RESULT"]);
const centralLogHelperPath = "src/lib/browser/current-chrome-browser-action-logging.ts";
const currentChromeControllerPath = "src/lib/browser/current-chrome-browser-controller.ts";
const currentChromeRuntimePath = "src/lib/browser/current-chrome-browser-controller-runtime.ts";
const exactBrowserRuntimePath = "src/lib/browser/exact-target/browser-command-runtime.ts";
const workbenchBrowserSupportPath = "src/lib/local-runtime/workbench-browser-support.ts";
const workbenchAssemblyPath = "src/lib/local-runtime/workbench-assembly.ts";
const browserControllerPath = "src/lib/browser/browser-controller.ts";

export const collectBrowserActionLogContractFindings = (context: InspectorContext): {
  findings: RuntimeLogSpineFinding[];
  inspectedFiles: string[];
} => {
  const findings: RuntimeLogSpineFinding[] = [];
  const actionFiles = context.project.getSourceFiles()
    .filter((file) => toRepoPath(file.getFilePath()).startsWith("src/"))
    .map((file) => ({ file, calls: browserControllerActionCalls(file) }))
    .filter((entry) => entry.calls.length > 0);
  const centralMissing = missingCentralBrowserLogContract(context);
  if (actionFiles.some(({ calls }) => calls.some((call) => !hasCallerBrowserActionId(call))) && centralMissing.length > 0) {
    findings.push({
      checkId: "runtime-log-spine/browser-action-log-contract",
      lawId: RuntimeLogSpineLaw.BROWSER_ACTION_CONTRACT,
      file: centralLogHelperPath,
      line: 1,
      severity: "fatal",
      message: "BrowserController actions without caller correlation lack central production logging",
      hint: `The Current Chrome driver must centrally emit and persist one started/terminal pair for every uncorrelated browser or DOM action. Missing: ${centralMissing.join(", ")}.`,
    });
  }

  for (const { file, calls } of actionFiles) {
    if (toRepoPath(file.getFilePath()) === currentChromeControllerPath) continue;
    const governedCalls = calls.filter(hasCallerBrowserActionId);
    if (governedCalls.length === 0) continue;
    const missing = missingGovernedBrowserLogContract(file, governedCalls);
    if (missing.length === 0) continue;
    findings.push({
      checkId: "runtime-log-spine/browser-action-log-contract",
      lawId: RuntimeLogSpineLaw.BROWSER_ACTION_CONTRACT,
      file: toRepoPath(file.getFilePath()),
      line: governedCalls[0]?.getStartLineNumber() ?? 1,
      severity: "fatal",
      message: "governed browser action lacks a truthful started/terminal log contract",
      hint: `Caller-correlated browser actions require beforeHash, terminal afterHash, actionResult, durationMs, failureClass and fallbackUsed. Missing: ${missing.join(", ")}.`,
    });
  }

  return {
    findings,
    inspectedFiles: [...new Set([
      ...actionFiles.map(({ file }) => toRepoPath(file.getFilePath())),
      centralLogHelperPath,
      currentChromeControllerPath,
      currentChromeRuntimePath,
      exactBrowserRuntimePath,
      workbenchBrowserSupportPath,
      workbenchAssemblyPath,
    ])].sort(),
  };
};

function missingCentralBrowserLogContract(context: InspectorContext): string[] {
  const source = (repoPath: string) => context.project.getSourceFiles().find((file) => toRepoPath(file.getFilePath()) === repoPath);
  const helper = source(centralLogHelperPath);
  const controller = source(currentChromeControllerPath);
  const controllerRuntime = source(currentChromeRuntimePath);
  const exactRuntime = source(exactBrowserRuntimePath);
  const browserSupport = source(workbenchBrowserSupportPath);
  const assembly = source(workbenchAssemblyPath);
  const missing: string[] = [];
  if (!helper) return ["central-helper-file"];
  for (const functionName of ["runLoggedBrowserValueAction"]) {
    if (!helper.getFunction(functionName)) missing.push(`central-helper:${functionName}`);
  }
  const eventTypes = new Set(runtimeEventTypeAccesses(helper).map((access) => access.getName()));
  for (const eventType of ["BROWSER_ACTION_STARTED", "BROWSER_ACTION_COMPLETED", "BROWSER_ACTION_FAILED"]) {
    if (!eventTypes.has(eventType)) missing.push(`central-event:${eventType}`);
  }
  const propertyNames = new Set(helper.getDescendantsOfKind(SyntaxKind.PropertyAssignment).map((property) => property.getName()));
  for (const property of ["capabilityCallId", "beforeHash", "afterHash", "durationMs", "actionResult", "failureClass", "fallbackUsed"]) {
    if (!propertyNames.has(property)) missing.push(`central-field:${property}`);
  }
  inspectExactRuntimeLogging(controller, controllerRuntime, exactRuntime, missing);
  const browserConstructor = browserSupport?.getDescendantsOfKind(SyntaxKind.NewExpression).find((expression) =>
    symbolHasDeclarationAt(expression.getExpression().getSymbol(), currentChromeControllerPath));
  if (!browserConstructor?.getArguments().some(isRuntimeLoggerReference)) {
    missing.push("workbench-browser:runtime-logger-injection");
  }
  const assemblyCall = assembly?.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) =>
    symbolHasDeclarationAt(call.getExpression().getSymbol(), workbenchBrowserSupportPath));
  if (!assemblyCall?.getArguments().some(isRuntimeLoggerReference)) {
    missing.push("workbench-assembly:runtime-logger-wiring");
  }
  return missing;
}

function browserControllerActionCalls(file: SourceFile): CallExpression[] {
  return file.getDescendantsOfKind(SyntaxKind.CallExpression).filter((call) => {
    const expression = call.getExpression();
    if (!Node.isPropertyAccessExpression(expression) || !browserActionMethods.has(expression.getName())) return false;
    return symbolHasDeclarationAt(expression.getSymbol(), browserControllerPath);
  });
}

function hasCallerBrowserActionId(call: CallExpression): boolean {
  const argument = call.getArguments()[0];
  return Node.isObjectLiteralExpression(argument)
    && argument.getProperties().some((property) =>
      (Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property))
      && property.getName() === "browserActionId");
}

function runtimeEmitObjects(file: SourceFile): ObjectLiteralExpression[] {
  return file.getDescendantsOfKind(SyntaxKind.CallExpression).flatMap((call) => {
    const expression = call.getExpression();
    if (!Node.isPropertyAccessExpression(expression) || expression.getName() !== "emit") return [];
    const argument = call.getArguments()[0];
    if (Node.isObjectLiteralExpression(argument)) return [argument];
    if (!Node.isCallExpression(argument)) return [];
    const createsRuntimeEvent = symbolDeclarations(argument.getExpression().getSymbol()).some((declaration) =>
      declaration.getSymbol()?.getName() === "createRuntimeEvent"
      && toRepoPath(declaration.getSourceFile().getFilePath()) === "src/lib/runtime-logs/event-factory.ts");
    const eventInput = argument.getArguments()[0];
    return createsRuntimeEvent && Node.isObjectLiteralExpression(eventInput) ? [eventInput] : [];
  });
}

function missingGovernedBrowserLogContract(file: SourceFile, governedCalls: CallExpression[]): string[] {
  if (governedCalls.length !== 1) return ["one-to-one caller-correlated action/log binding"];
  const governedCall = governedCalls[0];
  if (!governedCall) return ["caller-correlated action"];
  const actionIdExpression = browserActionIdExpression(governedCall);
  const actionFunction = governedCall.getFirstAncestor(Node.isFunctionLikeDeclaration);
  if (!actionIdExpression || !actionFunction) return ["caller browserActionId expression"];
  const authorizedCalls = file.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => call.getFirstAncestor(Node.isFunctionLikeDeclaration) === actionFunction)
    .filter((call) => calledAuthorizedHelperUsesBrowserActionId(call, actionIdExpression));
  const helperEmitObjects = authorizedCalls.flatMap((call) =>
    symbolDeclarations(call.getExpression().getSymbol()).flatMap((declaration) =>
      runtimeEmitObjects(declaration.getSourceFile())));
  if (helperEmitObjects.length === 0) return ["authorized browserActionId-bound runtimeLogger.emit"];
  const browserEvents = helperEmitObjects.map((object) => ({ object, eventType: eventTypeName(object) }))
    .filter((entry) => entry.eventType?.startsWith("BROWSER_ACTION_"));
  const started = browserEvents.filter((entry) => entry.eventType === "BROWSER_ACTION_STARTED");
  const terminal = browserEvents.filter((entry) => entry.eventType && terminalBrowserEvents.has(entry.eventType));
  const missing: string[] = [];
  if (started.length === 0) missing.push("BROWSER_ACTION_STARTED");
  if (terminal.length === 0) missing.push("BROWSER_ACTION terminal");
  if (![...started, ...terminal].some(({ object }) => hasNestedProperty(object, "beforeHash"))) missing.push("beforeHash");
  if (!terminal.some(({ object }) => hasNestedProperty(object, "afterHash"))) missing.push("afterHash");
  for (const property of ["capabilityCallId", "durationMs", "actionResult", "failureClass", "fallbackUsed"]) {
    if (!terminal.some(({ object }) => hasNestedProperty(object, property))) missing.push(property);
  }
  return missing;
}

function inspectExactRuntimeLogging(
  controller: SourceFile | undefined,
  controllerRuntime: SourceFile | undefined,
  exactRuntime: SourceFile | undefined,
  missing: string[],
): void {
  const controllerDeclaration = controller?.getClass("CurrentChromeBrowserController");
  if (!controllerDeclaration) missing.push("controller-class:CurrentChromeBrowserController");
  const controllerConstructor = controllerDeclaration?.getConstructors()[0];
  const controllerFactoryCall = controllerConstructor?.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) =>
    symbolHasDeclarationAt(call.getExpression().getSymbol(), currentChromeRuntimePath));
  if (!controllerFactoryCall?.getArguments().some(isRuntimeLoggerReference)) {
    missing.push("controller:runtime-logger-forwarding");
  }

  const commandRuntimeConstructor = controllerRuntime?.getDescendantsOfKind(SyntaxKind.NewExpression).find((expression) =>
    symbolHasDeclarationAt(expression.getExpression().getSymbol(), exactBrowserRuntimePath));
  if (!commandRuntimeConstructor?.getArguments().some(isRuntimeLoggerReference)) {
    missing.push("controller-runtime:runtime-logger-forwarding");
  }

  const runtimeDeclaration = exactRuntime?.getClass("BrowserCommandRuntime");
  if (!runtimeDeclaration) {
    missing.push("exact-runtime-class:BrowserCommandRuntime");
    return;
  }
  const loggedMethod = runtimeDeclaration.getMethod("logged");
  const delegatesToCentralHelper = loggedMethod?.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) =>
    symbolDeclarations(call.getExpression().getSymbol()).some((declaration) =>
      toRepoPath(declaration.getSourceFile().getFilePath()) === centralLogHelperPath
      && declaration.getSymbol()?.getName() === "runLoggedBrowserValueAction"));
  if (!delegatesToCentralHelper) missing.push("exact-runtime:central-log-helper-delegate");

  const targetSession = exactRuntime?.getClass("ExactBrowserTargetSession");
  const transportCalls = targetSession?.getDescendantsOfKind(SyntaxKind.CallExpression).filter(isTransportCommandCall) ?? [];
  if (transportCalls.length === 0) missing.push("exact-target-session:transport-command");
  for (const call of transportCalls) {
    const method = call.getFirstAncestor(Node.isMethodDeclaration);
    if (method?.getName() === "loggedTransportCommand") continue;
    const enclosingLoggedCall = call.getAncestors().find(isLoggedCall);
    if (!enclosingLoggedCall) {
      missing.push(`exact-target-session:unlogged-transport-command:${call.getStartLineNumber()}`);
    }
  }
}

function isLoggedCall(node: Node): boolean {
  if (!Node.isCallExpression(node)) return false;
  const expression = node.getExpression();
  return Node.isPropertyAccessExpression(expression) && expression.getName() === "logged";
}

function isTransportCommandCall(call: CallExpression): boolean {
  const expression = call.getExpression();
  if (!Node.isPropertyAccessExpression(expression) || expression.getName() !== "command") return false;
  const receiver = expression.getExpression();
  return Node.isPropertyAccessExpression(receiver) && receiver.getName() === "transport";
}

function calledAuthorizedHelperUsesBrowserActionId(call: CallExpression, expectedExpression: Node): boolean {
  const declarations = symbolDeclarations(call.getExpression().getSymbol());
  if (!declarations.some((declaration) => isAuthorizedRuntimeLogHelperPath(toRepoPath(declaration.getSourceFile().getFilePath())))) {
    return false;
  }
  const argument = call.getArguments()[0];
  if (!Node.isObjectLiteralExpression(argument)) return false;
  const property = argument.getProperties().find((item) => {
    if (!Node.isPropertyAssignment(item) && !Node.isShorthandPropertyAssignment(item)) return false;
    return item.getName() === "browserActionId";
  });
  if (!property) return false;
  const value = Node.isPropertyAssignment(property)
    ? property.getInitializer()
    : Node.isShorthandPropertyAssignment(property)
      ? property.getNameNode()
      : undefined;
  return Boolean(value && sameBinding(value, expectedExpression));
}

function browserActionIdExpression(call: CallExpression): Node | undefined {
  const argument = call.getArguments()[0];
  if (!Node.isObjectLiteralExpression(argument)) return undefined;
  const property = argument.getProperties().find((item) =>
    (Node.isPropertyAssignment(item) || Node.isShorthandPropertyAssignment(item))
    && item.getName() === "browserActionId");
  if (Node.isPropertyAssignment(property)) return property.getInitializer();
  return Node.isShorthandPropertyAssignment(property) ? property.getNameNode() : undefined;
}

function sameBinding(left: Node, right: Node): boolean {
  if (Node.isPropertyAccessExpression(left) && Node.isPropertyAccessExpression(right)) {
    return left.getName() === right.getName() && sameBinding(left.getExpression(), right.getExpression());
  }
  if (Node.isIdentifier(left) && Node.isIdentifier(right)) {
    const leftDeclarations = symbolDeclarations(left.getSymbol());
    const rightDeclarations = new Set(symbolDeclarations(right.getSymbol()));
    return leftDeclarations.length > 0 && leftDeclarations.some((declaration) => rightDeclarations.has(declaration));
  }
  return left.getSourceFile() === right.getSourceFile() && left.getStart() === right.getStart();
}

function runtimeEventTypeAccesses(file: SourceFile) {
  return file.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).filter((access) =>
    symbolDeclarations(access.getSymbol()).some((declaration) =>
      toRepoPath(declaration.getSourceFile().getFilePath()).startsWith("src/lib/runtime-logs/")));
}

function symbolDeclarations(symbol: MorphSymbol | undefined) {
  if (!symbol) return [];
  return (symbol.getAliasedSymbol() ?? symbol).getDeclarations();
}

function symbolHasDeclarationAt(symbol: MorphSymbol | undefined, repoPath: string): boolean {
  return symbolDeclarations(symbol).some((declaration) => toRepoPath(declaration.getSourceFile().getFilePath()) === repoPath);
}

function isRuntimeLoggerReference(node: Node): boolean {
  if (!Node.isIdentifier(node)) return false;
  return symbolDeclarations(node.getSymbol()).some((declaration) =>
    (Node.isParameterDeclaration(declaration) || Node.isVariableDeclaration(declaration))
    && declaration.getName() === "runtimeLogger");
}

function eventTypeName(object: ObjectLiteralExpression): string | null {
  const property = object.getProperties().find((item) =>
    Node.isPropertyAssignment(item) && item.getName() === "eventType");
  if (!property || !Node.isPropertyAssignment(property)) return null;
  const initializer = property.getInitializer();
  if (Node.isPropertyAccessExpression(initializer)) return initializer.getName();
  if (Node.isStringLiteral(initializer)) return initializer.getLiteralText();
  return null;
}

function hasNestedProperty(object: ObjectLiteralExpression, name: string): boolean {
  return object.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) => property.getName() === name)
    || object.getProperties().some((property) => Node.isPropertyAssignment(property) && property.getName() === name);
}
