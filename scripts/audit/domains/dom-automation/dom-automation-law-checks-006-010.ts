import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import type { ClauseCheckOutcome, DomAutomationBinaryCheckContext } from "./dom-automation-binary-types.js";
import { pass, fail } from "./dom-automation-binary-outcome.js";
import { PLUGIN_CONSUMER_ROOTS } from "./dom-automation-binary-constants.js";
import { BROWSER_CONTROLLER_PATH, CURRENT_CHROME_PATH } from "./dom-automation-path-constants.js";
import { collectStringLiteralNodes } from "./components/dom-automation-static-strings.js";
import { findForbiddenImports, sourceText } from "./dom-automation-source-helpers.js";
import { domCoreContainsBusinessVocabulary, forbiddenLogFields, usesForbiddenPluginPrimitives } from "./dom-automation-policy-helpers.js";
import { classMethods, hasFields, hasIdentifierCall, interfaceMethods, sourceFile, variableFields } from "./dom-automation-shape-helpers.js";

const fileHasStaticStringToken = (file: SourceFile | null, token: string): boolean =>
  Boolean(file && (file.getFullText().includes(token) || collectStringLiteralNodes(file).some((literal) => literal.text.includes(token))));

const anyFileHasStaticStringToken = (files: readonly (SourceFile | null)[], token: string): boolean =>
  files.some((file) => fileHasStaticStringToken(file, token));

const collectVerificationResultStatuses = (file: SourceFile | null): Set<string> => {
  const statuses = new Set<string>();
  file?.getDescendantsOfKind(SyntaxKind.CallExpression).forEach((callExpression) => {
    const expression = callExpression.getExpression();
    const firstArgument = callExpression.getArguments()[0];
    if (Node.isIdentifier(expression) && expression.getText() === "buildDomVerificationResult" && Node.isStringLiteral(firstArgument)) {
      statuses.add(firstArgument.getLiteralText());
    }
  });
  file?.getDescendantsOfKind(SyntaxKind.PropertyAssignment).forEach((property) => {
    if (property.getName() !== "status") return;
    const initializer = property.getInitializer();
    if (Node.isStringLiteral(initializer)) statuses.add(initializer.getLiteralText());
  });
  return statuses;
};

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
  for (const token of ["review_required", "targetKind !== \"file-input\""]) {
    if (!anyFileHasStaticStringToken(reviewFiles, token)) {
      issues.push(`review-boundary logic is missing guard: ${token}`);
    }
  }
  if (!fileHasStaticStringToken(domClickFile, "dangerous DOM click requires human review")) {
    issues.push("review-boundary logic is missing guard: dangerous DOM click requires human review");
  }
  return issues;
};

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

const collectLaw008PathIssues = (): string[] => [];

const collectLaw008ImportIssues = (context: DomAutomationBinaryCheckContext): string[] => {
  const forbiddenImports = PLUGIN_CONSUMER_ROOTS.flatMap((pluginRoot) =>
    findForbiddenImports(context, pluginRoot, ["src/capabilities/dom-automation/runtime", CURRENT_CHROME_PATH, "src/lib/local-runtime"]));
  return forbiddenImports.length > 0
    ? [`plugin imports forbidden private implementation: ${forbiddenImports[0]}`]
    : [];
};

const collectLaw008FacadeIssues = (context: DomAutomationBinaryCheckContext): string[] => {
  const pluginFacadeBypass = usesForbiddenPluginPrimitives(context);
  return pluginFacadeBypass.length > 0
    ? [`plugin bypasses DOM facade: ${pluginFacadeBypass[0]}`]
    : [];
};

const collectLaw008BoundaryIssues = (context: DomAutomationBinaryCheckContext): string[] => {
  const issues: string[] = [];
  const domVocabulary = domCoreContainsBusinessVocabulary(context);
  const firstDomVocabularyViolation = domVocabulary[0];
  if (firstDomVocabularyViolation) {
    issues.push(firstDomVocabularyViolation);
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
    ...collectLaw008ImportIssues(context),
    ...collectLaw008BoundaryIssues(context),
    ...collectLaw008FacadeIssues(context),
  ];
  return issues.length === 0
    ? pass("DOM owner stays in src/capabilities/dom-automation and plugin consumers avoid browser/runtime primitive bypasses")
    : fail("Plugin boundary check failed", issues.join("; "));
};

export const checkLaw009ReviewBoundary = (context: DomAutomationBinaryCheckContext): ClauseCheckOutcome => {
  const verifyFile = sourceFile(context, "src/capabilities/dom-automation/runtime/dom-verify.ts");
  const uploadFile = sourceFile(context, "src/capabilities/dom-automation/runtime/dom-upload.ts");
  const domClickFile = sourceFile(context, "src/capabilities/dom-automation/runtime/dom-click.ts");
  const reviewFiles = [verifyFile, uploadFile, domClickFile] as const;
  const issues = [
    ...collectReviewTokenIssues(reviewFiles),
    ...collectReviewGuardIssues(reviewFiles, domClickFile),
  ];
  return issues.length === 0
    ? pass("DOM core review-required boundaries cover login, captcha, ambiguity, missing file input, and dangerous click states")
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
  const missingActionFields = hasFields(actionFields, ["ok", "status", "actionId", "message", "beforeEvidenceRef", "afterEvidenceRef", "reviewRequiredReason"]);
  const missingVerifyFields = hasFields(verifyFields, ["status", "confidence", "evidenceRef", "reason"]);
  pushMissingFieldIssue(issues, missingActionFields, "DomActionResultSchema is missing structured fields");
  pushMissingFieldIssue(issues, missingVerifyFields, "DomVerificationResultSchema is missing structured fields");
  return issues;
};

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
const collectLaw010LogLeakIssues = (context: DomAutomationBinaryCheckContext): string[] => {
  const logViolations = forbiddenLogFields(context);
  return logViolations.length > 0 ? [`forbidden sensitive log field detected: ${logViolations[0]}`] : [];
};

export const checkLaw010EvidenceLogging = (context: DomAutomationBinaryCheckContext): ClauseCheckOutcome => {
  const issues = [
    ...collectLaw010StructuredFieldIssues(context),
    ...collectLaw010EvidenceCaptureIssues(context),
    ...collectLaw010LogLeakIssues(context),
  ];
  return issues.length === 0 ? pass("DOM action and verification results stay structured, persist evidence refs, and avoid sensitive log-field leakage") : fail("Evidence and logging check failed", issues.join("; "));
};
