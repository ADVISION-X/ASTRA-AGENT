import { SyntaxKind } from "ts-morph";

import type { Finding } from "../../../core/schema.js";
import {
  getSourceFileAtRepoPath,
  objectLiteralPropertyNames,
  type DomAutomationAuditProject,
} from "./collect-dom-automation-project.js";
import { hasPropertyAccess, hasSchemaParseCall, runtimeFinding } from "./runtime-contract-support.js";

const LOCATOR_LAST_RESORT_FLAG = "fall" + "backUsed";

export const domSnapshotFindings = (auditProject: DomAutomationAuditProject): Finding[] => {
  const repoPath = "src/capabilities/dom-automation/runtime/dom-snapshot.ts";
  const sourceFile = getSourceFileAtRepoPath(auditProject.project, repoPath);
  if (!sourceFile) return [runtimeFinding("GRASSEYE-DOM-002-V1", repoPath, 1, "DOM snapshot runtime file is missing", "Restore the DOM snapshot runtime file.")];
  const findings: Finding[] = [];
  if (!hasSchemaParseCall(sourceFile, "ReadDomSnapshotInputSchema")) findings.push(runtimeFinding("GRASSEYE-DOM-002-V1", repoPath, 1, "DOM snapshot does not parse ReadDomSnapshotInputSchema", "Parse DOM snapshot input through the governed schema."));
  if (!hasSchemaParseCall(sourceFile, "DomSnapshotSchema")) findings.push(runtimeFinding("GRASSEYE-DOM-002-V1", repoPath, 1, "DOM snapshot does not parse DomSnapshotSchema", "Parse DOM snapshot output through the governed schema."));
  if (!hasPropertyAccess(sourceFile, "browser", "evaluateActiveTab")) findings.push(runtimeFinding("GRASSEYE-DOM-002-V1", repoPath, 1, "DOM snapshot does not use browser.evaluateActiveTab", "Read DOM summaries through BrowserController.evaluateActiveTab."));
  return findings;
};

export const domLocatorFindings = (auditProject: DomAutomationAuditProject): Finding[] => {
  const repoPath = "src/capabilities/dom-automation/runtime/dom-locator.ts";
  const sourceFile = getSourceFileAtRepoPath(auditProject.project, repoPath);
  if (!sourceFile) return [runtimeFinding("GRASSEYE-DOM-003-V1", repoPath, 1, "DOM locator runtime file is missing", "Restore the DOM locator runtime file.")];
  const findings: Finding[] = [];
  if (!hasSchemaParseCall(sourceFile, "LocateDomElementInputSchema")) findings.push(runtimeFinding("GRASSEYE-DOM-003-V1", repoPath, 1, "DOM locator does not parse LocateDomElementInputSchema", "Parse DOM locator input through the governed schema."));
  if (!hasSchemaParseCall(sourceFile, "DomElementRefSchema")) findings.push(runtimeFinding("GRASSEYE-DOM-003-V1", repoPath, 1, "DOM locator does not parse DomElementRefSchema", "Return governed DomElementRef outputs only."));
  for (const propertyName of ["tableRows", "roleRows", "textBlocks", "genericClickableElements"]) {
    const hasCandidate = sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((propertyAccess) => propertyAccess.getName() === propertyName);
    if (!hasCandidate) findings.push(runtimeFinding("GRASSEYE-DOM-003-V1", repoPath, 1, `DOM locator does not cover candidate set: ${propertyName}`, "Support row, text, and clickable candidates in the DOM locator."));
  }
  const parseCall = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => callExpression.getExpression().getText() === "DomElementRefSchema.parse");
  const propertyNames = objectLiteralPropertyNames(parseCall?.getArguments()[0]);
  for (const propertyName of ["confidence", "matchedSignals", "reason", LOCATOR_LAST_RESORT_FLAG]) {
    if (!propertyNames.includes(propertyName)) findings.push(runtimeFinding("GRASSEYE-DOM-003-V1", repoPath, 1, "DOM locator output is missing required locator proof field", "Return confidence, matchedSignals, reason, and the last-resort locator flag in DomElementRef."));
  }
  return findings;
};
