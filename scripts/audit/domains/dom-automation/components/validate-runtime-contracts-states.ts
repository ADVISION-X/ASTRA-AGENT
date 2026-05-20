import { Node, SyntaxKind } from "ts-morph";

import type { Finding } from "../../../core/schema.js";
import { getSourceFileAtRepoPath } from "./collect-dom-automation-project.js";
import type { DomAutomationAuditProject } from "./dom-automation-project-types.js";
import { hasPropertyAccess, hasSchemaParseCall, hasStringLiteral, runtimeFinding } from "./runtime-contract-support.js";

export const domVerifyFindings = (auditProject: DomAutomationAuditProject): Finding[] => {
  const repoPath = "src/capabilities/dom-automation/runtime/dom-verify.ts";
  const sourceFile = getSourceFileAtRepoPath(auditProject.project, repoPath);
  if (!sourceFile) return [runtimeFinding("GRASSEYE-DOM-007-V1", repoPath, 1, "DOM verify runtime file is missing", "Restore the DOM verify runtime file.")];
  const findings: Finding[] = [];
  if (!hasSchemaParseCall(sourceFile, "VerifyDomStateInputSchema")) findings.push(runtimeFinding("GRASSEYE-DOM-007-V1", repoPath, 1, "DOM verify does not parse VerifyDomStateInputSchema", "Parse DOM verification input through the governed schema."));
  if (!hasSchemaParseCall(sourceFile, "DomVerificationResultSchema")) findings.push(runtimeFinding("GRASSEYE-DOM-007-V1", repoPath, 1, "DOM verify does not parse DomVerificationResultSchema", "Parse DOM verification output through the governed schema."));
  for (const statusName of ["login_required", "captcha_or_2fa_required", "not_found"]) {
    if (!hasStringLiteral(sourceFile, statusName)) findings.push(runtimeFinding("GRASSEYE-DOM-007-V1", repoPath, 1, `DOM verify does not explicitly return ${statusName}`, "Emit explicit verification statuses for login, captcha, and missing states."));
  }
  return findings;
};

export const domWaitFindings = (auditProject: DomAutomationAuditProject): Finding[] => {
  const repoPath = "src/capabilities/dom-automation/runtime/dom-wait.ts";
  const sourceFile = getSourceFileAtRepoPath(auditProject.project, repoPath);
  if (!sourceFile) return [runtimeFinding("GRASSEYE-DOM-007-V1", repoPath, 1, "DOM wait runtime file is missing", "Restore the DOM wait runtime file.")];
  const findings: Finding[] = [];
  if (!hasSchemaParseCall(sourceFile, "WaitForDomStateInputSchema")) findings.push(runtimeFinding("GRASSEYE-DOM-007-V1", repoPath, 1, "DOM wait does not parse WaitForDomStateInputSchema", "Parse DOM wait input through the governed schema."));
  const whileLoop = sourceFile.getFirstDescendantByKind(SyntaxKind.WhileStatement);
  if (!whileLoop) {
    findings.push(runtimeFinding("GRASSEYE-DOM-007-V1", repoPath, 1, "DOM wait lacks bounded polling loop", "Use a bounded while loop for DOM wait polling."));
    return findings;
  }
  const loopCalls = whileLoop.getDescendantsOfKind(SyntaxKind.CallExpression);
  const rereadsSnapshot = loopCalls.some((call) => Node.isIdentifier(call.getExpression()) && call.getExpression().getText() === "readDomSnapshotOnce");
  if (!rereadsSnapshot) findings.push(runtimeFinding("GRASSEYE-DOM-007-V1", repoPath, whileLoop.getStartLineNumber(), "DOM wait reuses one snapshot instead of rereading the page", "Refresh DOM snapshot inside the wait loop before re-verification."));
  if (!hasPropertyAccess(whileLoop.getSourceFile(), "browser", "wait")) findings.push(runtimeFinding("GRASSEYE-DOM-007-V1", repoPath, whileLoop.getStartLineNumber(), "DOM wait does not call browser.wait", "Use browser.wait(input.pollIntervalMs) between DOM polls."));
  return findings;
};
