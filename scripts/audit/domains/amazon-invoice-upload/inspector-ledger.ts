import { Node, SyntaxKind, type ArrayLiteralExpression, type ObjectLiteralExpression, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

const uploadLedgerPath = "src/plugins/amazon-invoice-upload/amazon-invoice-upload-ledger.ts";
const uploadStoragePath = "src/plugins/amazon-invoice-upload/amazon-invoice-upload-storage.ts";
const taskServicePath = "src/plugins/amazon-invoice-upload/amazon-invoice-upload-task-service.ts";
const routesPath = "src/app/workbench-amazon-routes.ts";
const boundaryPath = "src/app/workbench-api-boundary.ts";
const appShellPath = "src/app/app-shell/amazon-invoice-workspace.ts";
const appClientPath = "src/app/workbench-home-amazon-invoice-client.ts";
const uploadLedgerRoute = "/api/plugins/amazon-invoice-upload/ledger";

type PropertyValue = string | boolean | null;

const source = (context: InspectorContext, repoPath: string): SourceFile | null =>
  context.project.getSourceFile(resolveFromRepo(repoPath)) ?? null;

const addFinding = (findings: InspectorFinding[], lawId: string, filePath: string, checkId: string, message: string): void => {
  findings.push(createFinding({ checkId, lawId, filePath, message }));
};

const propertyValue = (objectLiteral: ObjectLiteralExpression, name: string): PropertyValue => {
  const item = objectLiteral.getProperties().find((property) => Node.isPropertyAssignment(property) && property.getName() === name);
  if (!item || !Node.isPropertyAssignment(item)) return null;
  const initializer = item.getInitializer();
  if (!initializer) return null;
  if (Node.isStringLiteral(initializer)) return initializer.getLiteralText();
  if (initializer.getKind() === SyntaxKind.TrueKeyword) return true;
  if (initializer.getKind() === SyntaxKind.FalseKeyword) return false;
  return null;
};

const exportedArray = (file: SourceFile, name: string): ArrayLiteralExpression | null => {
  const declaration = (file.getExportedDeclarations().get(name) ?? []).find(Node.isVariableDeclaration);
  const initializer = declaration?.getInitializer();
  if (Node.isArrayLiteralExpression(initializer)) return initializer;
  if (!initializer || !Node.isAsExpression(initializer)) return null;
  const expression = initializer.getExpression();
  return Node.isArrayLiteralExpression(expression) ? expression : null;
};

const literalCorpus = (file: SourceFile): string =>
  [
    ...file.getDescendantsOfKind(SyntaxKind.StringLiteral).map((item) => item.getLiteralText()),
    ...file.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((item) => item.getLiteralText()),
    ...file.getDescendantsOfKind(SyntaxKind.TemplateHead).map((item) => item.getLiteralText()),
    ...file.getDescendantsOfKind(SyntaxKind.TemplateMiddle).map((item) => item.getLiteralText()),
    ...file.getDescendantsOfKind(SyntaxKind.TemplateTail).map((item) => item.getLiteralText()),
  ].join("\n");

export function inspectAmazonInvoiceUploadLedgerGuard(context: InspectorContext, findings: InspectorFinding[], lawId: string): void {
  inspectLedgerBoundary(source(context, boundaryPath), findings, lawId);
  inspectLedgerFiles({
    ledgerFile: source(context, uploadLedgerPath),
    storageFile: source(context, uploadStoragePath),
    taskServiceFile: source(context, taskServicePath),
    routesFile: source(context, routesPath),
    appShellFile: source(context, appShellPath),
    appClientFile: source(context, appClientPath),
    findings,
    lawId,
  });
}

function inspectLedgerBoundary(file: SourceFile | null, findings: InspectorFinding[], lawId: string): void {
  if (!file) return;
  const routeObjects = exportedArray(file, "WORKBENCH_API_ROUTE_RULES")?.getElements().filter(Node.isObjectLiteralExpression) ?? [];
  const rule = routeObjects.find((item) => propertyValue(item, "path") === uploadLedgerRoute);
  if (!rule) return addFinding(findings, lawId, boundaryPath, "amazon-invoice-upload/ledger-route-rule-missing", `${uploadLedgerRoute} must be explicitly allowlisted for website status sync.`);
  if (propertyValue(rule, "method") !== "GET"
    || propertyValue(rule, "pathPattern") !== "exact"
    || propertyValue(rule, "externalApiAllowed") !== true
    || propertyValue(rule, "requiresApiKey") !== true
    || propertyValue(rule, "jobOwner") !== "amazon-invoice-upload"
    || propertyValue(rule, "purpose") !== "external_amazon_invoice_upload_ledger") {
    addFinding(findings, lawId, boundaryPath, "amazon-invoice-upload/ledger-route-rule-shape", `${uploadLedgerRoute} must be GET exact, externalApiAllowed true, requiresApiKey true, and jobOwner amazon-invoice-upload.`);
  }
}

function inspectLedgerFiles(input: {
  ledgerFile: SourceFile | null;
  storageFile: SourceFile | null;
  taskServiceFile: SourceFile | null;
  routesFile: SourceFile | null;
  appShellFile: SourceFile | null;
  appClientFile: SourceFile | null;
  findings: InspectorFinding[];
  lawId: string;
}): void {
  const { ledgerFile, storageFile, taskServiceFile, routesFile, appShellFile, appClientFile, findings, lawId } = input;
  if (!ledgerFile || !storageFile || !taskServiceFile || !routesFile || !appShellFile || !appClientFile) return;
  inspectLedgerStorage(ledgerFile, findings, lawId);
  inspectLedgerProjectionWrites(storageFile, findings, lawId);
  inspectLedgerServiceAndRoute(taskServiceFile, routesFile, findings, lawId);
  inspectLedgerAppShell(appShellFile, appClientFile, findings, lawId);
}

function inspectLedgerStorage(ledgerFile: SourceFile, findings: InspectorFinding[], lawId: string): void {
  const ledgerCorpus = literalCorpus(ledgerFile);
  for (const required of ["amazon_invoice_upload_ledger.sqlite", "CREATE TABLE IF NOT EXISTS amazon_invoice_upload_ledger", "amazon_order_id", "invoice_no", "status", "reason", "reached_step", "evidence_ref", "dom_trace_ref", "review_required"]) {
    if (!ledgerCorpus.includes(required)) addFinding(findings, lawId, uploadLedgerPath, "amazon-invoice-upload/ledger-storage-token", `Upload ledger storage must include ${required}.`);
  }
  const hasSqlite = ledgerFile.getImportDeclarations().some((item) => item.getModuleSpecifierValue() === "better-sqlite3");
  if (!hasSqlite) addFinding(findings, lawId, uploadLedgerPath, "amazon-invoice-upload/ledger-sqlite-owner", "Upload ledger must be a local SQLite projection owned by amazon-invoice-upload.");
  for (const forbidden of ["invoicePdfPath", "raw PDF", "cookie", "sellerCentralCookie", "browserProfileDirectory", "selector", "browserCommand", "flowStep", "documentId", "downloadUrl"]) {
    if (ledgerCorpus.includes(forbidden)) addFinding(findings, lawId, uploadLedgerPath, "amazon-invoice-upload/ledger-forbidden-field", `Upload ledger must not persist or expose ${forbidden}.`);
  }
}

function inspectLedgerProjectionWrites(storageFile: SourceFile, findings: InspectorFinding[], lawId: string): void {
  const saveTaskRecord = storageFile.getFunction("saveTaskRecord");
  const callsLedger = saveTaskRecord?.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) =>
    Node.isIdentifier(call.getExpression()) && call.getExpression().getText() === "upsertAmazonInvoiceUploadLedgerRecord");
  if (!literalCorpus(storageFile).includes("./amazon-invoice-upload-ledger.js") || !callsLedger) {
    addFinding(findings, lawId, uploadStoragePath, "amazon-invoice-upload/ledger-save-task-record", "saveTaskRecord must write the Agent upload ledger through the existing upload task record path.");
  }
}

function inspectLedgerServiceAndRoute(taskServiceFile: SourceFile, routesFile: SourceFile, findings: InspectorFinding[], lawId: string): void {
  const listLedgerFunction = taskServiceFile.getFunction("listAmazonInvoiceUploadLedger");
  const callsLedgerStore = taskServiceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) =>
    Node.isIdentifier(call.getExpression()) && call.getExpression().getText() === "listAmazonInvoiceUploadLedgerRecords");
  if (!callsLedgerStore || !listLedgerFunction?.getReturnTypeNode()) {
    addFinding(findings, lawId, taskServicePath, "amazon-invoice-upload/ledger-task-service", "Task service must expose a typed listAmazonInvoiceUploadLedger wrapper over the ledger store.");
  }
  const routeCallsLedger = routesFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    const expression = call.getExpression();
    return Node.isPropertyAccessExpression(expression) && expression.getName() === "listAmazonInvoiceUploadLedger";
  });
  if (!literalCorpus(routesFile).includes(uploadLedgerRoute) || !routeCallsLedger) {
    addFinding(findings, lawId, routesPath, "amazon-invoice-upload/ledger-route-handler", "Workbench Amazon routes must expose GET upload ledger through the existing amazon-invoice-upload route family.");
  }
}

function inspectLedgerAppShell(appShellFile: SourceFile, appClientFile: SourceFile, findings: InspectorFinding[], lawId: string): void {
  const appShellCorpus = literalCorpus(appShellFile);
  const appClientCorpus = literalCorpus(appClientFile);
  for (const required of ["data-amazon-invoice-upload-ledger-list", "data-amazon-invoice-upload-ledger-refresh", "Upload Ledger"]) {
    if (!appShellCorpus.includes(required)) addFinding(findings, lawId, appShellPath, "amazon-invoice-upload/ledger-app-shell", `App Shell Ledger page must expose ${required}.`);
  }
  const hasUploadLedgerRoute = appClientFile.getDescendantsOfKind(SyntaxKind.PropertySignature).some((property) =>
    property.getName() === "uploadLedger");
  if (!hasUploadLedgerRoute || !appClientCorpus.includes("refreshAmazonInvoiceUploadLedger")) {
    addFinding(findings, lawId, appClientPath, "amazon-invoice-upload/ledger-app-client", "App Shell client must fetch and render the persisted upload ledger route.");
  }
}
