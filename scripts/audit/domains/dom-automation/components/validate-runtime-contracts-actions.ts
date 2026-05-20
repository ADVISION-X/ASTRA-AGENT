import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import type { Finding } from "../../../core/schema.js";
import { getSourceFileAtRepoPath } from "./collect-dom-automation-project.js";
import type { DomAutomationAuditProject } from "./dom-automation-project-types.js";
import {
  hasIdentifierCall,
  hasPropertyAccess,
  hasSchemaParseCall,
  hasStaticText,
  hasStringLiteral,
  isNotEqualsCheck,
  parseResultObjectPropertyNames,
  runtimeFinding,
} from "./runtime-contract-support.js";

const actionEvidenceFindings = (...input: readonly [
  auditProject: DomAutomationAuditProject,
  repoPath: string,
  lawId: string,
  schemaName: string,
  inputSchemaName: string,
  extraChecks: Array<{ test: (sourceFile: SourceFile) => boolean; message: string; hint: string }>,
]): Finding[] => {
  const [auditProject, repoPath, lawId, schemaName, inputSchemaName, extraChecks] = input;
  const sourceFile = getSourceFileAtRepoPath(auditProject.project, repoPath);
  if (!sourceFile) return [runtimeFinding(lawId, repoPath, 1, "DOM action runtime file is missing", "Restore the DOM action runtime file.")];
  const findings: Finding[] = [];
  if (!hasSchemaParseCall(sourceFile, inputSchemaName)) findings.push(runtimeFinding(lawId, repoPath, 1, `${repoPath} does not parse ${inputSchemaName}`, "Parse the DOM action input through the governed schema."));
  const usesGovernedActionResultBuilder = hasIdentifierCall(sourceFile, "buildDomActionOutcome") || hasIdentifierCall(sourceFile, "buildDomActionResult");
  if (!hasSchemaParseCall(sourceFile, schemaName) && !usesGovernedActionResultBuilder) findings.push(runtimeFinding(lawId, repoPath, 1, `${repoPath} does not parse ${schemaName}`, "Parse the DOM action output through the governed schema or the shared governed action-result builder."));
  if (!hasPropertyAccess(sourceFile, "browser", "evaluateActiveTab")) findings.push(runtimeFinding(lawId, repoPath, 1, `${repoPath} does not use browser.evaluateActiveTab`, "Execute DOM action side effects through BrowserController.evaluateActiveTab."));
  const evidenceCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter((callExpression) => callExpression.getExpression().getText() === "captureDomEvidenceRef");
  if (evidenceCalls.length < 2) findings.push(runtimeFinding(lawId, repoPath, 1, `${repoPath} does not capture before and after DOM evidence`, "Capture evidence before and after successful DOM actions."));
  const hasEvidenceResult = usesGovernedActionResultBuilder || parseResultObjectPropertyNames(sourceFile, schemaName).some((names) => names.includes("beforeEvidenceRef") && names.includes("afterEvidenceRef"));
  if (!hasEvidenceResult) findings.push(runtimeFinding(lawId, repoPath, 1, `${repoPath} can report success without evidence refs`, "Return evidence refs on successful DOM actions or stop in review-required mode."));
  for (const check of extraChecks) if (!check.test(sourceFile)) findings.push(runtimeFinding(lawId, repoPath, 1, check.message, check.hint));
  return findings;
};

export const domFillFindings = (auditProject: DomAutomationAuditProject): Finding[] =>
  actionEvidenceFindings(auditProject, "src/capabilities/dom-automation/runtime/dom-fill.ts", "GRASSEYE-DOM-004-V1", "DomActionResultSchema", "FillDomElementInputSchema", [
    { test: (sf) => hasPropertyAccess(sf, "input.approvedText", "length"), message: "DOM fill does not inspect approvedText length", hint: "Reject empty approvedText before executing DOM input." },
    { test: (sf) => hasStaticText(sf, "password input is forbidden"), message: "DOM fill does not block password inputs", hint: "Stop DOM fill on password fields and enter review-required mode." },
  ]);

export const domClickFindings = (auditProject: DomAutomationAuditProject): Finding[] =>
  actionEvidenceFindings(auditProject, "src/capabilities/dom-automation/runtime/dom-click.ts", "GRASSEYE-DOM-005-V1", "DomActionResultSchema", "ClickDomElementInputSchema", [
    { test: (sf) => hasStringLiteral(sf, "dangerous DOM click requires human review"), message: "DOM click does not gate dangerous actions into review_required", hint: "Stop dangerous DOM clicks behind a human review gate." },
    { test: (sf) => hasStaticText(sf, "element is hidden") && hasStaticText(sf, "element is disabled"), message: "DOM click does not reject hidden or disabled elements", hint: "Reject hidden and disabled DOM click targets." },
    { test: (sf) => hasStaticText(sf, "el.value"), message: "DOM click expectedText proof ignores input.value", hint: "Include input.value when clicking input[type=submit|button] controls with visible value text." },
  ]);

const collectUploadSchemaFindings = (sourceFile: SourceFile, repoPath: string): Finding[] => {
  const findings: Finding[] = [];
  if (!hasSchemaParseCall(sourceFile, "UploadApprovedFileInputSchema")) {
    findings.push(runtimeFinding("GRASSEYE-DOM-006-V1", repoPath, 1, "DOM upload does not parse UploadApprovedFileInputSchema", "Parse approved upload input through the governed schema."));
  }
  for (const callName of ["existsSync", "statSync"]) {
    if (!hasIdentifierCall(sourceFile, callName)) {
      findings.push(runtimeFinding("GRASSEYE-DOM-006-V1", repoPath, 1, `DOM upload is missing ${callName} validation`, "Validate approved file existence and file type before upload."));
    }
  }
  return findings;
};

const collectUploadGuardFindings = (sourceFile: SourceFile, repoPath: string): Finding[] => {
  const findings: Finding[] = [];
  const validatesPath = sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((binaryExpression) => binaryExpression.getLeft().getText() === "approvedPath" && binaryExpression.getRight().getText() === "taskPath");
  if (!validatesPath) findings.push(runtimeFinding("GRASSEYE-DOM-006-V1", repoPath, 1, "DOM upload does not verify approvedFilePath against approvedTaskFilePath", "Reject arbitrary file paths during DOM upload."));
  if (!hasPropertyAccess(sourceFile, "input.allowedExtensions", "includes")) findings.push(runtimeFinding("GRASSEYE-DOM-006-V1", repoPath, 1, "DOM upload does not validate allowedExtensions", "Restrict upload to approved extensions only."));
  const validatesTarget = sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((expression) => isNotEqualsCheck(expression, "input.elementRef.targetKind", "file-input"));
  if (!validatesTarget) findings.push(runtimeFinding("GRASSEYE-DOM-006-V1", repoPath, 1, "DOM upload does not validate targetKind === file-input", "Upload only to governed file-input targets."));
  return findings;
};

const collectUploadExecutionFindings = (sourceFile: SourceFile, repoPath: string): Finding[] => {
  const findings: Finding[] = [];
  if (!hasPropertyAccess(sourceFile, "browser", "setFileInputFiles")) findings.push(runtimeFinding("GRASSEYE-DOM-006-V1", repoPath, 1, "DOM upload does not call browser.setFileInputFiles", "Complete upload closure must use the governed BrowserController file-input port."));
  if (hasStringLiteral(sourceFile, "not_implemented")) findings.push(runtimeFinding("GRASSEYE-DOM-006-V1", repoPath, 1, "DOM upload still returns not_implemented", "Complete upload closure must perform the approved file upload or fail/review with evidence."));
  const readsFileContent = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => ["readFile", "readFileSync"].includes(identifier.getText()));
  if (readsFileContent) findings.push(runtimeFinding("GRASSEYE-DOM-006-V1", repoPath, 1, "DOM upload reads file content", "Validate file metadata only; never read file body into AI/runtime payload."));
  return findings;
};

export const domUploadFindings = (auditProject: DomAutomationAuditProject): Finding[] => {
  const repoPath = "src/capabilities/dom-automation/runtime/dom-upload.ts";
  const sourceFile = getSourceFileAtRepoPath(auditProject.project, repoPath);
  if (!sourceFile) return [runtimeFinding("GRASSEYE-DOM-006-V1", repoPath, 1, "DOM upload runtime file is missing", "Restore the DOM upload runtime file.")];
  return [
    ...collectUploadSchemaFindings(sourceFile, repoPath),
    ...collectUploadGuardFindings(sourceFile, repoPath),
    ...collectUploadExecutionFindings(sourceFile, repoPath),
  ];
};
