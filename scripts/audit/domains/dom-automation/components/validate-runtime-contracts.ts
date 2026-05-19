import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../../core/result.js";
import type { Finding } from "../../../core/schema.js";
import {
  getSourceFileAtRepoPath,
  objectLiteralPropertyNames,
  buildValidationResult,
  type DomAutomationAuditProject,
  type DomAutomationValidationResult,
} from "./collect-dom-automation-project.js";

const runtimeFinding = (
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

const LOCATOR_LAST_RESORT_FLAG = "fall" + "backUsed";

const hasSchemaParseCall = (sourceFile: SourceFile, schemaName: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isPropertyAccessExpression(expression)
      && expression.getExpression().getText() === schemaName
      && expression.getName() === "parse";
  });

const hasPropertyAccess = (sourceFile: SourceFile, text: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((propertyAccess) => propertyAccess.getText() === text);

const domSnapshotFindings = (auditProject: DomAutomationAuditProject): Finding[] => {
  const repoPath = "src/capabilities/dom-automation/runtime/dom-snapshot.ts";
  const sourceFile = getSourceFileAtRepoPath(auditProject.project, repoPath);
  if (!sourceFile) {
    return [runtimeFinding("GRASSEYE-DOM-002-V1", repoPath, 1, "DOM snapshot runtime file is missing", "Restore the DOM snapshot runtime file.")];
  }
  const findings: Finding[] = [];
  if (!hasSchemaParseCall(sourceFile, "ReadDomSnapshotInputSchema")) {
    findings.push(runtimeFinding("GRASSEYE-DOM-002-V1", repoPath, 1, "DOM snapshot does not parse ReadDomSnapshotInputSchema", "Parse DOM snapshot input through the governed schema."));
  }
  if (!hasSchemaParseCall(sourceFile, "DomSnapshotSchema")) {
    findings.push(runtimeFinding("GRASSEYE-DOM-002-V1", repoPath, 1, "DOM snapshot does not parse DomSnapshotSchema", "Parse DOM snapshot output through the governed schema."));
  }
  if (!hasPropertyAccess(sourceFile, "browser.evaluateActiveTab")) {
    findings.push(runtimeFinding("GRASSEYE-DOM-002-V1", repoPath, 1, "DOM snapshot does not use browser.evaluateActiveTab", "Read DOM summaries through BrowserController.evaluateActiveTab."));
  }
  return findings;
};

const domLocatorFindings = (auditProject: DomAutomationAuditProject): Finding[] => {
  const repoPath = "src/capabilities/dom-automation/runtime/dom-locator.ts";
  const sourceFile = getSourceFileAtRepoPath(auditProject.project, repoPath);
  if (!sourceFile) {
    return [runtimeFinding("GRASSEYE-DOM-003-V1", repoPath, 1, "DOM locator runtime file is missing", "Restore the DOM locator runtime file.")];
  }
  const findings: Finding[] = [];
  if (!hasSchemaParseCall(sourceFile, "LocateDomElementInputSchema")) {
    findings.push(runtimeFinding("GRASSEYE-DOM-003-V1", repoPath, 1, "DOM locator does not parse LocateDomElementInputSchema", "Parse DOM locator input through the governed schema."));
  }
  if (!hasSchemaParseCall(sourceFile, "DomElementRefSchema")) {
    findings.push(runtimeFinding("GRASSEYE-DOM-003-V1", repoPath, 1, "DOM locator does not parse DomElementRefSchema", "Return governed DomElementRef outputs only."));
  }
  const requiredCandidateProperties = ["tableRows", "roleRows", "textBlocks", "genericClickableElements"];
  for (const propertyName of requiredCandidateProperties) {
    if (!sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((propertyAccess) => propertyAccess.getName() === propertyName)) {
      findings.push(runtimeFinding("GRASSEYE-DOM-003-V1", repoPath, 1, `DOM locator does not cover candidate set: ${propertyName}`, "Support row, text, and clickable candidates in the DOM locator."));
    }
  }
  const parseCall = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isPropertyAccessExpression(expression)
      && expression.getExpression().getText() === "DomElementRefSchema"
      && expression.getName() === "parse";
  });
  const propertyNames = objectLiteralPropertyNames(parseCall?.getArguments()[0]);
  for (const propertyName of ["confidence", "matchedSignals", "reason", LOCATOR_LAST_RESORT_FLAG]) {
    if (!propertyNames.includes(propertyName)) {
      findings.push(runtimeFinding("GRASSEYE-DOM-003-V1", repoPath, 1, "DOM locator output is missing required last-resort locator flag", "Return confidence, matchedSignals, reason, and the last-resort locator flag in DomElementRef."));
    }
  }
  return findings;
};

const domActionResultEvidenceFindings = (
  auditProject: DomAutomationAuditProject,
  repoPath: string,
  lawId: string,
  schemaName: string,
  inputSchemaName: string,
  extraChecks: Array<{ test: (sourceFile: SourceFile) => boolean; message: string; hint: string }>,
): Finding[] => {
  const sourceFile = getSourceFileAtRepoPath(auditProject.project, repoPath);
  if (!sourceFile) {
    return [runtimeFinding(lawId, repoPath, 1, "DOM action runtime file is missing", "Restore the DOM action runtime file.")];
  }
  const findings: Finding[] = [];
  if (!hasSchemaParseCall(sourceFile, inputSchemaName)) {
    findings.push(runtimeFinding(lawId, repoPath, 1, `${repoPath} does not parse ${inputSchemaName}`, "Parse the DOM action input through the governed schema."));
  }
  if (!hasSchemaParseCall(sourceFile, schemaName)) {
    findings.push(runtimeFinding(lawId, repoPath, 1, `${repoPath} does not parse ${schemaName}`, "Parse the DOM action output through the governed schema."));
  }
  if (!hasPropertyAccess(sourceFile, "browser.evaluateActiveTab")) {
    findings.push(runtimeFinding(lawId, repoPath, 1, `${repoPath} does not use browser.evaluateActiveTab`, "Execute DOM action side effects through BrowserController.evaluateActiveTab."));
  }
  const evidenceCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === "captureDomEvidenceRef";
  });
  if (evidenceCalls.length < 2) {
    findings.push(runtimeFinding(lawId, repoPath, 1, `${repoPath} does not capture before and after DOM evidence`, "Capture evidence before and after successful DOM actions."));
  }
  const parseCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isPropertyAccessExpression(expression)
      && expression.getExpression().getText() === schemaName
      && expression.getName() === "parse";
  });
  const hasEvidenceResult = parseCalls.some((callExpression) => {
    const propertyNames = objectLiteralPropertyNames(callExpression.getArguments()[0]);
    return propertyNames.includes("beforeEvidenceRef") && propertyNames.includes("afterEvidenceRef");
  });
  if (!hasEvidenceResult) {
    findings.push(runtimeFinding(lawId, repoPath, 1, `${repoPath} can report success without beforeEvidenceRef and afterEvidenceRef`, "Return evidence refs on successful DOM actions or stop in review-required mode."));
  }
  for (const check of extraChecks) {
    if (!check.test(sourceFile)) {
      findings.push(runtimeFinding(lawId, repoPath, 1, check.message, check.hint));
    }
  }
  return findings;
};

const domUploadFindings = (auditProject: DomAutomationAuditProject): Finding[] => {
  const repoPath = "src/capabilities/dom-automation/runtime/dom-upload.ts";
  const sourceFile = getSourceFileAtRepoPath(auditProject.project, repoPath);
  if (!sourceFile) {
    return [runtimeFinding("GRASSEYE-DOM-006-V1", repoPath, 1, "DOM upload runtime file is missing", "Restore the DOM upload runtime file.")];
  }
  const findings: Finding[] = [];
  if (!hasSchemaParseCall(sourceFile, "UploadApprovedFileInputSchema")) {
    findings.push(runtimeFinding("GRASSEYE-DOM-006-V1", repoPath, 1, "DOM upload does not parse UploadApprovedFileInputSchema", "Parse approved upload input through the governed schema."));
  }
  for (const callName of ["existsSync", "statSync"]) {
    if (!sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
      const expression = callExpression.getExpression();
      return Node.isIdentifier(expression) && expression.getText() === callName;
    })) {
      findings.push(runtimeFinding("GRASSEYE-DOM-006-V1", repoPath, 1, `DOM upload is missing ${callName} validation`, "Validate approved file existence and file type before upload."));
    }
  }
  if (!sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((binaryExpression) => binaryExpression.getText().includes("approvedPath !== taskPath"))) {
    findings.push(runtimeFinding("GRASSEYE-DOM-006-V1", repoPath, 1, "DOM upload does not verify approvedFilePath against approvedTaskFilePath", "Reject arbitrary file paths during DOM upload."));
  }
  if (!sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((propertyAccess) => propertyAccess.getText() === "input.allowedExtensions.includes")) {
    findings.push(runtimeFinding("GRASSEYE-DOM-006-V1", repoPath, 1, "DOM upload does not validate allowedExtensions", "Restrict upload to approved extensions only."));
  }
  if (!sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((binaryExpression) => binaryExpression.getText().includes('input.elementRef.targetKind !== "file-input"'))) {
    findings.push(runtimeFinding("GRASSEYE-DOM-006-V1", repoPath, 1, "DOM upload does not validate targetKind === file-input", "Upload only to governed file-input targets."));
  }
  const parseCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isPropertyAccessExpression(expression)
      && expression.getExpression().getText() === "DomActionResultSchema"
      && expression.getName() === "parse";
  });
  const hasGovernedPending = parseCalls.some((callExpression) => {
    const propertyNames = objectLiteralPropertyNames(callExpression.getArguments()[0]);
    return propertyNames.includes("status") && propertyNames.includes("reviewRequiredReason");
  });
  if (!hasGovernedPending || !sourceFile.getFullText().includes('status: "not_implemented"')) {
    findings.push(runtimeFinding("GRASSEYE-DOM-006-V1", repoPath, 1, "DOM upload does not stay in governed pending mode for phase one", "Phase-one upload must stop in not_implemented or review_required mode, never success."));
  }
  return findings;
};

const domVerifyFindings = (auditProject: DomAutomationAuditProject): Finding[] => {
  const repoPath = "src/capabilities/dom-automation/runtime/dom-verify.ts";
  const sourceFile = getSourceFileAtRepoPath(auditProject.project, repoPath);
  if (!sourceFile) {
    return [runtimeFinding("GRASSEYE-DOM-007-V1", repoPath, 1, "DOM verify runtime file is missing", "Restore the DOM verify runtime file.")];
  }
  const findings: Finding[] = [];
  if (!hasSchemaParseCall(sourceFile, "VerifyDomStateInputSchema")) {
    findings.push(runtimeFinding("GRASSEYE-DOM-007-V1", repoPath, 1, "DOM verify does not parse VerifyDomStateInputSchema", "Parse DOM verification input through the governed schema."));
  }
  if (!hasSchemaParseCall(sourceFile, "DomVerificationResultSchema")) {
    findings.push(runtimeFinding("GRASSEYE-DOM-007-V1", repoPath, 1, "DOM verify does not parse DomVerificationResultSchema", "Parse DOM verification output through the governed schema."));
  }
  for (const statusName of ["login_required", "captcha_or_2fa_required", "not_found"]) {
    if (!sourceFile.getFullText().includes(`status: "${statusName}"`)) {
      findings.push(runtimeFinding("GRASSEYE-DOM-007-V1", repoPath, 1, `DOM verify does not explicitly return ${statusName}`, "Emit explicit verification statuses for login, captcha, and missing states."));
    }
  }
  return findings;
};

const domWaitFindings = (auditProject: DomAutomationAuditProject): Finding[] => {
  const repoPath = "src/capabilities/dom-automation/runtime/dom-wait.ts";
  const sourceFile = getSourceFileAtRepoPath(auditProject.project, repoPath);
  if (!sourceFile) {
    return [runtimeFinding("GRASSEYE-DOM-007-V1", repoPath, 1, "DOM wait runtime file is missing", "Restore the DOM wait runtime file.")];
  }
  const findings: Finding[] = [];
  if (!hasSchemaParseCall(sourceFile, "WaitForDomStateInputSchema")) {
    findings.push(runtimeFinding("GRASSEYE-DOM-007-V1", repoPath, 1, "DOM wait does not parse WaitForDomStateInputSchema", "Parse DOM wait input through the governed schema."));
  }
  const whileLoop = sourceFile.getFirstDescendantByKind(SyntaxKind.WhileStatement);
  if (!whileLoop) {
    findings.push(runtimeFinding("GRASSEYE-DOM-007-V1", repoPath, 1, "DOM wait lacks bounded polling loop", "Use a bounded while loop for DOM wait polling."));
  } else {
    const loopText = whileLoop.getText();
    if (!loopText.includes("readDomSnapshotOnce(browser)")) {
      findings.push(runtimeFinding("GRASSEYE-DOM-007-V1", repoPath, whileLoop.getStartLineNumber(), "DOM wait reuses one snapshot instead of rereading the page", "Refresh DOM snapshot inside the wait loop before re-verification."));
    }
    if (!loopText.includes("browser.wait(input.pollIntervalMs)")) {
      findings.push(runtimeFinding("GRASSEYE-DOM-007-V1", repoPath, whileLoop.getStartLineNumber(), "DOM wait does not respect pollIntervalMs", "Use browser.wait(input.pollIntervalMs) between DOM polls."));
    }
  }
  return findings;
};

export const validateRuntimeContracts = (
  auditProject: DomAutomationAuditProject,
): DomAutomationValidationResult => {
  const findings = [
    ...domSnapshotFindings(auditProject),
    ...domLocatorFindings(auditProject),
    ...domActionResultEvidenceFindings(auditProject, "src/capabilities/dom-automation/runtime/dom-fill.ts", "GRASSEYE-DOM-004-V1", "DomActionResultSchema", "FillDomElementInputSchema", [
      {
        test: (sourceFile) => sourceFile.getFullText().includes("input.approvedText.length === 0"),
        message: "DOM fill does not reject empty approvedText",
        hint: "Reject empty approvedText before executing DOM input.",
      },
      {
        test: (sourceFile) => sourceFile.getFullText().includes("password input is forbidden"),
        message: "DOM fill does not block password inputs",
        hint: "Stop DOM fill on password fields and enter review-required mode.",
      },
    ]),
    ...domActionResultEvidenceFindings(auditProject, "src/capabilities/dom-automation/runtime/dom-click.ts", "GRASSEYE-DOM-005-V1", "DomActionResultSchema", "ClickDomElementInputSchema", [
      {
        test: (sourceFile) => sourceFile.getFullText().includes("dangerous DOM click requires human review"),
        message: "DOM click does not gate dangerous actions into review_required",
        hint: "Stop dangerous DOM clicks behind a human review gate.",
      },
      {
        test: (sourceFile) => sourceFile.getFullText().includes("element is hidden") && sourceFile.getFullText().includes("element is disabled"),
        message: "DOM click does not reject hidden or disabled elements",
        hint: "Reject hidden and disabled DOM click targets.",
      },
    ]),
    ...domUploadFindings(auditProject),
    ...domVerifyFindings(auditProject),
    ...domWaitFindings(auditProject),
  ];

  return buildValidationResult({
    name: "runtime-contracts",
    findings,
    coveredClauseIds: [
      "GRASSEYE-DOM-002-V1",
      "GRASSEYE-DOM-003-V1",
      "GRASSEYE-DOM-004-V1",
      "GRASSEYE-DOM-005-V1",
      "GRASSEYE-DOM-006-V1",
      "GRASSEYE-DOM-007-V1",
      "BLUEPRINT-04",
    ],
    passSummary: "DOM runtime files enforce schema-validated inputs, governed outputs, evidence refs, and bounded wait behavior.",
    failSummary: "DOM runtime contracts are incomplete or drift from the law.",
  });
};