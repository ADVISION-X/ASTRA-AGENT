import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorFinding } from "../../shared/inspector-contracts.js";

const literalValues = (node: Node): Set<string> =>
  new Set([
    ...node.getDescendantsOfKind(SyntaxKind.StringLiteral).map((item) => item.getLiteralText()),
    ...node.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((item) => item.getLiteralText()),
    ...node.getDescendantsOfKind(SyntaxKind.TemplateHead).map((item) => item.getLiteralText()),
    ...node.getDescendantsOfKind(SyntaxKind.TemplateMiddle).map((item) => item.getLiteralText()),
    ...node.getDescendantsOfKind(SyntaxKind.TemplateTail).map((item) => item.getLiteralText()),
  ]);

const hasCallNamed = (node: Node, name: string): boolean =>
  node.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    const expression = call.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === name;
  });

const ifConditionHasCallNamed = (node: Node, name: string): boolean =>
  node.getDescendantsOfKind(SyntaxKind.IfStatement).some((statement) => hasCallNamed(statement.getExpression(), name));

const ifConditionHasLiteral = (node: Node, literal: string): boolean =>
  node.getDescendantsOfKind(SyntaxKind.IfStatement).some((statement) => literalValues(statement.getExpression()).has(literal));

const embeddedScripts = (node: Node): string[] =>
  [...literalValues(node)].filter((value) => value.includes("document.querySelector"));

const functionLikeNode = (file: SourceFile | null, name: string): Node | undefined => {
  const functionDeclaration = file?.getFunction(name);
  if (functionDeclaration) return functionDeclaration;
  return file?.getVariableDeclaration(name)?.getInitializer();
};

const addFinding = (
  findings: InspectorFinding[],
  lawId: string,
  filePath: string,
  checkId: string,
  message: string,
): void => {
  findings.push(createFinding({ checkId, lawId, filePath, message }));
};

export const inspectDownloadStepRecurrenceGuards = (
  flowFile: SourceFile | null,
  pageStateFile: SourceFile | null,
  findings: InspectorFinding[],
  lawId: string,
  downloadFlowPath: string,
  pageStatePath: string,
): void => {
  const request = functionLikeNode(flowFile, "requestCsvDownload");
  const point = functionLikeNode(pageStateFile, "findSellerCentralLatestReportDownloadPoint");
  const state = functionLikeNode(pageStateFile, "readSellerCentralLatestTaxInvoiceRowState");
  const requestHasStateRead = request ? hasCallNamed(request, "readSellerCentralLatestTaxInvoiceRowState") : false;
  const requestSkipsOnDownloadable = request ? ifConditionHasLiteral(request, "downloadable") : true;
  const requestSkipsOnDownloadableRow = request ? ifConditionHasCallNamed(request, "isDownloadableCsvRow") : true;
  const pointScripts = point ? embeddedScripts(point) : [];
  const stateScripts = state ? embeddedScripts(state) : [];
  const pointFiltersByButton = pointScripts.some((script) =>
    script.includes("rows.find((candidate)") && script.includes("candidate.querySelector('kat-button[label=\"下载\"]')"),
  );
  const pointLocksFirstTaxRow = pointScripts.some((script) =>
    script.includes("const row = rows.find((candidate)") && script.includes("const button = row.querySelector('kat-button[label=\"下载\"]');"),
  );
  const stateLocksFirstTaxRow = stateScripts.some((script) =>
    script.includes("const row = rows.find((candidate)") && script.includes("return row.querySelector('kat-button[label=\"下载\"]')"),
  );
  process.stdout.write(`[AUDIT][amazon-invoice-upload][tax-download-row-guards] requestStateRead=${requestHasStateRead} requestSkipsOnDownloadable=${requestSkipsOnDownloadable} pointFiltersByButton=${pointFiltersByButton} pointLocksFirstTaxRow=${pointLocksFirstTaxRow} stateLocksFirstTaxRow=${stateLocksFirstTaxRow}\n`);
  if (!requestHasStateRead) {
    addFinding(findings, lawId, downloadFlowPath, "amazon-invoice-upload/aid-07-current-row-state-read", "AID-07 must read the latest Seller Central tax invoice row state before deciding whether a request is already pending.");
  }
  if (requestSkipsOnDownloadable || requestSkipsOnDownloadableRow) {
    addFinding(findings, lawId, downloadFlowPath, "amazon-invoice-upload/aid-07-must-not-skip-on-downloadable", "AID-07 must not skip requesting CSV because the latest row or snapshot is already downloadable; downloadable may be an old report.");
  }
  if (pointFiltersByButton || !pointLocksFirstTaxRow || !stateLocksFirstTaxRow) {
    addFinding(findings, lawId, pageStatePath, "amazon-invoice-upload/aid-10-first-tax-row-only", "AID-10 must lock the first tax invoice row before checking its download button; it must not find any historical row that already has 下载.");
  }
};
