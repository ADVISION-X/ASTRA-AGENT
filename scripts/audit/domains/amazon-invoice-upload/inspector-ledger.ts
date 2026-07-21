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

const hasStringLiteralValue = (file: SourceFile, value: string): boolean =>
  file.getDescendantsOfKind(SyntaxKind.StringLiteral).some((item) => item.getLiteralText() === value)
    || file.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).some((item) => item.getLiteralText() === value);

const functionCallsIdentifier = (file: SourceFile, functionName: string, calleeName: string): boolean =>
  (file.getFunction(functionName)?.getDescendantsOfKind(SyntaxKind.CallExpression) ?? [])
    .some((call) => Node.isIdentifier(call.getExpression()) && call.getExpression().getText() === calleeName);

const functionHasStringLiteral = (file: SourceFile, functionName: string, value: string): boolean =>
  (file.getFunction(functionName)?.getDescendantsOfKind(SyntaxKind.StringLiteral) ?? [])
    .some((literal) => literal.getLiteralText() === value);

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
  inspectLedgerCanonicalProjection(ledgerFile, storageFile, findings, lawId);
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

function inspectLedgerCanonicalProjection(
  ledgerFile: SourceFile,
  storageFile: SourceFile,
  findings: InspectorFinding[],
  lawId: string,
): void {
  const ledgerCorpus = literalCorpus(ledgerFile);
  for (const required of ["ranked_ledger", "ROW_NUMBER() OVER", "PARTITION BY amazon_order_id, invoice_no", "status IN ('upload_success', 'already_uploaded')", "canonical_rank = 1"]) {
    if (!ledgerCorpus.includes(required)) {
      addFinding(findings, lawId, uploadLedgerPath, "amazon-invoice-upload/ledger-strong-terminal-projection", `External upload ledger must use strong-terminal canonical projection token ${required}.`);
    }
  }
  if (!ledgerFile.getFunction("backfillLedgerFromTaskRecords") || !ledgerFile.getFunction("readTaskRecords")) {
    addFinding(findings, lawId, uploadLedgerPath, "amazon-invoice-upload/ledger-task-record-backfill", "External upload ledger must backfill from existing task records.");
  }
  if (!hasStringLiteralValue(ledgerFile, "task.json")) {
    addFinding(findings, lawId, uploadLedgerPath, "amazon-invoice-upload/ledger-task-record-backfill", "External upload ledger backfill must read task.json records.");
  }
  if (!functionCallsIdentifier(ledgerFile, "backfillLedgerFromTaskRecords", "writeLedgerRecord")) {
    addFinding(findings, lawId, uploadLedgerPath, "amazon-invoice-upload/ledger-task-record-backfill", "External upload ledger backfill must reuse the canonical ledger writer.");
  }
  const canonicalSelector = storageFile.getFunction("selectCanonicalUploadTaskRecord");
  if (!canonicalSelector) {
    addFinding(findings, lawId, uploadStoragePath, "amazon-invoice-upload/latest-strong-terminal", "Latest task lookup must preserve prior upload_success or already_uploaded over later uncertain review while keeping the two statuses distinct.");
  } else {
    const literalValues = canonicalSelector
      .getDescendantsOfKind(SyntaxKind.StringLiteral)
      .map((item) => item.getLiteralText());
    if (!literalValues.includes("upload_success") || !literalValues.includes("already_uploaded")) {
      addFinding(findings, lawId, uploadStoragePath, "amazon-invoice-upload/latest-strong-terminal", "Latest task lookup canonical selector must prefer upload_success and already_uploaded records without collapsing already_uploaded into upload_success.");
    }
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
  inspectUploadTaskRecordResponseSanitizer(routesFile, findings, lawId);
}

function inspectUploadTaskRecordResponseSanitizer(routesFile: SourceFile, findings: InspectorFinding[], lawId: string): void {
  const sanitizer = routesFile.getFunction("sanitizeAmazonInvoiceUploadTaskRecordForResponse");
  if (!sanitizer
    || !functionHasStringLiteral(routesFile, "sanitizeAmazonInvoiceUploadTaskRecordForResponse", "redacted-local-invoice-pdf-path")
    || !sanitizer.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => identifier.getText() === "invoicePdfPath")) {
    addFinding(findings, lawId, routesPath, "amazon-invoice-upload/task-record-response-sanitizer", "Upload task record API responses must redact mission.invoicePdfPath before leaving Workbench routes.");
  }
  inspectSanitizerUseByRouteHandlers(routesFile, findings, lawId);
  inspectRawTaskRecordResponses(routesFile, findings, lawId);
}

function inspectSanitizerUseByRouteHandlers(routesFile: SourceFile, findings: InspectorFinding[], lawId: string): void {
  for (const functionName of [
    "handleAmazonTaskCreateRequest",
    "handleAmazonPluginStartRequest",
    "handleAmazonTaskResumeRequest",
    "handleAmazonTaskStatusRequest",
    "handleAmazonPluginStatusRequest",
    "handleAmazonLatestRequest",
    "handleAmazonPluginLatestRequest",
  ]) {
    const routeHandler = routesFile.getFunction(functionName) ?? routesFile.getVariableDeclaration(functionName)?.getInitializer();
    const callsSanitizer = routeHandler?.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) =>
      Node.isIdentifier(call.getExpression()) && call.getExpression().getText() === "sanitizeAmazonInvoiceUploadTaskRecordForResponse");
    if (!callsSanitizer) {
      addFinding(findings, lawId, routesPath, "amazon-invoice-upload/task-record-route-sanitizer", `${functionName} must return only sanitized upload task records.`);
    }
  }
}

function inspectRawTaskRecordResponses(routesFile: SourceFile, findings: InspectorFinding[], lawId: string): void {
  for (const functionName of ["handleAmazonTaskCreateRequest", "handleAmazonTaskResumeRequest", "handleAmazonPluginLatestRequest"]) {
    const routeHandler = routesFile.getFunction(functionName) ?? routesFile.getVariableDeclaration(functionName)?.getInitializer();
    const rawWriteJsonCall = routeHandler?.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
      const expression = call.getExpression();
      if (!Node.isIdentifier(expression) || expression.getText() !== "writeJson") return false;
      const args = call.getArguments();
      const statusArg = args[1];
      const payloadArg = args[2];
      const payloadIsRawRecordIdentifier = Node.isIdentifier(payloadArg) && ["result", "record"].includes(payloadArg.getText());
      return statusArg?.getKind() === SyntaxKind.NumericLiteral
        && statusArg.getText() === "200"
        && Boolean(payloadIsRawRecordIdentifier);
    }) ?? false;
    if (rawWriteJsonCall) {
      addFinding(findings, lawId, routesPath, "amazon-invoice-upload/raw-task-record-response", `${functionName} must not expose raw upload task records.`);
    }
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
