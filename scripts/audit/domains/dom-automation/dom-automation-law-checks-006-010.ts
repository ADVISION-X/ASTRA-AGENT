import { existsSync } from "node:fs";
import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import { pathFromRepoRoot } from "../../core/paths.js";
import type { ClauseCheckOutcome, DomAutomationBinaryCheckContext } from "./dom-automation-binary-types.js";
import { pass, fail } from "./dom-automation-binary-outcome.js";
import { PLUGIN_REQUIRED_PATHS } from "./dom-automation-binary-constants.js";
import { BROWSER_CONTROLLER_PATH, CURRENT_CHROME_PATH } from "./dom-automation-path-constants.js";
import { collectStringLiteralNodes } from "./components/dom-automation-static-strings.js";
import { collectAmazonOrderReadinessIssues, collectAmazonUploadClosureIssues, collectApprovedInvoiceStorageIssues, collectVerificationResultStatuses } from "./components/validate-approved-invoice-storage.js";
import { findForbiddenImports, sourceText } from "./dom-automation-source-helpers.js";
import { domCoreContainsBusinessVocabulary, forbiddenLogFields, usesForbiddenPluginPrimitives, pluginUsesFacadeSymbols, routeUsesWorkbenchFacade } from "./dom-automation-policy-helpers.js";
import { classMethods, hasFields, hasIdentifierCall, interfaceMethods, sourceFile, typeFields, variableFields } from "./dom-automation-shape-helpers.js";

const fileHasIdentifier = (file: SourceFile | null, identifierName: string): boolean =>
  Boolean(file?.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => identifier.getText() === identifierName));

const fileHasStaticStringToken = (file: SourceFile | null, token: string): boolean =>
  Boolean(file && collectStringLiteralNodes(file).some((literal) => literal.text.includes(token)));

const anyFileHasIdentifier = (files: readonly (SourceFile | null)[], identifierName: string): boolean =>
  files.some((file) => fileHasIdentifier(file, identifierName));

const anyFileHasStaticStringToken = (files: readonly (SourceFile | null)[], token: string): boolean =>
  files.some((file) => fileHasStaticStringToken(file, token));

const collectReviewTokenIssues = (reviewFiles: readonly (SourceFile | null)[]): string[] => {
  const issues: string[] = [];
  for (const token of ["login-required", "captcha-or-2fa-required", "ambiguous", "review_required"]) {
    if (!anyFileHasStaticStringToken(reviewFiles, token)) {
      issues.push(`review-boundary logic is missing token: ${token}`);
    }
  }
  return issues;
};

const collectReviewGuardIssues = (
  reviewFiles: readonly (SourceFile | null)[],
  domClickFile: SourceFile | null,
): string[] => {
  const issues: string[] = [];
  for (const token of ["requireHumanFinalSubmit", "runAmazonInvoiceUploadPhaseOne"]) {
    if (!anyFileHasIdentifier(reviewFiles, token)) {
      issues.push(`review-boundary logic is missing guard: ${token}`);
    }
  }
  for (const token of ["review_required", "file_input_not_found"]) {
    if (!anyFileHasStaticStringToken(reviewFiles, token)) {
      issues.push(`review-boundary logic is missing guard: ${token}`);
    }
  }
  if (!fileHasStaticStringToken(domClickFile, "dangerous DOM click requires human review")) {
    issues.push("review-boundary logic is missing guard: dangerous DOM click requires human review");
  }
  return issues;
};

const collectMarketplaceGuardIssues = (context: DomAutomationBinaryCheckContext): string[] => {
  const platformText = sourceText(context, "src/plugins/amazon-invoice-upload/amazon-platform.config.ts");
  const missionText = sourceText(context, "src/plugins/amazon-invoice-upload/mission.schema.ts");
  const issues = platformText.includes("AMAZON_MARKETPLACE_HOST_HINTS") && missionText.includes("marketplace")
    ? []
    : ["marketplace host hints or marketplace mission input are missing"];
  const hintFile = sourceFile(context, "src/plugins/amazon-invoice-upload/amazon-dom-hints.ts");
  const hintTexts = hintFile ? collectStringLiteralNodes(hintFile).map((literal) => literal.text) : [];
  for (const hint of ["myo-search-input", "搜索", "订单编号"]) {
    if (!hintTexts.includes(hint)) issues.push(`Amazon DOM hints are missing real Seller Central order-search signal: ${hint}`);
  }
  return issues;
};

const collectAmazonReadinessGuardIssues = (context: DomAutomationBinaryCheckContext): string[] =>
  collectAmazonOrderReadinessIssues(sourceFile(context, "src/plugins/amazon-invoice-upload/amazon-invoice-upload-order-detail.ts"));

const hasForbiddenUploadFileContentAccess = (file: SourceFile | null): boolean => {
  if (!file) return true;
  const forbiddenIdentifiers = new Set(["fileContent", "pdfContent", "readFileSync"]);
  const hasForbiddenIdentifier = file.getDescendantsOfKind(SyntaxKind.Identifier)
    .some((identifier) => forbiddenIdentifiers.has(identifier.getText()));
  const hasToStringCall = file.getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((call) => {
      const expression = call.getExpression();
      return Node.isPropertyAccessExpression(expression) && expression.getName() === "toString";
    });
  return hasForbiddenIdentifier || hasToStringCall;
};

export const checkLaw006UploadApprovedFile = (context: DomAutomationBinaryCheckContext): ClauseCheckOutcome => {
  const issues: string[] = [];
  const schemaFile = sourceFile(context, "src/capabilities/dom-automation/schema.ts");
  const uploadFile = sourceFile(context, "src/capabilities/dom-automation/runtime/dom-upload.ts");
  const uploadText = sourceText(context, "src/capabilities/dom-automation/runtime/dom-upload.ts");
  const storageFile = sourceFile(context, "src/plugins/amazon-invoice-upload/amazon-invoice-upload-storage.ts");
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
  if (!taskServiceText.includes("saveApprovedInvoicePdf")) {
    issues.push("approved invoice PDF persistence is not enforced through plugin task service");
  }
  const storageIssues = collectApprovedInvoiceStorageIssues(storageFile);
  if (storageIssues.length > 0) {
    issues.push(...storageIssues);
  }
  if (hasForbiddenUploadFileContentAccess(uploadFile)) {
    issues.push("dom-upload reads file content instead of using approved file references only");
  }
  return issues.length === 0
    ? pass("dom-upload validates approved file path equality, file existence/type, file-input target, before/after evidence, and the governed browser file-input bridge")
    : fail("DOM upload approved-file check failed", issues.join("; "));
};

export const checkLaw007VerifyEvidence = (context: DomAutomationBinaryCheckContext): ClauseCheckOutcome => {
  const issues: string[] = [];
  const schemaText = sourceText(context, "src/capabilities/dom-automation/schema.ts");
  const verifyFile = sourceFile(context, "src/capabilities/dom-automation/runtime/dom-verify.ts");
  const waitText = sourceText(context, "src/capabilities/dom-automation/runtime/dom-wait.ts");
  const requiredStatuses = ["success", "failed", "not_found", "ambiguous", "login_required", "captcha_or_2fa_required", "review_required"] as const;
  for (const token of requiredStatuses) {
    if (!schemaText.includes(`\"${token}\"`)) {
      issues.push(`verification schemas do not expose status: ${token}`);
    }
  }
  const returnedStatuses = collectVerificationResultStatuses(verifyFile);
  for (const status of requiredStatuses) {
    if (!returnedStatuses.has(status)) {
      issues.push(`dom-verify is missing evidence-backed result branch: ${status}`);
    }
  }
  if (!verifyFile?.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) => property.getName() === "evidenceRef")) {
    issues.push("dom-verify is missing evidence-backed result branch: evidenceRef");
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

const collectLaw008PathIssues = (): string[] => {
  const missingPaths = PLUGIN_REQUIRED_PATHS.filter((repoPath) => !existsSync(pathFromRepoRoot(repoPath)));
  return missingPaths.length > 0 ? [`missing plugin or acceptance path: ${missingPaths[0]}`] : [];
};

const collectLaw008ImportIssues = (context: DomAutomationBinaryCheckContext): string[] => {
  const forbiddenImports = findForbiddenImports(context, "src/plugins/amazon-invoice-upload", ["src/capabilities/dom-automation/runtime", CURRENT_CHROME_PATH, "src/lib/local-runtime"]);
  return forbiddenImports.length > 0
    ? [`plugin imports forbidden private implementation: ${forbiddenImports[0]}`]
    : [];
};

const collectLaw008FacadeIssues = (context: DomAutomationBinaryCheckContext): string[] => {
  const missingFacadeSymbols = pluginUsesFacadeSymbols(context, [
    "readDomSnapshotOnce",
    "locateDomElementOnce",
    "fillDomElementOnce",
    "clickDomElementOnce",
    "uploadApprovedFileOnce",
    "verifyDomStateOnce",
    "waitForDomStateOnce",
  ]);
  return missingFacadeSymbols.length > 0
    ? [`plugin does not prove DOM facade usage for symbols: ${missingFacadeSymbols.join(", ")}`]
    : [];
};

const collectLaw008BoundaryIssues = (context: DomAutomationBinaryCheckContext): string[] => {
  const issues: string[] = [];
  const domVocabulary = domCoreContainsBusinessVocabulary(context);
  const firstDomVocabularyViolation = domVocabulary[0];
  if (firstDomVocabularyViolation) {
    issues.push(firstDomVocabularyViolation);
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
  return issues;
};

export const checkLaw008PluginBoundary = (context: DomAutomationBinaryCheckContext): ClauseCheckOutcome => {
  const issues = [
    ...collectLaw008PathIssues(),
    ...collectLaw008BoundaryIssues(context),
    ...collectLaw008ImportIssues(context),
    ...collectLaw008FacadeIssues(context),
  ];
  return issues.length === 0
    ? pass("plugin ownership stays inside src/plugins, calls DOM facade symbols, routes through the workbench facade, and avoids browser/runtime primitive bypasses")
    : fail("Plugin boundary check failed", issues.join("; "));
};

export const checkLaw009ReviewBoundary = (context: DomAutomationBinaryCheckContext): ClauseCheckOutcome => {
  const supportFile = sourceFile(context, "src/plugins/amazon-invoice-upload/amazon-invoice-upload-flow-support.ts");
  const flowFile = sourceFile(context, "src/plugins/amazon-invoice-upload/amazon-invoice-upload.flow.ts");
  const stepsFile = sourceFile(context, "src/plugins/amazon-invoice-upload/amazon-invoice-upload-steps.ts");
  const resultDetectorFile = sourceFile(context, "src/plugins/amazon-invoice-upload/amazon-result-detector.ts");
  const domClickFile = sourceFile(context, "src/capabilities/dom-automation/runtime/dom-click.ts");
  const reviewFiles = [supportFile, flowFile, stepsFile, resultDetectorFile] as const;
  const issues = [
    ...collectReviewTokenIssues(reviewFiles),
    ...collectReviewGuardIssues(reviewFiles, domClickFile),
    ...collectMarketplaceGuardIssues(context),
    ...collectAmazonReadinessGuardIssues(context),
  ];
  return issues.length === 0
    ? pass("login/captcha/ambiguity/review-required flows are wired through verify/gatedResult/phase-one boundaries, with marketplace hints and human-final-submit support")
    : fail("Review boundary check failed", issues.join("; "));
};

const pushMissingFieldIssue = (
  issues: string[],
  missingFields: string[],
  message: string,
): void => {
  if (missingFields.length > 0) issues.push(`${message}: ${missingFields.join(", ")}`);
};

const collectLaw010StructuredFieldIssues = (context: DomAutomationBinaryCheckContext): string[] => {
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
  pushMissingFieldIssue(issues, missingActionFields, "DomActionResultSchema is missing structured fields");
  pushMissingFieldIssue(issues, missingVerifyFields, "DomVerificationResultSchema is missing structured fields");
  pushMissingFieldIssue(issues, missingTaskFields, "AmazonInvoiceUploadTaskResult is missing structured fields");
  pushMissingFieldIssue(issues, missingRecordFields, "AmazonInvoiceUploadTaskRecord is missing persisted fields");
  return issues;
};

const collectLaw010PersistenceIssues = (context: DomAutomationBinaryCheckContext): string[] =>
  sourceText(context, "src/plugins/amazon-invoice-upload/amazon-invoice-upload-storage.ts").includes("JSON.stringify(record, null, 2)")
    ? []
    : ["Amazon task record is not persisted as a structured JSON record"];

const collectLaw010EvidenceCaptureIssues = (context: DomAutomationBinaryCheckContext): string[] => {
  const evidenceCaptureMissing = [
    "src/capabilities/dom-automation/runtime/dom-fill.ts",
    "src/capabilities/dom-automation/runtime/dom-click.ts",
    "src/capabilities/dom-automation/runtime/dom-upload.ts",
  ].filter((repoPath) => {
    const file = sourceFile(context, repoPath);
    return !file || !hasIdentifierCall(file, "captureDomEvidenceRef");
  });
  return evidenceCaptureMissing.length > 0
    ? [`DOM runtimes are missing evidence capture: ${evidenceCaptureMissing.join(", ")}`]
    : [];
};
const collectLaw010UploadClosureIssues = (context: DomAutomationBinaryCheckContext): string[] =>
  collectAmazonUploadClosureIssues({
    verifyFile: sourceFile(context, "src/plugins/amazon-invoice-upload/amazon-invoice-upload-verify.ts"),
    existingFile: sourceFile(context, "src/plugins/amazon-invoice-upload/amazon-invoice-upload-existing.ts"),
    stepsFile: sourceFile(context, "src/plugins/amazon-invoice-upload/amazon-invoice-upload-steps.ts"),
    snapshotFile: sourceFile(context, "src/capabilities/dom-automation/runtime/dom-snapshot.ts"),
    completeSmokeFile: sourceFile(context, "scripts/acceptance/amazon-invoice-upload-complete-smoke.ts"),
  });
const collectLaw010LogLeakIssues = (context: DomAutomationBinaryCheckContext): string[] => {
  const logViolations = forbiddenLogFields(context);
  return logViolations.length > 0 ? [`forbidden sensitive log field detected: ${logViolations[0]}`] : [];
};
export const checkLaw010EvidenceLogging = (context: DomAutomationBinaryCheckContext): ClauseCheckOutcome => {
  const issues = [
    ...collectLaw010StructuredFieldIssues(context),
    ...collectLaw010PersistenceIssues(context),
    ...collectLaw010EvidenceCaptureIssues(context),
    ...collectLaw010UploadClosureIssues(context),
    ...collectLaw010LogLeakIssues(context),
  ];
  return issues.length === 0 ? pass("DOM action/verification results and Amazon task records stay structured, persist evidence refs, and avoid sensitive log-field leakage") : fail("Evidence and logging check failed", issues.join("; "));
};
