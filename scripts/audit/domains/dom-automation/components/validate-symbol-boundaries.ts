import { Node, SyntaxKind } from "ts-morph";

import { createFinding } from "../../../core/result.js";
import type { Finding } from "../../../core/schema.js";
import {
  findNamedImport,
  getSourceFileAtRepoPath,
  hasIdentifierCall,
  resolveModuleTargetPath,
  buildValidationResult,
  type DomAutomationAuditProject,
  type DomAutomationValidationResult,
} from "./collect-dom-automation-project.js";

const DOM_FACADE_PATH = "src/capabilities/dom-automation/index.ts";
const BROWSER_CONTROLLER_PATH = "src/lib/browser/browser-controller.ts";

const symbolFinding = (
  lawId: string,
  file: string,
  line: number,
  message: string,
  hint: string,
): Finding => createFinding({
  lawId,
  file,
  line,
  severity: "fatal",
  message,
  hint,
});

const hasBrowserEvaluateCall = (repoPath: string, auditProject: DomAutomationAuditProject): Finding[] => {
  const sourceFile = getSourceFileAtRepoPath(auditProject.project, repoPath);
  if (!sourceFile) {
    return [symbolFinding("GRASSEYE-DOM-001-V1", repoPath, 1, "required DOM runtime file is missing for BrowserController evaluation proof", "Restore the DOM runtime file and bind it to BrowserController.evaluateActiveTab." )];
  }
  const found = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isPropertyAccessExpression(expression)
      && expression.getName() === "evaluateActiveTab"
      && expression.getExpression().getText() === "browser";
  });
  return found
    ? []
    : [symbolFinding("GRASSEYE-DOM-001-V1", repoPath, 1, "DOM runtime does not call BrowserController.evaluateActiveTab", "Route governed DOM execution through the BrowserController contract." )];
};

const validatePluginFacadeCalls = (
  auditProject: DomAutomationAuditProject,
): Finding[] => {
  const repoPath = "src/plugins/amazon-invoice-upload/amazon-invoice-upload.flow.ts";
  const sourceFile = getSourceFileAtRepoPath(auditProject.project, repoPath);
  if (!sourceFile) {
    return [symbolFinding("GRASSEYE-DOM-008-V1", repoPath, 1, "Amazon phase-one flow is missing", "Restore the plugin flow and call the DOM facade from it." )];
  }
  const findings: Finding[] = [];
  const requiredCalls = [
    "readDomSnapshotOnce",
    "locateDomElementOnce",
    "fillDomElementOnce",
    "clickDomElementOnce",
    "verifyDomStateOnce",
  ] as const;
  for (const callName of requiredCalls) {
    const importDeclaration = findNamedImport(sourceFile, callName);
    const targetPath = importDeclaration ? resolveModuleTargetPath(importDeclaration) : null;
    if (targetPath !== DOM_FACADE_PATH) {
      findings.push(symbolFinding(
        "GRASSEYE-DOM-008-V1",
        repoPath,
        1,
        `plugin does not import ${callName} from the DOM facade`,
        "Amazon plugin must bind its DOM calls through src/capabilities/dom-automation/index.ts only.",
      ));
    }
    if (!hasIdentifierCall(sourceFile, callName)) {
      findings.push(symbolFinding(
        "GRASSEYE-DOM-008-V1",
        repoPath,
        1,
        `plugin does not call required DOM facade symbol: ${callName}`,
        "Execute the governed DOM facade symbol inside the Amazon plugin flow.",
      ));
    }
  }
  const browserImport = findNamedImport(sourceFile, "BrowserController");
  const browserImportTarget = browserImport ? resolveModuleTargetPath(browserImport) : null;
  if (browserImportTarget !== BROWSER_CONTROLLER_PATH) {
    findings.push(symbolFinding(
      "GRASSEYE-DOM-001-V1",
      repoPath,
      1,
      "plugin does not import BrowserController through the public contract",
      "Type plugin browser dependencies through src/lib/browser/browser-controller.ts.",
    ));
  }
  return findings;
};

const validateBrowserControllerSymbolProof = (
  auditProject: DomAutomationAuditProject,
): Finding[] => {
  const findings: Finding[] = [];
  const browserControllerFile = getSourceFileAtRepoPath(auditProject.project, BROWSER_CONTROLLER_PATH);
  const currentChromeFile = getSourceFileAtRepoPath(auditProject.project, "src/lib/browser/current-chrome-browser-controller.ts");
  const browserControllerInterface = browserControllerFile?.getInterface("BrowserController");
  if (!browserControllerInterface?.getMethod("evaluateActiveTab")) {
    findings.push(symbolFinding(
      "GRASSEYE-DOM-001-V1",
      BROWSER_CONTROLLER_PATH,
      1,
      "BrowserController interface is missing evaluateActiveTab",
      "Expose evaluateActiveTab on the governed BrowserController contract.",
    ));
  }
  const currentChromeClass = currentChromeFile?.getClass("CurrentChromeBrowserController");
  if (!currentChromeClass?.getMethod("evaluateActiveTab")) {
    findings.push(symbolFinding(
      "GRASSEYE-DOM-001-V1",
      "src/lib/browser/current-chrome-browser-controller.ts",
      1,
      "CurrentChromeBrowserController does not implement evaluateActiveTab",
      "Keep DOM execution inside the single browser owner implementation.",
    ));
  }
  for (const sourceFile of auditProject.project.getSourceFiles("src/**/*.ts")) {
    const repoPath = sourceFile.getFilePath().replace(`${auditProject.project.getDirectoryOrThrow(".").getPath()}/`, "");
    if (repoPath === "src/lib/browser/current-chrome-browser-controller.ts") {
      continue;
    }
    for (const classDeclaration of sourceFile.getClasses()) {
      const implementsBrowserController = classDeclaration.getImplements().some((heritage) => heritage.getText().includes("BrowserController"));
      if (implementsBrowserController) {
        findings.push(symbolFinding(
          "GRASSEYE-DOM-001-V1",
          repoPath,
          classDeclaration.getStartLineNumber(),
          "second BrowserController implementation is forbidden",
          "Keep browser ownership in the existing CurrentChromeBrowserController only.",
        ));
      }
    }
  }
  return findings;
};

export const validateSymbolBoundaries = (
  auditProject: DomAutomationAuditProject,
): DomAutomationValidationResult => {
  const findings = [
    ...validatePluginFacadeCalls(auditProject),
    ...validateBrowserControllerSymbolProof(auditProject),
    ...hasBrowserEvaluateCall("src/capabilities/dom-automation/runtime/dom-snapshot.ts", auditProject),
    ...hasBrowserEvaluateCall("src/capabilities/dom-automation/runtime/dom-fill.ts", auditProject),
    ...hasBrowserEvaluateCall("src/capabilities/dom-automation/runtime/dom-click.ts", auditProject),
  ];

  return buildValidationResult({
    name: "symbol-boundaries",
    findings,
    coveredClauseIds: [
      "GRASSEYE-DOM-001-V1",
      "GRASSEYE-DOM-008-V1",
      "BLUEPRINT-02",
      "BLUEPRINT-05",
      "BLUEPRINT-06",
      "BLUEPRINT-12",
    ],
    passSummary: "symbol and contract proofs bind plugin orchestration to the DOM facade and DOM runtime to BrowserController.evaluateActiveTab.",
    failSummary: "symbol-level DOM boundary proof is incomplete.",
  });
};