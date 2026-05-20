import { Node, SyntaxKind } from "ts-morph";

import { createFinding } from "../../../core/result.js";
import type { Finding } from "../../../core/schema.js";
import { getSourceFileAtRepoPath } from "./collect-dom-automation-project.js";
import { findNamedImport, resolveModuleTargetPath } from "./dom-automation-module-resolution.js";
import type { DomAutomationAuditProject, DomAutomationValidationResult } from "./dom-automation-project-types.js";
import { hasIdentifierCall } from "./dom-automation-static-strings.js";
import { buildValidationResult } from "./dom-automation-validation-result.js";
import { hasStaticText } from "./runtime-contract-support.js";

const DOM_FACADE_PATH = "src/capabilities/dom-automation/index.ts";
const BROWSER_CONTROLLER_PATH = "src/lib/browser/browser-controller.ts";

const symbolFinding = (...input: readonly [
  lawId: string,
  file: string,
  line: number,
  message: string,
  hint: string,
]): Finding => {
  const [lawId, file, line, message, hint] = input;
  return createFinding({ lawId, file, line, severity: "fatal", message, hint });
};

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

const REQUIRED_DOM_FACADE_CALLS = [
  "readDomSnapshotOnce",
  "locateDomElementOnce",
  "fillDomElementOnce",
  "clickDomElementOnce",
  "verifyDomStateOnce",
  "uploadApprovedFileOnce",
  "waitForDomStateOnce",
] as const;

const validateRequiredFacadeCall = (
  auditProject: DomAutomationAuditProject,
  callName: (typeof REQUIRED_DOM_FACADE_CALLS)[number],
): Finding[] => {
  const repoPath = "src/plugins/amazon-invoice-upload/amazon-invoice-upload.flow.ts";
  const pluginFiles = auditProject.sourceFiles.plugin;
  const targetPath = pluginFiles.map((pluginFile) => findNamedImport(pluginFile, callName)).find((item) => item !== null);
  const findings: Finding[] = [];
  if ((targetPath ? resolveModuleTargetPath(targetPath) : null) !== DOM_FACADE_PATH) {
    findings.push(symbolFinding("GRASSEYE-DOM-008-V1", repoPath, 1, `plugin does not import ${callName} from the DOM facade`, "Amazon plugin must bind its DOM calls through src/capabilities/dom-automation/index.ts only."));
  }
  if (!pluginFiles.some((pluginFile) => hasIdentifierCall(pluginFile, callName))) {
    findings.push(symbolFinding("GRASSEYE-DOM-008-V1", repoPath, 1, `plugin does not call required DOM facade symbol: ${callName}`, "Execute the governed DOM facade symbol inside the Amazon plugin flow."));
  }
  return findings;
};

const validatePluginBrowserControllerImport = (
  auditProject: DomAutomationAuditProject,
): Finding[] => {
  const repoPath = "src/plugins/amazon-invoice-upload/amazon-invoice-upload.flow.ts";
  const sourceFile = getSourceFileAtRepoPath(auditProject.project, repoPath);
  const browserControllerImport = sourceFile ? findNamedImport(sourceFile, "BrowserController") : null;
  return (browserControllerImport ? resolveModuleTargetPath(browserControllerImport) : null) === BROWSER_CONTROLLER_PATH
    ? []
    : [symbolFinding("GRASSEYE-DOM-001-V1", repoPath, 1, "plugin does not import BrowserController through the public contract", "Type plugin browser dependencies through src/lib/browser/browser-controller.ts.")];
};

const validatePluginFacadeCalls = (
  auditProject: DomAutomationAuditProject,
): Finding[] => {
  const repoPath = "src/plugins/amazon-invoice-upload/amazon-invoice-upload.flow.ts";
  const sourceFile = getSourceFileAtRepoPath(auditProject.project, repoPath);
  if (!sourceFile) {
    return [symbolFinding("GRASSEYE-DOM-008-V1", repoPath, 1, "Amazon phase-one flow is missing", "Restore the plugin flow and call the DOM facade from it." )];
  }
  return [
    ...REQUIRED_DOM_FACADE_CALLS.flatMap((callName) => validateRequiredFacadeCall(auditProject, callName)),
    ...validatePluginBrowserControllerImport(auditProject),
  ];
};

const validateBrowserControllerInterfaceMethods = (auditProject: DomAutomationAuditProject): Finding[] => {
  const browserControllerFile = getSourceFileAtRepoPath(auditProject.project, BROWSER_CONTROLLER_PATH);
  const browserControllerInterface = browserControllerFile?.getInterface("BrowserController");
  const findings: Finding[] = [];
  if (!browserControllerInterface?.getMethod("evaluateActiveTab")) {
    findings.push(symbolFinding("GRASSEYE-DOM-001-V1", BROWSER_CONTROLLER_PATH, 1, "BrowserController interface is missing evaluateActiveTab", "Expose evaluateActiveTab on the governed BrowserController contract."));
  }
  if (!browserControllerInterface?.getMethod("setFileInputFiles")) {
    findings.push(symbolFinding("GRASSEYE-DOM-006-V1", BROWSER_CONTROLLER_PATH, 1, "BrowserController interface is missing setFileInputFiles", "Expose a governed file-input upload port on the BrowserController contract."));
  }
  return findings;
};

const validateCurrentChromeMethods = (auditProject: DomAutomationAuditProject): Finding[] => {
  const currentChromeFile = getSourceFileAtRepoPath(auditProject.project, "src/lib/browser/current-chrome-browser-controller.ts");
  const currentChromeClass = currentChromeFile?.getClass("CurrentChromeBrowserController");
  const findings: Finding[] = [];
  if (!currentChromeClass?.getMethod("evaluateActiveTab")) {
    findings.push(symbolFinding("GRASSEYE-DOM-001-V1", "src/lib/browser/current-chrome-browser-controller.ts", 1, "CurrentChromeBrowserController does not implement evaluateActiveTab", "Keep DOM execution inside the single browser owner implementation."));
  }
  if (!currentChromeClass?.getMethod("setFileInputFiles")) {
    findings.push(symbolFinding("GRASSEYE-DOM-006-V1", "src/lib/browser/current-chrome-browser-controller.ts", 1, "CurrentChromeBrowserController does not implement setFileInputFiles", "Keep real file upload inside the single browser owner implementation."));
  }
  return findings;
};

const validateCurrentChromeActiveTabWrapper = (auditProject: DomAutomationAuditProject): Finding[] => {
  const repoPath = "src/lib/browser/current-chrome-browser-controller-execution.ts";
  const sourceFile = getSourceFileAtRepoPath(auditProject.project, repoPath);
  if (!sourceFile) {
    return [symbolFinding("GRASSEYE-DOM-001-V1", repoPath, 1, "CurrentChrome active-tab execution module is missing", "Restore the governed CurrentChrome evaluateActiveTab execution module.")];
  }
  const wrapper = sourceFile.getVariableDeclaration("buildWrappedActiveTabScript");
  const findings: Finding[] = [];
  if (!wrapper) {
    findings.push(symbolFinding("GRASSEYE-DOM-001-V1", repoPath, 1, "CurrentChrome active-tab wrapper is missing", "Keep active-tab JavaScript wrapping inside the governed CurrentChrome execution module."));
  }
  if (!hasStaticText(sourceFile, "return JSON.stringify(result ?? null);")) {
    findings.push(symbolFinding("GRASSEYE-DOM-001-V1", repoPath, wrapper?.getStartLineNumber() ?? 1, "CurrentChrome active-tab wrapper does not synchronously return JSON", "Google Chrome AppleScript execute-javascript must receive a synchronous JSON string return."));
  }
  if (hasStaticText(sourceFile, "async ()") || hasStaticText(sourceFile, "await (")) {
    findings.push(symbolFinding("GRASSEYE-DOM-001-V1", repoPath, wrapper?.getStartLineNumber() ?? 1, "CurrentChrome active-tab wrapper contains async/await semantics", "Do not wrap active-tab JavaScript in an async IIFE; AppleScript can lose the Promise result."));
  }
  return findings;
};

const validateNoSecondBrowserController = (auditProject: DomAutomationAuditProject): Finding[] =>
  auditProject.project.getSourceFiles("src/**/*.ts").flatMap((sourceFile) => {
    const repoPath = sourceFile.getFilePath().replace(`${auditProject.project.getDirectoryOrThrow(".").getPath()}/`, "");
    if (repoPath === "src/lib/browser/current-chrome-browser-controller.ts") return [];
    return sourceFile.getClasses().flatMap((classDeclaration) =>
      classDeclaration.getImplements().some((heritage) => heritage.getText().includes("BrowserController"))
        ? [symbolFinding("GRASSEYE-DOM-001-V1", repoPath, classDeclaration.getStartLineNumber(), "second BrowserController implementation is forbidden", "Keep browser ownership in the existing CurrentChromeBrowserController only.")]
        : []);
  });

const validateBrowserControllerSymbolProof = (
  auditProject: DomAutomationAuditProject,
): Finding[] => [
  ...validateBrowserControllerInterfaceMethods(auditProject),
  ...validateCurrentChromeMethods(auditProject),
  ...validateCurrentChromeActiveTabWrapper(auditProject),
  ...validateNoSecondBrowserController(auditProject),
];

const validateSymbolBoundaries = (
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
    passSummary: "symbol and contract proofs bind plugin orchestration to the DOM facade and DOM runtime to BrowserController evaluate/upload ports.",
    failSummary: "symbol-level DOM boundary proof is incomplete.",
  });
};
