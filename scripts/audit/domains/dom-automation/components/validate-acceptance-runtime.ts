import { Node, SyntaxKind } from "ts-morph";

import { createFinding } from "../../../core/result.js";
import type { Finding } from "../../../core/schema.js";
import { getSourceFileAtRepoPath } from "./collect-dom-automation-project.js";
import type { DomAutomationAuditProject, DomAutomationValidationResult } from "./dom-automation-project-types.js";
import { hasIdentifierCall, objectLiteralPropertyNames } from "./dom-automation-static-strings.js";
import { buildValidationResult } from "./dom-automation-validation-result.js";

const acceptanceFinding = (...input: readonly [
  lawId: string,
  file: string,
  line: number,
  message: string,
  hint: string,
]): Finding => {
  const [lawId, file, line, message, hint] = input;
  return createFinding({ lawId, file, line, severity: "fatal", message, hint });
};

const validateDomAutomationAcceptance = (
  auditProject: DomAutomationAuditProject,
): Finding[] => {
  const repoPath = "scripts/acceptance/dom-automation-smoke.ts";
  const sourceFile = getSourceFileAtRepoPath(auditProject.project, repoPath);
  if (!sourceFile) {
    return [acceptanceFinding("GRASSEYE-DOM-010-V1", repoPath, 1, "DOM acceptance smoke file is missing", "Restore the DOM acceptance smoke command." )];
  }
  const findings: Finding[] = [];
  const usesRealBrowser = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => callExpression.getExpression().getText() === "chromium.launch");
  if (!usesRealBrowser) {
    findings.push(acceptanceFinding("GRASSEYE-DOM-010-V1", repoPath, 1, "DOM acceptance runtime does not launch a real browser fixture", "Use Playwright chromium or CurrentChrome in DOM acceptance."));
  }
  for (const callName of [
    "readDomSnapshotOnce",
    "locateDomElementOnce",
    "fillDomElementOnce",
    "clickDomElementOnce",
    "uploadApprovedFileOnce",
    "verifyDomStateOnce",
    "waitForDomStateOnce",
  ]) {
    if (!hasIdentifierCall(sourceFile, callName)) {
      findings.push(acceptanceFinding("GRASSEYE-DOM-010-V1", repoPath, 1, `DOM acceptance runtime does not call ${callName}`, "Exercise every governed DOM ability in the acceptance runtime."));
    }
  }
  const snapshotFields = ["forms", "inputs", "buttons", "links", "fileInputs", "detectedStates"];
  const handBuiltSnapshot = sourceFile.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)
    .some((objectLiteral) => {
      const propertyNames = objectLiteralPropertyNames(objectLiteral);
      return snapshotFields.every((field) => propertyNames.includes(field));
    });
  if (handBuiltSnapshot) {
    findings.push(acceptanceFinding("GRASSEYE-DOM-010-V1", repoPath, 1, "DOM acceptance runtime hand-builds a DomSnapshot instead of reading the page", "Use readDomSnapshotOnce against a real page instead of fixed snapshots."));
  }
  return findings;
};

const validateAmazonAcceptance = (
  auditProject: DomAutomationAuditProject,
): Finding[] => {
  const repoPath = "scripts/acceptance/amazon-invoice-upload-smoke.ts";
  const sourceFile = getSourceFileAtRepoPath(auditProject.project, repoPath);
  if (!sourceFile) {
    return [acceptanceFinding("GRASSEYE-DOM-010-V1", repoPath, 1, "Amazon acceptance smoke file is missing", "Restore the Amazon invoice upload smoke command." )];
  }
  const findings: Finding[] = [];
  if (!hasIdentifierCall(sourceFile, "runAmazonInvoiceUpload")) {
    findings.push(acceptanceFinding("GRASSEYE-DOM-010-V1", repoPath, 1, "Amazon acceptance runtime does not call runAmazonInvoiceUpload", "Exercise the complete plugin entrypoint in Amazon dry-run acceptance."));
  }
  if (!hasIdentifierCall(sourceFile, "pathToFileURL")) {
    findings.push(acceptanceFinding("GRASSEYE-DOM-010-V1", repoPath, 1, "Amazon acceptance runtime does not prove local dry-run URL usage", "Keep Amazon acceptance on a local file URL fixture instead of a real Amazon host."));
  }
  const hasRealAmazonUrl = sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).some((literal) => /https?:\/\/.+amazon\./iu.test(literal.getLiteralText()));
  if (hasRealAmazonUrl) {
    findings.push(acceptanceFinding("GRASSEYE-DOM-010-V1", repoPath, 1, "Amazon acceptance runtime points at a real Amazon URL", "Keep acceptance runtime on local dry-run fixtures only."));
  }
  return findings;
};

const validateAmazonCompleteAcceptance = (
  auditProject: DomAutomationAuditProject,
): Finding[] => {
  const repoPath = "scripts/acceptance/amazon-invoice-upload-complete-smoke.ts";
  const sourceFile = getSourceFileAtRepoPath(auditProject.project, repoPath);
  if (!sourceFile) {
    return [acceptanceFinding("GRASSEYE-DOM-010-V1", repoPath, 1, "Amazon complete acceptance smoke file is missing", "Add the complete multipart upload smoke to prove API-to-plugin closure." )];
  }
  const findings: Finding[] = [];
  for (const callName of ["FormData", "fetch", "startAmazonInvoiceUploadTask", "getAmazonInvoiceUploadTaskStatus"]) {
    if (!hasIdentifierCall(sourceFile, callName) && !sourceFile.getText().includes(callName)) {
      findings.push(acceptanceFinding("GRASSEYE-DOM-010-V1", repoPath, 1, `Amazon complete acceptance does not exercise ${callName}`, "Prove multipart API receipt, approved-file save, task execution, and status readback."));
    }
  }
  if (!sourceFile.getText().includes("upload_success")) {
    findings.push(acceptanceFinding("GRASSEYE-DOM-010-V1", repoPath, 1, "Amazon complete acceptance does not assert upload_success", "Complete smoke must fail unless the task returns upload_success."));
  }
  return findings;
};

const validateAcceptanceRuntime = (
  auditProject: DomAutomationAuditProject,
): DomAutomationValidationResult => {
  const findings = [
    ...validateDomAutomationAcceptance(auditProject),
    ...validateAmazonAcceptance(auditProject),
    ...validateAmazonCompleteAcceptance(auditProject),
  ];
  return buildValidationResult({
    name: "acceptance-runtime",
    findings,
    coveredClauseIds: [
      "BLUEPRINT-10",
      "GRASSEYE-DOM-010-V1",
    ],
    passSummary: "acceptance runtime files exercise real DOM fixtures and complete Amazon multipart upload closure.",
    failSummary: "acceptance runtime coverage is incomplete or not real-browser based.",
    failureClassification: "ENFORCEMENT GAP",
  });
};
