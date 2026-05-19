import { Node, SyntaxKind } from "ts-morph";

import { createFinding } from "../../../core/result.js";
import type { Finding } from "../../../core/schema.js";
import {
  getSourceFileAtRepoPath,
  hasIdentifierCall,
  buildValidationResult,
  type DomAutomationAuditProject,
  type DomAutomationValidationResult,
} from "./collect-dom-automation-project.js";

const acceptanceFinding = (
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
  const handBuiltSnapshot = sourceFile.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression).some((objectLiteral) => {
    const text = objectLiteral.getText();
    return text.includes("forms") && text.includes("inputs") && text.includes("buttons") && text.includes("links") && text.includes("fileInputs") && text.includes("detectedStates");
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
  if (!hasIdentifierCall(sourceFile, "runAmazonInvoiceUploadPhaseOne")) {
    findings.push(acceptanceFinding("GRASSEYE-DOM-010-V1", repoPath, 1, "Amazon acceptance runtime does not call runAmazonInvoiceUploadPhaseOne", "Exercise the plugin entrypoint in Amazon dry-run acceptance."));
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

export const validateAcceptanceRuntime = (
  auditProject: DomAutomationAuditProject,
): DomAutomationValidationResult => {
  const findings = [
    ...validateDomAutomationAcceptance(auditProject),
    ...validateAmazonAcceptance(auditProject),
  ];
  return buildValidationResult({
    name: "acceptance-runtime",
    findings,
    coveredClauseIds: [
      "BLUEPRINT-10",
      "GRASSEYE-DOM-010-V1",
    ],
    passSummary: "acceptance runtime files exercise real DOM fixtures and the Amazon phase-one dry-run boundary.",
    failSummary: "acceptance runtime coverage is incomplete or not real-browser based.",
    failureClassification: "ENFORCEMENT GAP",
  });
};