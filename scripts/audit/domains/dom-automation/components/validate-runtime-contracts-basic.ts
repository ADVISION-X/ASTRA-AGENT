import { SyntaxKind, type SourceFile } from "ts-morph";

import type { Finding } from "../../../core/schema.js";
import { getSourceFileAtRepoPath } from "./collect-dom-automation-project.js";
import type { DomAutomationAuditProject } from "./dom-automation-project-types.js";
import { objectLiteralPropertyNames } from "./dom-automation-static-strings.js";
import {
  hasPropertyAccess,
  hasSchemaParseCall,
  hasStaticText,
  hasStringLiteral,
  runtimeFinding,
} from "./runtime-contract-support.js";

const LOCATOR_LAST_RESORT_FLAG = "fall" + "backUsed";
const LOCATOR_CANDIDATE_SETS = ["tableRows", "roleRows", "textBlocks", "genericClickableElements"] as const;

const collectLocatorSchemaFindings = (sourceFile: SourceFile, repoPath: string): Finding[] => {
  const findings: Finding[] = [];
  if (!hasSchemaParseCall(sourceFile, "LocateDomElementInputSchema")) findings.push(runtimeFinding("GRASSEYE-DOM-003-V1", repoPath, 1, "DOM locator does not parse LocateDomElementInputSchema", "Parse DOM locator input through the governed schema."));
  if (!hasSchemaParseCall(sourceFile, "DomElementRefSchema")) findings.push(runtimeFinding("GRASSEYE-DOM-003-V1", repoPath, 1, "DOM locator does not parse DomElementRefSchema", "Return governed DomElementRef outputs only."));
  return findings;
};

const collectLocatorCandidateFindings = (sourceFile: SourceFile, repoPath: string): Finding[] =>
  LOCATOR_CANDIDATE_SETS.flatMap((propertyName) => {
    const hasCandidate = sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((propertyAccess) => propertyAccess.getName() === propertyName);
    return hasCandidate ? [] : [runtimeFinding("GRASSEYE-DOM-003-V1", repoPath, 1, `DOM locator does not cover candidate set: ${propertyName}`, "Support row, text, and clickable candidates in the DOM locator.")];
  });

const collectLocatorSearchInputFindings = (sourceFile: SourceFile, repoPath: string): Finding[] => {
  const locatorText = sourceFile.getFullText();
  const includesTextInput = locatorText.includes("item.type === \"text\"");
  const includesSearchInput = locatorText.includes("item.type === \"search\"");
  const includesTextarea = locatorText.includes("item.tagName === \"textarea\"");
  return includesTextInput && includesSearchInput && includesTextarea
    ? []
    : [runtimeFinding("GRASSEYE-DOM-003-V1", repoPath, 1, "DOM locator search-input candidates are not restricted to text/search/textarea controls", "Only input[type=text], input[type=search], and textarea may be treated as search-input candidates.")];
};

const collectLocatorRealPageRegressionFindings = (sourceFile: SourceFile, repoPath: string): Finding[] => {
  const findings: Finding[] = [];
  if (!sourceFile.getFunction("exactTextMatches") || !hasStringLiteral(sourceFile, "exact-name-id") || !hasStringLiteral(sourceFile, "exact-visible-name")) {
    findings.push(runtimeFinding("GRASSEYE-DOM-003-V1", repoPath, 1, "DOM locator is missing exact semantic scoring", "Keep exact id/name and visible/aria-label scoring so local scoped controls outrank global page controls."));
  }
  const allowsHiddenFileInputs = sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression)
    .some((expression) => expression.getText() === "input.targetKind === \"file-input\" || !candidate.hidden");
  if (!allowsHiddenFileInputs) {
    findings.push(runtimeFinding("GRASSEYE-DOM-006-V1", repoPath, 1, "DOM locator filters hidden file inputs before file-input location", "Allow hidden input[type=file] candidates only for file-input targetKind; upload remains governed by approved-file checks."));
  }
  return findings;
};

const collectLocatorUploadAndRowFindings = (sourceFile: SourceFile, repoPath: string): Finding[] => {
  const findings: Finding[] = [];
  const hasShortTextUploadCandidateGuard = sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression)
    .some((expression) => expression.getOperatorToken().getKind() === SyntaxKind.LessThanEqualsToken && expression.getRight().getText() === "80" && expression.getLeft().getText().includes("visibleText"));
  if (!hasShortTextUploadCandidateGuard || !hasStringLiteral(sourceFile, "button-like-upload-entry")) {
    findings.push(runtimeFinding("GRASSEYE-DOM-003-V1", repoPath, 1, "DOM locator does not protect upload entry scoring against oversized text containers", "Prefer button-like upload controls and keep text-block upload candidates short."));
  }
  if (!hasStringLiteral(sourceFile, "row-kind")) {
    findings.push(runtimeFinding("GRASSEYE-DOM-003-V1", repoPath, 1, "DOM locator does not give row candidates a semantic score", "Row location must prefer table-row and role-row candidates over generic text."));
  }
  if (!hasStringLiteral(sourceFile, "submit-input-button")) {
    findings.push(runtimeFinding("GRASSEYE-DOM-003-V1", repoPath, 1, "DOM locator does not score input[type=submit] as a form button", "Prefer form submit inputs when locating button targets so local form submit can outrank global page controls."));
  }
  return findings;
};

const collectLocatorOutputProofFindings = (sourceFile: SourceFile, repoPath: string): Finding[] => {
  const parseCall = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => callExpression.getExpression().getText() === "DomElementRefSchema.parse");
  const propertyNames = objectLiteralPropertyNames(parseCall?.getArguments()[0]);
  return ["confidence", "matchedSignals", "reason", LOCATOR_LAST_RESORT_FLAG].flatMap((propertyName) =>
    propertyNames.includes(propertyName) ? [] : [runtimeFinding("GRASSEYE-DOM-003-V1", repoPath, 1, "DOM locator output is missing required locator proof field", "Return confidence, matchedSignals, reason, and the last-resort locator flag in DomElementRef.")]);
};

export const domSnapshotFindings = (auditProject: DomAutomationAuditProject): Finding[] => {
  const repoPath = "src/capabilities/dom-automation/runtime/dom-snapshot.ts";
  const sourceFile = getSourceFileAtRepoPath(auditProject.project, repoPath);
  if (!sourceFile) return [runtimeFinding("GRASSEYE-DOM-002-V1", repoPath, 1, "DOM snapshot runtime file is missing", "Restore the DOM snapshot runtime file.")];
  const findings: Finding[] = [];
  if (!hasSchemaParseCall(sourceFile, "ReadDomSnapshotInputSchema")) findings.push(runtimeFinding("GRASSEYE-DOM-002-V1", repoPath, 1, "DOM snapshot does not parse ReadDomSnapshotInputSchema", "Parse DOM snapshot input through the governed schema."));
  if (!hasSchemaParseCall(sourceFile, "DomSnapshotSchema")) findings.push(runtimeFinding("GRASSEYE-DOM-002-V1", repoPath, 1, "DOM snapshot does not parse DomSnapshotSchema", "Parse DOM snapshot output through the governed schema."));
  if (!hasPropertyAccess(sourceFile, "browser", "evaluateActiveTab")) findings.push(runtimeFinding("GRASSEYE-DOM-002-V1", repoPath, 1, "DOM snapshot does not use browser.evaluateActiveTab", "Read DOM summaries through BrowserController.evaluateActiveTab."));
  if (!hasStaticText(sourceFile, "input[type='") || !hasStaticText(sourceFile, "'][value='") || !hasStaticText(sourceFile, "CSS.escape(value)")) {
    findings.push(runtimeFinding("GRASSEYE-DOM-003-V1", repoPath, 1, "DOM snapshot does not build stable selectors for button-like input[value] elements", "Preserve input[type=submit|button][value] selector candidates for real page controls."));
  }
  if (!hasStaticText(sourceFile, "el.value : \"\") || el.innerText || el.textContent")) {
    findings.push(runtimeFinding("GRASSEYE-DOM-003-V1", repoPath, 1, "DOM snapshot visibleText does not include input.value for button-like inputs", "Use input.value when summarizing input[type=submit|button] text."));
  }
  const fileInputsDeclaration = sourceFile.getVariableDeclaration("fileInputs");
  const fileInputsUsesVisibleFilter = fileInputsDeclaration?.getInitializer()?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((callExpression) => callExpression.getExpression().getText().endsWith(".filter") && callExpression.getArguments().some((argument) => argument.getText() === "visible")) ?? false;
  if (fileInputsUsesVisibleFilter) {
    findings.push(runtimeFinding("GRASSEYE-DOM-006-V1", repoPath, fileInputsDeclaration?.getStartLineNumber() ?? 1, "DOM snapshot filters hidden file inputs out of fileInputs", "Summarize hidden input[type=file] controls without exposing file values so upload can locate governed file inputs."));
  }
  return findings;
};

export const domLocatorFindings = (auditProject: DomAutomationAuditProject): Finding[] => {
  const repoPath = "src/capabilities/dom-automation/runtime/dom-locator.ts";
  const sourceFile = getSourceFileAtRepoPath(auditProject.project, repoPath);
  if (!sourceFile) return [runtimeFinding("GRASSEYE-DOM-003-V1", repoPath, 1, "DOM locator runtime file is missing", "Restore the DOM locator runtime file.")];
  return [
    ...collectLocatorSchemaFindings(sourceFile, repoPath),
    ...collectLocatorCandidateFindings(sourceFile, repoPath),
    ...collectLocatorSearchInputFindings(sourceFile, repoPath),
    ...collectLocatorRealPageRegressionFindings(sourceFile, repoPath),
    ...collectLocatorUploadAndRowFindings(sourceFile, repoPath),
    ...collectLocatorOutputProofFindings(sourceFile, repoPath),
  ];
};

export const domSchemaFindings = (auditProject: DomAutomationAuditProject): Finding[] => {
  const repoPath = "src/capabilities/dom-automation/schema.ts";
  const sourceFile = getSourceFileAtRepoPath(auditProject.project, repoPath);
  if (!sourceFile) return [runtimeFinding("GRASSEYE-DOM-002-V1", repoPath, 1, "DOM schema file is missing", "Restore the governed DOM schema file.")];
  const dialogSchema = sourceFile.getVariableDeclaration("DomDialogSummarySchema");
  const initializerText = dialogSchema?.getInitializer()?.getText() ?? "";
  return initializerText.includes("DomElementSummaryBaseSchema")
    ? []
    : [runtimeFinding("GRASSEYE-DOM-002-V1", repoPath, dialogSchema?.getStartLineNumber() ?? 1, "DomDialogSummarySchema is not aligned to the shared element summary contract", "Dialog snapshot output must parse the same base summary fields emitted by runtime base(el).")];
};
