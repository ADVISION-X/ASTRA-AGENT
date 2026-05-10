import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { getNodeLine } from "../../core/ts-morph.js";
import { hasLiteralTextFragment } from "../_shared/ast-literal-queries.js";

import { localBrowserSessionInspectionConstants as config } from "./inspection-constants.js";
import { localBrowserSessionInspectionUtils as utils } from "./inspection-utils.js";
import { Node, SyntaxKind } from "ts-morph";

const {
  CONTROLLER_PRIMITIVES_PATH,
  LAW_ID,
} = config;

const {
  getFunctionLike,
  hasCallByIdentifier,
  resolveControllerPath,
} = utils;

const usesInlineScreenCapture = (screenshotMethod: import("ts-morph").MethodDeclaration | undefined): boolean => {
  return screenshotMethod?.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    const firstArgument = callExpression.getArguments()[0];
    return Node.isIdentifier(expression) && expression.getText() === "runSpawn" && Boolean(firstArgument && Node.isStringLiteral(firstArgument) && firstArgument.getLiteralText() === "screencapture");
  }) ?? false;
};

const usesDelegatedScreenCapture = (
  screenshotMethod: import("ts-morph").MethodDeclaration | undefined,
  screenshotHelperSource: import("ts-morph").SourceFile,
): boolean => {
  const screenshotHelper = getFunctionLike(screenshotHelperSource, "captureCurrentChromeScreenshot");
  return Boolean(
    screenshotMethod
    && hasCallByIdentifier(screenshotMethod, "captureCurrentChromeScreenshot")
    && screenshotHelper
    && screenshotHelperSource.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
      const expression = callExpression.getExpression();
      const firstArgument = callExpression.getArguments()[0];
      return Node.isIdentifier(expression) && expression.getText() === "runSpawn" && Boolean(firstArgument && Node.isStringLiteral(firstArgument) && firstArgument.getLiteralText() === "screencapture");
    })
    && hasLiteralTextFragment(screenshotHelperSource, "screencapture"),
  );
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

const pushControllerOpenMethodFinding = (
  findings: Finding[],
  controllerClass: import("ts-morph").ClassDeclaration,
  controllerPath: string,
): void => {
  const openMethod = controllerClass.getMethod("open");
  if (!openMethod || !hasCallByIdentifier(openMethod, "runAppleScript") || !hasCallByIdentifier(openMethod, "buildOpenUrlScript")) {
    findings.push(createFinding({ lawId: LAW_ID, file: controllerPath, line: getNodeLine(controllerClass), severity: "error", message: "CurrentChromeBrowserController.open() must drive the current Google Chrome session through AppleScript." }));
  }
};

const pushControllerClickMethodFinding = (
  findings: Finding[],
  controllerClass: import("ts-morph").ClassDeclaration,
  controllerPath: string,
): void => {
  const clickMethod = controllerClass.getMethod("click");
  if (!clickMethod || !hasCallByIdentifier(clickMethod, "clickAt")) {
    findings.push(createFinding({ lawId: LAW_ID, file: controllerPath, line: getNodeLine(controllerClass), severity: "error", message: "CurrentChromeBrowserController.click() must route clicks through the native clickAt helper." }));
  }
};

const pushControllerScreenshotMethodFinding = (
  findings: Finding[],
  controllerClass: import("ts-morph").ClassDeclaration,
  controllerPath: string,
  screenshotHelperSource: import("ts-morph").SourceFile,
): void => {
  const screenshotMethod = controllerClass.getMethod("screenshotRegion");
  if (!screenshotMethod || (!usesInlineScreenCapture(screenshotMethod) && !usesDelegatedScreenCapture(screenshotMethod, screenshotHelperSource))) {
    findings.push(createFinding({ lawId: LAW_ID, file: controllerPath, line: getNodeLine(controllerClass), severity: "error", message: "CurrentChromeBrowserController.screenshotRegion() must capture evidence via screencapture." }));
  }
};

const pushControllerMethodFindings = (
  findings: Finding[],
  controllerClass: import("ts-morph").ClassDeclaration,
  controllerPath: string,
  screenshotHelperSource: import("ts-morph").SourceFile,
): void => {
  pushControllerOpenMethodFinding(findings, controllerClass, controllerPath);
  pushControllerClickMethodFinding(findings, controllerClass, controllerPath);
  pushControllerScreenshotMethodFinding(findings, controllerClass, controllerPath, screenshotHelperSource);
};

const pushControllerNativeActionFindings = (findings: Finding[], primitivesSource: import("ts-morph").SourceFile): void => {
  const clickAtFunction = getFunctionLike(primitivesSource, "clickAt");
  if (!clickAtFunction || !hasCallByIdentifier(clickAtFunction, "runJxa") || !hasLiteralTextFragment(primitivesSource, "kCGEventLeftMouseDown")) {
    findings.push(createFinding({ lawId: LAW_ID, file: CONTROLLER_PRIMITIVES_PATH, line: 1, severity: "error", message: "CurrentChromeBrowserController click path must use macOS CGEvent mouse events instead of browser automation." }));
  }

  const activateChromeFunction = getFunctionLike(primitivesSource, "activateChrome");
  if (!activateChromeFunction || !hasCallByIdentifier(activateChromeFunction, "runAppleScript")) {
    findings.push(createFinding({ lawId: LAW_ID, file: CONTROLLER_PRIMITIVES_PATH, line: 1, severity: "error", message: "CurrentChromeBrowserController must activate the current Google Chrome session before actions." }));
  }
};

export const pushControllerFindings = (input: {
  findings: Finding[];
  controllerSource: import("ts-morph").SourceFile;
  primitivesSource: import("ts-morph").SourceFile;
  screenshotHelperSource: import("ts-morph").SourceFile;
}): void => {
  const controllerClass = input.controllerSource.getClass("CurrentChromeBrowserController");
  const controllerConstructor = controllerClass?.getConstructors()[0] ?? null;
  const controllerPath = resolveControllerPath(input.controllerSource);
  if (!controllerClass || !controllerConstructor) {
    input.findings.push(createFinding({ lawId: LAW_ID, file: controllerPath, line: 1, severity: "fatal", message: "CurrentChromeBrowserController must exist as the governed real-platform browser controller." }));
    return;
  }

  pushControllerContractFindings(input.findings, controllerClass, controllerConstructor, controllerPath);
  pushControllerMethodFindings(input.findings, controllerClass, controllerPath, input.screenshotHelperSource);
  pushControllerNativeActionFindings(input.findings, input.primitivesSource);
};