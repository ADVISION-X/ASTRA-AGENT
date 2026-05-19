import { existsSync } from "node:fs";
import { pathFromRepoRoot } from "../../core/paths.js";
import type { ClauseCheckOutcome, DomAutomationBinaryCheckContext } from "./dom-automation-binary-types.js";
import { pass, fail, sourceFile, sourceText, variableFields, typeFields, hasFields, hasPropertyCall, classMethods, interfaceMethods, sourceFilesWithin, repoPathOf, findForbiddenImports, hasVisualMissionDomImport, hasSecondBrowserController, usesForbiddenPluginPrimitives, domCoreContainsBusinessVocabulary, hasSensitiveDomAccess, forbiddenLogFields, manifestHasAllLawIds, pluginUsesFacadeSymbols, routeUsesWorkbenchFacade, hasIdentifierCall } from "./dom-automation-binary-helpers.js";
import { BROWSER_CONTROLLER_PATH, CURRENT_CHROME_PATH, DOM_ACTION_CODES, DOM_EXPORTS, DOM_FACADE_PATH, DOM_REQUIRED_PATHS, PLUGIN_REQUIRED_PATHS } from "./dom-automation-binary-constants.js";

export const checkLaw006UploadApprovedFile = (context: DomAutomationBinaryCheckContext): ClauseCheckOutcome => {
  const issues: string[] = [];
  const schemaFile = sourceFile(context, "src/capabilities/dom-automation/schema.ts");
  const uploadText = sourceText(context, "src/capabilities/dom-automation/runtime/dom-upload.ts");
  const storageText = sourceText(context, "src/plugins/amazon-invoice-upload/amazon-invoice-upload-storage.ts");
  const taskServiceText = sourceText(context, "src/plugins/amazon-invoice-upload/amazon-invoice-upload-task-service.ts");
  const uploadFields = variableFields(schemaFile, "UploadApprovedFileInputSchema");
  const missingFields = hasFields(uploadFields, ["elementRef", "approvedFilePath", "approvedTaskFilePath", "allowedExtensions", "uploadPurpose"]);
  if (missingFields.length > 0) {
    issues.push(`UploadApprovedFileInputSchema is missing fields: ${missingFields.join(", ")}`);
  }
  for (const token of ["approvedPath !== taskPath", "existsSync", "statSync", "allowedExtensions.includes", "targetKind !== \"file-input\"", "captureDomEvidenceRef", "browser.setFileInputFiles"]) {
    if (!uploadText.includes(token)) {
      issues.push(`dom-upload is missing governed upload guard: ${token}`);
    }
  }
  const browserMethods = interfaceMethods(sourceFile(context, BROWSER_CONTROLLER_PATH), "BrowserController");
  const currentChromeMethods = classMethods(sourceFile(context, CURRENT_CHROME_PATH), "CurrentChromeBrowserController");
  if (!browserMethods.has("setFileInputFiles") || !currentChromeMethods.has("setFileInputFiles")) {
    issues.push("browser owner bridge does not expose setFileInputFiles end-to-end");
  }
  if (!taskServiceText.includes("saveApprovedInvoicePdf") || !storageText.includes("approved-task-files")) {
    issues.push("approved task file persistence path is not enforced through plugin storage");
  }
  if (/fileContent|pdfContent|readFileSync\(|toString\(\)/iu.test(uploadText)) {
    issues.push("dom-upload reads file content instead of using approved file references only");
  }
  return issues.length === 0
    ? pass("dom-upload validates approved file path equality, file existence/type, file-input target, before/after evidence, and the governed browser file-input bridge")
    : fail("DOM upload approved-file check failed", issues.join("; "));
};

export const checkLaw007VerifyEvidence = (context: DomAutomationBinaryCheckContext): ClauseCheckOutcome => {
  const issues: string[] = [];
  const schemaText = sourceText(context, "src/capabilities/dom-automation/schema.ts");
  const verifyText = sourceText(context, "src/capabilities/dom-automation/runtime/dom-verify.ts");
  const waitText = sourceText(context, "src/capabilities/dom-automation/runtime/dom-wait.ts");
  for (const token of ["success", "failed", "not_found", "ambiguous", "login_required", "captcha_or_2fa_required", "review_required"]) {
    if (!schemaText.includes(`\"${token}\"`)) {
      issues.push(`verification schemas do not expose status: ${token}`);
    }
  }
  for (const token of ["status: \"login_required\"", "status: \"captcha_or_2fa_required\"", "status: \"failed\"", "status: \"success\"", "status: \"not_found\"", "evidenceRef"]) {
    if (!verifyText.includes(token)) {
      issues.push(`dom-verify is missing evidence-backed result branch: ${token}`);
    }
  }
  for (const token of ["timeoutMs", "pollIntervalMs", "readDomSnapshotOnce", "verifyDomStateOnce", "browser.wait"]) {
    if (!waitText.includes(token)) {
      issues.push(`dom-wait is missing bounded polling proof: ${token}`);
    }
  }
  return issues.length === 0
    ? pass("dom-verify and dom-wait return evidence-backed success/failure/login/captcha/not_found results with bounded polling semantics")
    : fail("DOM verify evidence check failed", issues.join("; "));
};

export const checkLaw008PluginBoundary = (context: DomAutomationBinaryCheckContext): ClauseCheckOutcome => {
  const issues: string[] = [];
  const missingPaths = PLUGIN_REQUIRED_PATHS.filter((repoPath) => !existsSync(pathFromRepoRoot(repoPath)));
  if (missingPaths.length > 0) {
    issues.push(`missing plugin or acceptance path: ${missingPaths[0]}`);
  }
  const domVocabulary = domCoreContainsBusinessVocabulary(context);
  const firstDomVocabularyViolation = domVocabulary[0];
  if (firstDomVocabularyViolation) {
    issues.push(firstDomVocabularyViolation);
  }
  const forbiddenImports = findForbiddenImports(context, "src/plugins/amazon-invoice-upload", ["src/capabilities/dom-automation/runtime", CURRENT_CHROME_PATH, "src/lib/local-runtime"]);
  if (forbiddenImports.length > 0) {
    issues.push(`plugin imports forbidden private implementation: ${forbiddenImports[0]}`);
  }
  const missingFacadeSymbols = pluginUsesFacadeSymbols(context, [
    "readDomSnapshotOnce",
    "locateDomElementOnce",
    "fillDomElementOnce",
    "clickDomElementOnce",
    "uploadApprovedFileOnce",
    "verifyDomStateOnce",
    "waitForDomStateOnce",
  ]);
  if (missingFacadeSymbols.length > 0) {
    issues.push(`plugin does not prove DOM facade usage for symbols: ${missingFacadeSymbols.join(", ")}`);
  }
  const routeIssues = routeUsesWorkbenchFacade(context);
  const firstRouteIssue = routeIssues[0];
  if (firstRouteIssue) {
    issues.push(firstRouteIssue);
  }
  const primitiveViolations = usesForbiddenPluginPrimitives(context);
  const firstPrimitiveViolation = primitiveViolations[0];
  if (firstPrimitiveViolation) {
    issues.push(firstPrimitiveViolation);
  }
  return issues.length === 0
    ? pass("plugin ownership stays inside src/plugins, calls DOM facade symbols, routes through the workbench facade, and avoids browser/runtime primitive bypasses")
    : fail("Plugin boundary check failed", issues.join("; "));
};

export const checkLaw009ReviewBoundary = (context: DomAutomationBinaryCheckContext): ClauseCheckOutcome => {
  const issues: string[] = [];
  const supportText = sourceText(context, "src/plugins/amazon-invoice-upload/amazon-invoice-upload-flow-support.ts");
  const flowText = sourceText(context, "src/plugins/amazon-invoice-upload/amazon-invoice-upload.flow.ts");
  const resultDetectorText = sourceText(context, "src/plugins/amazon-invoice-upload/amazon-result-detector.ts");
  const platformText = sourceText(context, "src/plugins/amazon-invoice-upload/amazon-platform.config.ts");
  const missionText = sourceText(context, "src/plugins/amazon-invoice-upload/mission.schema.ts");
  for (const token of ["login-required", "captcha-or-2fa-required", "ambiguous", "review_required"]) {
    if (!supportText.includes(token) && !resultDetectorText.includes(token) && !flowText.includes(token)) {
      issues.push(`review-boundary logic is missing token: ${token}`);
    }
  }
  for (const token of ["requireHumanFinalSubmit", "status: \"review_required\"", "runAmazonInvoiceUploadPhaseOne", "file_input_not_found", "dangerous DOM click requires human review"]) {
    if (!flowText.includes(token) && !sourceText(context, "src/capabilities/dom-automation/runtime/dom-click.ts").includes(token)) {
      issues.push(`review-boundary logic is missing guard: ${token}`);
    }
  }
  if (!platformText.includes("AMAZON_MARKETPLACE_HOST_HINTS") || !missionText.includes("marketplace")) {
    issues.push("marketplace host hints or marketplace mission input are missing");
  }
  return issues.length === 0
    ? pass("login/captcha/ambiguity/review-required flows are wired through verify/gatedResult/phase-one boundaries, with marketplace hints and human-final-submit support")
    : fail("Review boundary check failed", issues.join("; "));
};

export const checkLaw010EvidenceLogging = (context: DomAutomationBinaryCheckContext): ClauseCheckOutcome => {
  const issues: string[] = [];
  const schemaFile = sourceFile(context, "src/capabilities/dom-automation/schema.ts");
  const actionFields = variableFields(schemaFile, "DomActionResultSchema");
  const verifyFields = variableFields(schemaFile, "DomVerificationResultSchema");
  const taskResultFields = typeFields(sourceFile(context, "src/plugins/amazon-invoice-upload/amazon-invoice-upload.flow.ts"), "AmazonInvoiceUploadTaskResult");
  const taskRecordFields = typeFields(sourceFile(context, "src/plugins/amazon-invoice-upload/amazon-invoice-upload-storage.ts"), "AmazonInvoiceUploadTaskRecord");
  const missingActionFields = hasFields(actionFields, ["ok", "status", "actionId", "message", "beforeEvidenceRef", "afterEvidenceRef", "reviewRequiredReason"]);
  const missingVerifyFields = hasFields(verifyFields, ["status", "confidence", "evidenceRef", "reason"]);
  const missingTaskFields = hasFields(taskResultFields, ["status", "reason", "reachedStep", "evidenceRef", "reviewRequired", "amazonOrderId", "invoiceNo"]);
  const missingRecordFields = hasFields(taskRecordFields, ["taskId", "mission", "createdAt", "updatedAt"]);
  if (missingActionFields.length > 0) {
    issues.push(`DomActionResultSchema is missing structured fields: ${missingActionFields.join(", ")}`);
  }
  if (missingVerifyFields.length > 0) {
    issues.push(`DomVerificationResultSchema is missing structured fields: ${missingVerifyFields.join(", ")}`);
  }
  if (missingTaskFields.length > 0) {
    issues.push(`AmazonInvoiceUploadTaskResult is missing structured fields: ${missingTaskFields.join(", ")}`);
  }
  if (missingRecordFields.length > 0) {
    issues.push(`AmazonInvoiceUploadTaskRecord is missing persisted fields: ${missingRecordFields.join(", ")}`);
  }
  if (!sourceText(context, "src/plugins/amazon-invoice-upload/amazon-invoice-upload-storage.ts").includes("JSON.stringify(record, null, 2)")) {
    issues.push("Amazon task record is not persisted as a structured JSON record");
  }
  const evidenceCaptureMissing = [
    "src/capabilities/dom-automation/runtime/dom-fill.ts",
    "src/capabilities/dom-automation/runtime/dom-click.ts",
    "src/capabilities/dom-automation/runtime/dom-upload.ts",
  ].filter((repoPath) => {
    const file = sourceFile(context, repoPath);
    return !file || !hasIdentifierCall(file, "captureDomEvidenceRef");
  });
  if (evidenceCaptureMissing.length > 0) {
    issues.push(`DOM runtimes are missing evidence capture: ${evidenceCaptureMissing.join(", ")}`);
  }
  const logViolations = forbiddenLogFields(context);
  if (logViolations.length > 0) {
    issues.push(`forbidden sensitive log field detected: ${logViolations[0]}`);
  }
  return issues.length === 0
    ? pass("DOM action/verification results and Amazon task records stay structured, persist evidence refs, and avoid sensitive log-field leakage")
    : fail("Evidence and logging check failed", issues.join("; "));
};
