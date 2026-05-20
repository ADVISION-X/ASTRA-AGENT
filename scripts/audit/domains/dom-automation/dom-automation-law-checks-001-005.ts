import { existsSync } from "node:fs";
import { pathFromRepoRoot } from "../../core/paths.js";
import type { ClauseCheckOutcome, DomAutomationBinaryCheckContext } from "./dom-automation-binary-types.js";
import { pass, fail } from "./dom-automation-binary-outcome.js";
import { DOM_ACTION_CODES, DOM_EXPORTS, DOM_REQUIRED_PATHS } from "./dom-automation-binary-constants.js";
import { BROWSER_CONTROLLER_PATH, CURRENT_CHROME_EXECUTION_PATH, CURRENT_CHROME_PATH } from "./dom-automation-path-constants.js";
import { findForbiddenImports, hasSecondBrowserController, hasVisualMissionDomImport, sourceText } from "./dom-automation-source-helpers.js";
import { domCoreContainsBusinessVocabulary, forbiddenLogFields, hasSensitiveDomAccess, manifestHasAllLawIds, pluginUsesFacadeSymbols, routeUsesWorkbenchFacade, usesForbiddenPluginPrimitives } from "./dom-automation-policy-helpers.js";
import { classMethods, hasFields, hasIdentifierCall, hasPropertyCall, interfaceMethods, sourceFile, variableFields } from "./dom-automation-shape-helpers.js";
import type { Finding } from "../../core/schema.js";
import { domClickFindings } from "./components/validate-runtime-contracts-actions.js";
import { domLocatorFindings, domSchemaFindings, domSnapshotFindings } from "./components/validate-runtime-contracts-basic.js";

const findingMessages = (findings: readonly Finding[]): string[] =>
  findings.map((finding) => `${finding.file}:${finding.line} ${finding.message}`);

const collectLaw001PathIssues = (): string[] => {
  const issues: string[] = [];
  for (const repoPath of ["src/capabilities/dom-automation", "src/plugins/amazon-invoice-upload", ...DOM_REQUIRED_PATHS]) {
    if (!existsSync(pathFromRepoRoot(repoPath))) {
      issues.push(`missing required path: ${repoPath}`);
    }
  }
  return issues;
};

const collectLaw001FacadeIssues = (context: DomAutomationBinaryCheckContext): string[] => {
  const issues: string[] = [];
  const indexFile = sourceFile(context, "src/capabilities/dom-automation/index.ts");
  const manifestFileText = sourceText(context, "src/capabilities/dom-automation/manifest.ts");
  const catalogText = sourceText(context, "src/muscle-memory/catalog.ts");
  for (const exportName of DOM_EXPORTS) {
    if (!indexFile?.getExportedDeclarations().has(exportName)) {
      issues.push(`dom facade is missing export: ${exportName}`);
    }
  }
  for (const actionCode of DOM_ACTION_CODES) {
    if (!manifestFileText.includes(actionCode)) {
      issues.push(`dom manifest is missing actionCode: ${actionCode}`);
    }
  }
  if (!catalogText.includes("DOM_AUTOMATION_CATALOG_ENTRIES") || !catalogText.includes("mergeCapabilityCatalogEntries")) {
    issues.push("muscle-memory catalog does not source-merge DOM entries");
  }
  return issues;
};

const collectLaw001BrowserIssues = (context: DomAutomationBinaryCheckContext): string[] => {
  const issues: string[] = [];
  const browserMethods = interfaceMethods(sourceFile(context, BROWSER_CONTROLLER_PATH), "BrowserController");
  const currentChromeMethods = classMethods(sourceFile(context, CURRENT_CHROME_PATH), "CurrentChromeBrowserController");
  for (const methodName of ["evaluateActiveTab", "setFileInputFiles"]) {
    if (!browserMethods.has(methodName)) {
      issues.push(`BrowserController interface is missing ${methodName}`);
    }
    if (!currentChromeMethods.has(methodName)) {
      issues.push(`CurrentChromeBrowserController is missing ${methodName}`);
    }
  }
  const secondBrowser = hasSecondBrowserController(context);
  if (secondBrowser.length > 0) {
    issues.push(`second BrowserController implementation detected: ${secondBrowser[0]}`);
  }
  const currentChromeExecutionText = sourceText(context, CURRENT_CHROME_EXECUTION_PATH);
  if (!currentChromeExecutionText.includes("return JSON.stringify(result ?? null);")) {
    issues.push("CurrentChrome active-tab wrapper does not synchronously return JSON");
  }
  if (currentChromeExecutionText.includes("async ()") || currentChromeExecutionText.includes("await (")) {
    issues.push("CurrentChrome active-tab wrapper contains async/await semantics");
  }
  return issues;
};

const collectLaw001BoundaryIssues = (context: DomAutomationBinaryCheckContext): string[] => {
  const issues: string[] = [];
  if (hasVisualMissionDomImport(context)) {
    issues.push("visual-mission imports DOM automation code");
  }
  const domImportsPlugin = findForbiddenImports(context, "src/capabilities/dom-automation", ["src/plugins/amazon-invoice-upload"]);
  if (domImportsPlugin.length > 0) {
    issues.push(`DOM owner imports plugin code: ${domImportsPlugin[0]}`);
  }
  const pluginImportsRuntime = findForbiddenImports(context, "src/plugins/amazon-invoice-upload", ["src/capabilities/dom-automation/runtime", CURRENT_CHROME_PATH, "src/lib/local-runtime"]);
  if (pluginImportsRuntime.length > 0) {
    issues.push(`plugin crosses owner boundary: ${pluginImportsRuntime[0]}`);
  }
  if (!manifestHasAllLawIds(context)) {
    issues.push("dom owner manifest does not authorize all active DOM laws");
  }
  return issues;
};

export const checkLaw001Sovereignty = (context: DomAutomationBinaryCheckContext): ClauseCheckOutcome => {
  const issues = [
    ...collectLaw001PathIssues(),
    ...collectLaw001FacadeIssues(context),
    ...collectLaw001BrowserIssues(context),
    ...collectLaw001BoundaryIssues(context),
  ];
  return issues.length === 0
    ? pass("dom owner paths, registry exposure, single BrowserController ownership, visual decoupling, and owner-manifest law coverage are all enforced")
    : fail("DOM sovereignty check failed", issues.join("; "));
};

const collectLaw002SchemaIssues = (context: DomAutomationBinaryCheckContext): string[] => {
  const issues: string[] = [];
  const schemaFile = sourceFile(context, "src/capabilities/dom-automation/schema.ts");
  const snapshotFields = variableFields(schemaFile, "DomSnapshotSchema");
  const readInputFields = variableFields(schemaFile, "ReadDomSnapshotInputSchema");
  const missingSnapshotFields = hasFields(snapshotFields, ["url", "title", "forms", "inputs", "buttons", "links", "fileInputs", "dialogs", "frames", "textBlocks", "tableRows", "roleRows", "genericClickableElements", "detectedStates"]);
  const missingReadInputFields = hasFields(readInputFields, ["includeFrames", "includeHidden", "maxTextLengthPerNode", "targetScope"]);
  if (missingSnapshotFields.length > 0) {
    issues.push(`DomSnapshotSchema is missing fields: ${missingSnapshotFields.join(", ")}`);
  }
  if (missingReadInputFields.length > 0) {
    issues.push(`ReadDomSnapshotInputSchema is missing fields: ${missingReadInputFields.join(", ")}`);
  }
  return issues;
};

const collectMissingTokens = (
  text: string,
  tokens: string[],
  messagePrefix: string,
): string[] => tokens
  .filter((token) => !text.includes(token))
  .map((token) => `${messagePrefix}: ${token}`);

const collectLaw002RuntimeIssues = (context: DomAutomationBinaryCheckContext): string[] => {
  const issues: string[] = [];
  const snapshotFile = sourceFile(context, "src/capabilities/dom-automation/runtime/dom-snapshot.ts");
  const snapshotText = sourceText(context, "src/capabilities/dom-automation/runtime/dom-snapshot.ts");
  if (!hasPropertyCall(sourceFile(context, "src/capabilities/dom-automation/runtime/dom-snapshot.ts"), "browser", "evaluateActiveTab")) {
    issues.push("dom-snapshot does not call browser.evaluateActiveTab");
  }
  issues.push(...collectMissingTokens(snapshotText, ["clip", "selectorFor", "labelText", "selectorCandidate", "detectedStates.push(\"login_required\")", "detectedStates.push(\"captcha_or_2fa_required\")", "item.type !== \"hidden\"", "password"], "dom-snapshot is missing governed summary token"));
  if (hasSensitiveDomAccess(snapshotFile)) {
    issues.push("dom-snapshot contains forbidden cookie/storage/full-html access");
  }
  return issues;
};

const collectLaw002BrowserGuardIssues = (context: DomAutomationBinaryCheckContext): string[] =>
  collectMissingTokens(
    sourceText(context, CURRENT_CHROME_EXECUTION_PATH),
    ["document\\.cookie", "localStorage", "sessionStorage", "outerHTML", "document\\.documentElement\\.innerHTML"],
    "current Chrome evaluateActiveTab guard is missing token",
  );

export const checkLaw002SnapshotSummary = (context: DomAutomationBinaryCheckContext): ClauseCheckOutcome => {
  const issues = [
    ...collectLaw002SchemaIssues(context),
    ...collectLaw002RuntimeIssues(context),
    ...collectLaw002BrowserGuardIssues(context),
    ...findingMessages(domSchemaFindings(context.auditProject)),
    ...findingMessages(domSnapshotFindings(context.auditProject)),
  ];
  return issues.length === 0
    ? pass("dom-snapshot exposes only governed summary fields, clips node text, filters hidden/password values, and blocks cookie/storage/full-html escape patterns")
    : fail("DOM snapshot summary check failed", issues.join("; "));
};

export const checkLaw003LocatorSemantic = (context: DomAutomationBinaryCheckContext): ClauseCheckOutcome => {
  const issues: string[] = [];
  const schemaFile = sourceFile(context, "src/capabilities/dom-automation/schema.ts");
  const locatorText = sourceText(context, "src/capabilities/dom-automation/runtime/dom-locator.ts");
  const inputFields = variableFields(schemaFile, "LocateDomElementInputSchema");
  const refFields = variableFields(schemaFile, "DomElementRefSchema");
  const missingInputFields = hasFields(inputFields, ["snapshot", "targetKind", "hints", "requiredText", "frameHint"]);
  const missingRefFields = hasFields(refFields, ["elementRef", "selector", "frameRef", "targetKind", "confidence", "matchedSignals", "reason", "fallbackUsed"]);
  if (missingInputFields.length > 0) {
    issues.push(`LocateDomElementInputSchema is missing fields: ${missingInputFields.join(", ")}`);
  }
  if (missingRefFields.length > 0) {
    issues.push(`DomElementRefSchema is missing fields: ${missingRefFields.join(", ")}`);
  }
  for (const token of ["role/name", "aria-label", "label", "placeholder", "visible-text", "name-id", "test-id", "nearby-text", "visible-enabled", "usedCssLastResort", "Math.abs(best.score - second.score) < 0.05"]) {
    if (!locatorText.includes(token)) {
      issues.push(`dom-locator is missing semantic scoring proof: ${token}`);
    }
  }
  if (inputFields.has("x") || inputFields.has("y")) {
    issues.push("locator input schema still exposes coordinate fields");
  }
  issues.push(...findingMessages(domLocatorFindings(context.auditProject)));
  return issues.length === 0
    ? pass("dom-locator scores semantic signals in priority order, returns confidence/reason/matchedSignals/fallbackUsed, and rejects coordinate-only ambiguity")
    : fail("DOM locator semantic-first check failed", issues.join("; "));
};

export const checkLaw004FillApprovedText = (context: DomAutomationBinaryCheckContext): ClauseCheckOutcome => {
  const issues: string[] = [];
  const schemaFile = sourceFile(context, "src/capabilities/dom-automation/schema.ts");
  const fillText = sourceText(context, "src/capabilities/dom-automation/runtime/dom-fill.ts");
  const fillFields = variableFields(schemaFile, "FillDomElementInputSchema");
  const missingFields = hasFields(fillFields, ["elementRef", "approvedText", "clearBeforeType", "inputPurpose"]);
  if (missingFields.length > 0) {
    issues.push(`FillDomElementInputSchema is missing fields: ${missingFields.join(", ")}`);
  }
  if (!hasPropertyCall(sourceFile(context, "src/capabilities/dom-automation/runtime/dom-fill.ts"), "browser", "evaluateActiveTab")) {
    issues.push("dom-fill does not call browser.evaluateActiveTab");
  }
  const fillFile = sourceFile(context, "src/capabilities/dom-automation/runtime/dom-fill.ts");
  if (!fillFile || !hasIdentifierCall(fillFile, "captureDomEvidenceRef")) {
    issues.push("dom-fill does not capture evidence refs");
  }
  for (const token of ["approvedText is empty", "password input is forbidden", "element is hidden", "element is disabled", "approvedText", "selector"]) {
    if (!fillText.includes(token)) {
      issues.push(`dom-fill is missing governed fill guard: ${token}`);
    }
  }
  if (/clipboard|paste/iu.test(fillText)) {
    issues.push("dom-fill still references clipboard or paste-based input");
  }
  return issues.length === 0
    ? pass("dom-fill is bound to elementRef + approvedText, rejects empty/password input, captures before/after evidence, and avoids clipboard/paste escape paths")
    : fail("DOM fill approved-text check failed", issues.join("; "));
};

export const checkLaw005ClickLocatedElement = (context: DomAutomationBinaryCheckContext): ClauseCheckOutcome => {
  const issues: string[] = [];
  const schemaFile = sourceFile(context, "src/capabilities/dom-automation/schema.ts");
  const clickText = sourceText(context, "src/capabilities/dom-automation/runtime/dom-click.ts");
  const clickFields = variableFields(schemaFile, "ClickDomElementInputSchema");
  const missingFields = hasFields(clickFields, ["elementRef", "expectedKind", "expectedText", "waitAfterMs"]);
  if (missingFields.length > 0) {
    issues.push(`ClickDomElementInputSchema is missing fields: ${missingFields.join(", ")}`);
  }
  if (clickFields.has("x") || clickFields.has("y") || clickFields.has("gridCell")) {
    issues.push("click input schema still exposes coordinate-based bypass fields");
  }
  if (!hasPropertyCall(sourceFile(context, "src/capabilities/dom-automation/runtime/dom-click.ts"), "browser", "evaluateActiveTab")) {
    issues.push("dom-click does not call browser.evaluateActiveTab");
  }
  const clickFile = sourceFile(context, "src/capabilities/dom-automation/runtime/dom-click.ts");
  if (!clickFile || !hasIdentifierCall(clickFile, "captureDomEvidenceRef")) {
    issues.push("dom-click does not capture evidence refs");
  }
  for (const token of ["DANGEROUS_TEXT", "selector matched multiple elements", "element is hidden", "element is disabled", "expected text did not match", "waitAfterMs"]) {
    if (!clickText.includes(token)) {
      issues.push(`dom-click is missing governed click guard: ${token}`);
    }
  }
  if (clickText.includes("browser.click(")) {
    issues.push("dom-click bypasses DOM element execution with direct coordinate click");
  }
  issues.push(...findingMessages(domClickFindings(context.auditProject)));
  return issues.length === 0
    ? pass("dom-click requires elementRef-bound execution, blocks dangerous/hidden/disabled/ambiguous targets, and captures before/after evidence")
    : fail("DOM click located-element check failed", issues.join("; "));
};
