import { existsSync } from "node:fs";

import { Node, SyntaxKind, type ArrayLiteralExpression, type BinaryExpression, type CallExpression, type IfStatement, type ObjectLiteralExpression, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

const obsoleteBackendBatchFiles = [
  "src/plugins/amazon-invoice-upload/amazon-invoice-upload-batch.types.ts",
  "src/plugins/amazon-invoice-upload/amazon-invoice-upload-batch-storage.ts",
  "src/plugins/amazon-invoice-upload/amazon-invoice-upload-batch-service.ts",
] as const;

const obsoleteBatchRoutes = [
  "/api/plugins/amazon-invoice-upload/batch/start",
  "/api/plugins/amazon-invoice-upload/batch/status/",
  "/api/plugins/amazon-invoice-upload/batch/latest",
  "/api/plugins/amazon-invoice-upload/batch/history",
] as const;

const obsoleteBatchHandleNames = [
  "startAmazonInvoiceUploadBatchTask",
  "getAmazonInvoiceUploadBatchStatus",
  "getLatestAmazonInvoiceUploadBatch",
  "listAmazonInvoiceUploadBatches",
] as const;

const requiredLocalQueueGuards = [
  "parseAmazonInvoiceBatchFileName",
  "ensureAmazonInvoiceBackendReady",
  "backend_unreachable",
  "AMAZON_INVOICE_BATCH_ITEM_RENDER_LIMIT",
  "compactAmazonInvoiceBatchRecord",
  "amazonInvoiceLocalQueueCounterKey",
  "loadAmazonInvoiceUploadLedgerIndex",
  "skipped_by_upload_ledger",
  "upload ledger preflight",
  "upload_ledger_preflight_failed",
  "amazonInvoiceBatchRunning",
  "batch_already_running",
  "duplicate_order_id_in_batch",
  "startButton.disabled = true",
  "startButton.disabled = false",
  "amount_mismatch_skipped",
  "amountCheck: record.amountCheck",
  "shouldStopAmazonInvoiceLocalQueue",
  "review_required",
  "Local file queue stopped on the current review-required order; queued orders were not started.",
] as const;

const INTER_ITEM_PACING_CHECK_ID = "amazon-invoice-upload/batch-inter-item-pacing";

export const inspectAmazonInvoiceBatchGuard = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  inspectObsoleteBackendBatchSurface(context, findings, lawId);
  inspectLocalQueueUi(context, findings, lawId);
};

const addFinding = (findings: InspectorFinding[], lawId: string, filePath: string, checkId: string, message: string): void => {
  findings.push(createFinding({ checkId, lawId, filePath, message }));
};

const source = (context: InspectorContext, repoPath: string): SourceFile | null =>
  context.project.getSourceFile(resolveFromRepo(repoPath)) ?? null;

const stringLiteralValues = (file: SourceFile): Set<string> =>
  new Set([
    ...file.getDescendantsOfKind(SyntaxKind.StringLiteral).map((item) => item.getLiteralText()),
    ...file.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((item) => item.getLiteralText()),
    ...file.getDescendantsOfKind(SyntaxKind.TemplateHead).map((item) => item.getLiteralText()),
    ...file.getDescendantsOfKind(SyntaxKind.TemplateMiddle).map((item) => item.getLiteralText()),
    ...file.getDescendantsOfKind(SyntaxKind.TemplateTail).map((item) => item.getLiteralText()),
  ]);

const stringLiteralValuesFromNode = (node: Node | undefined): Set<string> =>
  new Set([
    ...(node?.getDescendantsOfKind(SyntaxKind.StringLiteral).map((item) => item.getLiteralText()) ?? []),
    ...(node?.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((item) => item.getLiteralText()) ?? []),
    ...(node?.getDescendantsOfKind(SyntaxKind.TemplateHead).map((item) => item.getLiteralText()) ?? []),
    ...(node?.getDescendantsOfKind(SyntaxKind.TemplateMiddle).map((item) => item.getLiteralText()) ?? []),
    ...(node?.getDescendantsOfKind(SyntaxKind.TemplateTail).map((item) => item.getLiteralText()) ?? []),
  ]);

const exportedArray = (file: SourceFile, name: string): ArrayLiteralExpression | null => {
  const declaration = (file.getExportedDeclarations().get(name) ?? []).find(Node.isVariableDeclaration);
  const initializer = declaration?.getInitializer();
  if (Node.isArrayLiteralExpression(initializer)) return initializer;
  if (!initializer || !Node.isAsExpression(initializer)) return null;
  const expression = initializer.getExpression();
  return Node.isArrayLiteralExpression(expression) ? expression : null;
};

const propertyValue = (objectLiteral: ObjectLiteralExpression, name: string): string | null => {
  const item = objectLiteral.getProperties().find((property) => Node.isPropertyAssignment(property) && property.getName() === name);
  if (!item || !Node.isPropertyAssignment(item)) return null;
  const initializer = item.getInitializer();
  return initializer && Node.isStringLiteral(initializer) ? initializer.getLiteralText() : null;
};

function inspectObsoleteBackendBatchSurface(context: InspectorContext, findings: InspectorFinding[], lawId: string): void {
  for (const filePath of obsoleteBackendBatchFiles) {
    if (existsSync(resolveFromRepo(filePath))) {
      addFinding(findings, lawId, filePath, "amazon-invoice-upload/no-obsolete-backend-batch-file", `${filePath} must not exist; APP batch upload must stay a local queue over the existing single-upload route.`);
    }
  }

  inspectRouteRules(context, findings, lawId);
  inspectSourceLiterals(context, findings, lawId, "src/app/workbench-amazon-routes.ts");
  inspectSourceLiterals(context, findings, lawId, "src/app/workbench-home-client.ts");
  inspectSourceLiterals(context, findings, lawId, "src/app/workbench-home-amazon-invoice-client.ts");
  inspectHandleExports(context, findings, lawId);
  inspectSchema(context, findings, lawId);
}

function inspectRouteRules(context: InspectorContext, findings: InspectorFinding[], lawId: string): void {
  const boundary = source(context, "src/app/workbench-api-boundary.ts");
  const routes = boundary ? exportedArray(boundary, "WORKBENCH_API_ROUTE_RULES") : null;
  const objects = routes?.getElements().filter(Node.isObjectLiteralExpression) ?? [];
  for (const route of obsoleteBatchRoutes) {
    if (objects.some((item) => propertyValue(item, "path") === route)) {
      addFinding(findings, lawId, "src/app/workbench-api-boundary.ts", "amazon-invoice-upload/no-backend-batch-route-allowlist", `${route} must not be allowlisted; large selections use the local queue and /api/plugins/amazon-invoice-upload/start.`);
    }
  }
}

function inspectSourceLiterals(context: InspectorContext, findings: InspectorFinding[], lawId: string, filePath: string): void {
  const file = source(context, filePath);
  if (!file) return;
  const values = stringLiteralValues(file);
  for (const route of obsoleteBatchRoutes) {
    if (values.has(route)) {
      addFinding(findings, lawId, filePath, "amazon-invoice-upload/no-obsolete-backend-batch-route", `${filePath} must not reference obsolete backend batch route ${route}.`);
    }
  }
  for (const handleName of obsoleteBatchHandleNames) {
    if (file.getVariableDeclaration(handleName) || file.getFunction(handleName)) {
      addFinding(findings, lawId, filePath, "amazon-invoice-upload/no-obsolete-backend-batch-handle", `${handleName} must not remain in the active route or handle surface.`);
    }
  }
}

function inspectHandleExports(context: InspectorContext, findings: InspectorFinding[], lawId: string): void {
  for (const filePath of [
    "src/lib/local-runtime/workbench-handle.ts",
    "src/lib/local-runtime/workbench-amazon-invoice-handle.ts",
    "src/plugins/amazon-invoice-upload/index.ts",
    "src/plugins/amazon-invoice-upload/amazon-invoice-upload-task-service.ts",
  ]) {
    const file = source(context, filePath);
    if (!file) continue;
    const values = stringLiteralValues(file);
    for (const handleName of obsoleteBatchHandleNames) {
      if (values.has(handleName)) {
        addFinding(findings, lawId, filePath, "amazon-invoice-upload/no-obsolete-backend-batch-export", `${handleName} must not be exported or typed as an active workbench API.`);
      }
    }
  }
}

function inspectSchema(context: InspectorContext, findings: InspectorFinding[], lawId: string): void {
  const schema = source(context, "src/plugins/amazon-invoice-upload/mission.schema.ts");
  if (schema?.getVariableDeclaration("AmazonInvoiceUploadBatchMissionInputSchema")) {
    addFinding(findings, lawId, "src/plugins/amazon-invoice-upload/mission.schema.ts", "amazon-invoice-upload/no-backend-batch-mission-schema", "amazon_invoice_upload_batch mission schema must not exist; local file queue items become normal amazon_invoice_upload missions.");
  }
}

function inspectLocalQueueUi(context: InspectorContext, findings: InspectorFinding[], lawId: string): void {
  const layout = source(context, "src/app/app-shell/amazon-invoice-workspace.ts");
  const client = source(context, "src/app/workbench-home-amazon-invoice-client.ts");
  const homeClient = source(context, "src/app/workbench-home-client.ts");
  const layoutCorpus = layout ? [...stringLiteralValues(layout)].join("\n") : "";
  const batchSurfaceCorpus = layout ? [...stringLiteralValuesFromNode(layout.getVariableDeclaration("renderAmazonInvoiceBatchSurface")?.getInitializer())].join("\n") : "";
  const clientCorpus = [...new Set([
    ...(client ? stringLiteralValues(client) : []),
    ...(homeClient ? stringLiteralValues(homeClient) : []),
  ])].join("\n");
  inspectLocalQueueLayout(layoutCorpus, batchSurfaceCorpus, findings, lawId);
  inspectLocalQueueClient(clientCorpus, findings, lawId);
  inspectInterItemPacing(context, client, findings, lawId);
}

function generatedClientTemplate(file: SourceFile, declarationName: string): string | null {
  const initializer = file.getVariableDeclaration(declarationName)?.getInitializer();
  if (!initializer || !Node.isArrowFunction(initializer)) return null;
  const body = initializer.getBody();
  return Node.isNoSubstitutionTemplateLiteral(body) ? body.getLiteralText() : null;
}

function inspectInterItemPacing(
  context: InspectorContext,
  client: SourceFile | null,
  findings: InspectorFinding[],
  lawId: string,
): void {
  const generated = createPacingVirtualSource(context, client, findings, lawId);
  if (!generated) return;
  inspectPacingEntropy(generated, findings, lawId);
  inspectPacingSequence(generated, findings, lawId);
  inspectPacingSignals(generated, findings, lawId);
  inspectPacingOwnerBoundary(context, findings, lawId);
}

function createPacingVirtualSource(
  context: InspectorContext,
  client: SourceFile | null,
  findings: InspectorFinding[],
  lawId: string,
): SourceFile | null {
  const helperTemplate = client ? generatedClientTemplate(client, "amazonInvoiceLocalQueueHelpersClient") : null;
  const runnerTemplate = client ? generatedClientTemplate(client, "amazonInvoiceLocalQueueRunnerClient") : null;
  const lifecycleTemplate = client ? generatedClientTemplate(client, "amazonInvoiceBatchLifecycleClient") : null;
  if (!helperTemplate || !runnerTemplate || !lifecycleTemplate) {
    addFinding(findings, lawId, "src/app/workbench-home-amazon-invoice-client.ts", INTER_ITEM_PACING_CHECK_ID, "Batch pacing must remain in the existing generated local-queue client templates.");
    return null;
  }
  return context.project.createSourceFile(
    "/__grasseye_audit_virtual__/amazon-invoice-local-queue-pacing.ts",
    `${helperTemplate}\n${runnerTemplate}\n${lifecycleTemplate}`,
    { overwrite: true },
  );
}

function inspectPacingEntropy(generated: SourceFile, findings: InspectorFinding[], lawId: string): void {
  const minDelay = generated.getVariableDeclaration("AMAZON_INVOICE_INTER_ITEM_DELAY_MIN_MS")?.getInitializerIfKind(SyntaxKind.NumericLiteral)?.getLiteralValue();
  const maxDelay = generated.getVariableDeclaration("AMAZON_INVOICE_INTER_ITEM_DELAY_MAX_MS")?.getInitializerIfKind(SyntaxKind.NumericLiteral)?.getLiteralValue();
  if (minDelay !== 2000 || maxDelay !== 15000) {
    addFinding(findings, lawId, "src/app/workbench-home-amazon-invoice-client.ts", INTER_ITEM_PACING_CHECK_ID, "Batch pacing bounds must be fixed at exactly 2000ms and 15000ms.");
  }

  const sampler = generated.getVariableDeclaration("sampleAmazonInvoiceInterItemDelayMs")?.getInitializer();
  const samplerCalls = sampler?.getDescendantsOfKind(SyntaxKind.CallExpression) ?? [];
  const hasCryptoEntropy = samplerCalls.some((call) => {
    const expression = call.getExpression();
    return Node.isPropertyAccessExpression(expression)
      && expression.getName() === "getRandomValues"
      && Node.isIdentifier(expression.getExpression())
      && expression.getExpression().getText() === "crypto";
  });
  const hasMathRandom = samplerCalls.some((call) => {
    const expression = call.getExpression();
    return Node.isPropertyAccessExpression(expression)
      && expression.getName() === "random"
      && Node.isIdentifier(expression.getExpression())
      && expression.getExpression().getText() === "Math";
  });
  if (!sampler || !Node.isArrowFunction(sampler) || sampler.getParameters().length !== 0 || !hasCryptoEntropy || hasMathRandom) {
    addFinding(findings, lawId, "src/app/workbench-home-amazon-invoice-client.ts", INTER_ITEM_PACING_CHECK_ID, "Batch pacing must sample one internal delay from crypto.getRandomValues without Math.random or caller input.");
  }
}

function inspectPacingSequence(generated: SourceFile, findings: InspectorFinding[], lawId: string): void {
  const startBatch = generated.getVariableDeclaration("startAmazonInvoiceBatch")?.getInitializer();
  const startBatchCalls = startBatch?.getDescendantsOfKind(SyntaxKind.CallExpression) ?? [];
  const pacingCall = findIdentifierCall(startBatchCalls, "runAmazonInvoiceInterItemPacing");
  const uploadCall = findIdentifierCall(startBatchCalls, "uploadAmazonInvoiceLocalQueueItem");
  const stopCall = findIdentifierCall(startBatchCalls, "shouldStopAmazonInvoiceLocalQueue");
  const ledgerSkip = findLedgerSkip(startBatch);
  const pendingDelay = startBatch?.getDescendantsOfKind(SyntaxKind.VariableDeclaration).find((declaration) => declaration.getName() === "pendingInterItemDelay");
  const pendingTrue = findPendingDelayAssignment(startBatch);
  const requiredNodes = [pendingDelay, ledgerSkip, pacingCall, uploadCall, stopCall, pendingTrue];
  const allPresent = requiredNodes.every((node) => node !== undefined);
  const orderedNodes = [ledgerSkip, pacingCall, uploadCall, stopCall, pendingTrue]
    .filter((node) => node !== undefined);
  const validOrder = orderedNodes.every((node, index) =>
    index === 0 || orderedNodes[index - 1]!.getStart() < node.getStart());
  const validSequence = allPresent && validOrder;
  if (!validSequence) {
    addFinding(findings, lawId, "src/app/workbench-home-amazon-invoice-client.ts", INTER_ITEM_PACING_CHECK_ID, "The pending delay must survive ledger skips and run only before the next real upload, after the previous terminal stop decision.");
  }
}

function findIdentifierCall(calls: readonly CallExpression[], name: string): CallExpression | undefined {
  return calls.find((call) =>
    Node.isIdentifier(call.getExpression()) && call.getExpression().getText() === name);
}

function findLedgerSkip(startBatch: Node | undefined): IfStatement | undefined {
  return startBatch?.getDescendantsOfKind(SyntaxKind.IfStatement).find((statement) => {
    const expression = statement.getExpression();
    const directlyNamed = Node.isIdentifier(expression) && expression.getText() === "ledgerRecord";
    const containsName = expression.getDescendantsOfKind(SyntaxKind.Identifier)
      .some((identifier) => identifier.getText() === "ledgerRecord");
    const continues = statement.getThenStatement()
      .getDescendantsOfKind(SyntaxKind.ContinueStatement).length === 1;
    return (directlyNamed || containsName) && continues;
  });
}

function findPendingDelayAssignment(startBatch: Node | undefined): BinaryExpression | undefined {
  return startBatch?.getDescendantsOfKind(SyntaxKind.BinaryExpression).find((expression) => {
    const left = expression.getLeft();
    return expression.getOperatorToken().getKind() === SyntaxKind.EqualsToken
      && Node.isIdentifier(left)
      && left.getText() === "pendingInterItemDelay"
      && expression.getRight().getKind() === SyntaxKind.TrueKeyword;
  });
}

function inspectPacingSignals(generated: SourceFile, findings: InspectorFinding[], lawId: string): void {
  const literals = stringLiteralValues(generated);
  for (const requiredSignal of ["inter_item_pacing", "single_upload_transport_outcome_unknown", "review_required"]) {
    if (![...literals].some((literal) => literal.includes(requiredSignal))) {
      addFinding(findings, lawId, "src/app/workbench-home-amazon-invoice-client.ts", INTER_ITEM_PACING_CHECK_ID, `Batch pacing safety is missing ${requiredSignal}.`);
    }
  }
}

function inspectPacingOwnerBoundary(context: InspectorContext, findings: InspectorFinding[], lawId: string): void {
  for (const forbiddenPath of [
    "src/lib/browser/browser-controller.ts",
    "src/plugins/amazon-invoice-upload/amazon-invoice-upload.flow.ts",
    "src/plugins/amazon-invoice-upload/amazon-invoice-upload-task-service.ts",
  ]) {
    const forbiddenSource = source(context, forbiddenPath);
    if (forbiddenSource?.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) =>
      identifier.getText() === "runAmazonInvoiceInterItemPacing"
        || identifier.getText() === "AMAZON_INVOICE_INTER_ITEM_DELAY_MIN_MS"
        || identifier.getText() === "AMAZON_INVOICE_INTER_ITEM_DELAY_MAX_MS")) {
      addFinding(findings, lawId, forbiddenPath, INTER_ITEM_PACING_CHECK_ID, "Batch-only pacing must not enter BrowserController, the single-item flow, or the execution lease.");
    }
  }
}

function inspectLocalQueueLayout(layoutCorpus: string, batchSurfaceCorpus: string, findings: InspectorFinding[], lawId: string): void {
  for (const value of ["batch", "ledger", "data-amazon-invoice-batch-form", "Start Batch Upload", "data-amazon-invoice-upload-ledger-list"]) {
    if (!layoutCorpus.includes(value)) addFinding(findings, lawId, "src/app/app-shell/amazon-invoice-workspace.ts", "amazon-invoice-upload/batch-ui-surface", `Batch UI must expose ${value}.`);
  }
  if (batchSurfaceCorpus.includes("Seller Central Entry URL") || batchSurfaceCorpus.includes("sellerCentralEntryUrl")) {
    addFinding(findings, lawId, "src/app/app-shell/amazon-invoice-workspace.ts", "amazon-invoice-upload/batch-ui-seller-url", "Batch UI must not expose Seller Central Entry URL; it is derived per file from marketplace and order id.");
  }
  if (layoutCorpus.includes("Safe Review Mode") || layoutCorpus.includes("require human final submit") || layoutCorpus.includes("Latest Batch") || layoutCorpus.includes("Batch Ledger")) {
    addFinding(findings, lawId, "src/app/app-shell/amazon-invoice-workspace.ts", "amazon-invoice-upload/no-obsolete-batch-ui-mode", "Amazon invoice UI must not expose human-review or obsolete backend batch history modes.");
  }
}

function inspectLocalQueueClient(clientCorpus: string, findings: InspectorFinding[], lawId: string): void {
  for (const requiredClientGuard of requiredLocalQueueGuards) {
    if (!clientCorpus.includes(requiredClientGuard)) {
      addFinding(findings, lawId, "src/app/workbench-home-amazon-invoice-client.ts", "amazon-invoice-upload/batch-local-queue-health", `Batch local queue client must include ${requiredClientGuard}.`);
    }
  }
  if (!clientCorpus.includes("/api/plugins/amazon-invoice-upload/start")) {
    addFinding(findings, lawId, "src/app/workbench-home-amazon-invoice-client.ts", "amazon-invoice-upload/batch-single-route", "Batch local queue must call the existing single-upload route.");
  }
  if (!clientCorpus.includes("/api/plugins/amazon-invoice-upload/ledger")) {
    addFinding(findings, lawId, "src/app/workbench-home-amazon-invoice-client.ts", "amazon-invoice-upload/batch-ledger-preflight", "Batch local queue must read the existing upload ledger before opening Seller Central for queued files.");
  }
  if (!clientCorpus.includes("body.append(\"invoicePdf\"")) {
    addFinding(findings, lawId, "src/app/workbench-home-amazon-invoice-client.ts", "amazon-invoice-upload/batch-one-file-per-request", "Batch local queue must submit exactly one invoicePdf per request.");
  }
  if (clientCorpus.includes("body.append(\"invoicePdfs\"") || clientCorpus.includes("requireHumanFinalSubmit") || clientCorpus.includes("stopOnManualRequired")) {
    addFinding(findings, lawId, "src/app/workbench-home-amazon-invoice-client.ts", "amazon-invoice-upload/no-obsolete-batch-request-shape", "Batch client must not send huge invoicePdfs multipart or human/manual compatibility fields.");
  }
  const amountMismatchBranchIndex = clientCorpus.indexOf('record.status === "amount_mismatch_skipped"');
  const explicitReviewBranchIndex = clientCorpus.indexOf('record.status === "review_required"');
  if (amountMismatchBranchIndex < 0 || explicitReviewBranchIndex <= amountMismatchBranchIndex) {
    addFinding(findings, lawId, "src/app/workbench-home-amazon-invoice-client.ts", "amazon-invoice-upload/batch-local-queue-health", "Batch normalization must preserve amount_mismatch_skipped before classifying explicit review_required.");
  }
  if (clientCorpus.includes('record.status === "review_required" || record.reviewRequired === true')) {
    addFinding(findings, lawId, "src/app/workbench-home-amazon-invoice-client.ts", "amazon-invoice-upload/batch-local-queue-health", "reviewRequired metadata must not be converted into the batch-stopping review_required status.");
  }
  if (clientCorpus.includes('result.status === "amount_mismatch_skipped"')) {
    addFinding(findings, lawId, "src/app/workbench-home-amazon-invoice-client.ts", "amazon-invoice-upload/batch-local-queue-health", "amount_mismatch_skipped must not enter the local queue break condition.");
  }
  for (const requiredContinuitySignal of [
    'status: "amount_mismatch_skipped", reviewRequired: true, amountCheck: record.amountCheck',
    'amount_mismatch_skipped: "failed"',
    'item.status === "amount_mismatch_skipped" || item.status === "failed"',
    'shouldStopAmazonInvoiceLocalQueue(result, form.stopOnFailed.checked)',
  ]) {
    if (!clientCorpus.includes(requiredContinuitySignal)) {
      addFinding(findings, lawId, "src/app/workbench-home-amazon-invoice-client.ts", "amazon-invoice-upload/batch-local-queue-health", `Batch amount-mismatch continuation is missing ${requiredContinuitySignal}.`);
    }
  }
}
