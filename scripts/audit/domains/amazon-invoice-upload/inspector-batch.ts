import { existsSync } from "node:fs";

import { Node, SyntaxKind, type ArrayLiteralExpression, type ObjectLiteralExpression, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

const batchFiles = [
  "src/plugins/amazon-invoice-upload/amazon-invoice-upload-batch.types.ts",
  "src/plugins/amazon-invoice-upload/amazon-invoice-upload-batch-storage.ts",
  "src/plugins/amazon-invoice-upload/amazon-invoice-upload-batch-service.ts",
  "scripts/acceptance/amazon-invoice-upload-batch.acceptance.ts",
] as const;

const requiredBatchRoutes = [
  "/api/plugins/amazon-invoice-upload/batch/start",
  "/api/plugins/amazon-invoice-upload/batch/status/",
  "/api/plugins/amazon-invoice-upload/batch/latest",
  "/api/plugins/amazon-invoice-upload/batch/history",
] as const;

const forbiddenBatchSchemaKeys = ["selector", "cookie", "browserCommand", "flowStep", "documentId", "requireHumanFinalSubmit", "stopOnManualRequired"] as const;
const batchServicePath = "src/plugins/amazon-invoice-upload/amazon-invoice-upload-batch-service.ts";
const batchStoragePath = "src/plugins/amazon-invoice-upload/amazon-invoice-upload-batch-storage.ts";

export const inspectAmazonInvoiceBatchGuard = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  inspectBatchFiles(findings, lawId);
  inspectBatchRoutes(context, findings, lawId);
  inspectBatchSchema(context, findings, lawId);
  inspectBatchService(context, findings, lawId);
  inspectBatchScaleLimits(context, findings, lawId);
  inspectBatchUi(context, findings, lawId);
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

const propertyValue = (objectLiteral: ObjectLiteralExpression, name: string): string | boolean | null => {
  const item = objectLiteral.getProperties().find((property) => Node.isPropertyAssignment(property) && property.getName() === name);
  if (!item || !Node.isPropertyAssignment(item)) return null;
  const initializer = item.getInitializer();
  if (!initializer) return null;
  if (Node.isStringLiteral(initializer)) return initializer.getLiteralText();
  if (initializer.getKind() === SyntaxKind.TrueKeyword) return true;
  if (initializer.getKind() === SyntaxKind.FalseKeyword) return false;
  return null;
};

function inspectBatchFiles(findings: InspectorFinding[], lawId: string): void {
  for (const filePath of batchFiles) {
    if (!existsSync(resolveFromRepo(filePath))) {
      addFinding(findings, lawId, filePath, "amazon-invoice-upload/batch-required-file", `${filePath} must exist.`);
    }
  }
}

function inspectBatchRoutes(context: InspectorContext, findings: InspectorFinding[], lawId: string): void {
  const boundary = source(context, "src/app/workbench-api-boundary.ts");
  const routes = boundary ? exportedArray(boundary, "WORKBENCH_API_ROUTE_RULES") : null;
  const objects = routes?.getElements().filter(Node.isObjectLiteralExpression) ?? [];
  for (const route of requiredBatchRoutes) {
    const rule = objects.find((item) => propertyValue(item, "path") === route);
    if (!rule) {
      addFinding(findings, lawId, "src/app/workbench-api-boundary.ts", "amazon-invoice-upload/batch-route-missing", `${route} must be allowlisted.`);
      continue;
    }
    if (propertyValue(rule, "localUiAllowed") !== true || propertyValue(rule, "externalApiAllowed") !== false || propertyValue(rule, "requiresApiKey") !== false || propertyValue(rule, "jobOwner") !== "amazon-invoice-upload") {
      addFinding(findings, lawId, "src/app/workbench-api-boundary.ts", "amazon-invoice-upload/batch-route-shape", `${route} must be local UI only under amazon-invoice-upload owner.`);
    }
  }
}

function inspectBatchSchema(context: InspectorContext, findings: InspectorFinding[], lawId: string): void {
  const schema = source(context, "src/plugins/amazon-invoice-upload/mission.schema.ts");
  if (!schema?.getVariableDeclaration("AmazonInvoiceUploadBatchMissionInputSchema")) {
    addFinding(findings, lawId, "src/plugins/amazon-invoice-upload/mission.schema.ts", "amazon-invoice-upload/batch-schema-missing", "Batch mission schema must exist.");
    return;
  }
  const values = stringLiteralValues(schema);
  for (const key of forbiddenBatchSchemaKeys) {
    if (values.has(key)) {
      addFinding(findings, lawId, "src/plugins/amazon-invoice-upload/mission.schema.ts", "amazon-invoice-upload/batch-forbidden-schema-key", `Batch schema must not expose ${key}.`);
    }
  }
}

function inspectBatchService(context: InspectorContext, findings: InspectorFinding[], lawId: string): void {
  const service = source(context, batchServicePath);
  if (!service) return;
  const values = stringLiteralValues(service);
  if (!service.getVariableDeclaration("sellerCentralOriginByMarketplace") || !service.getFunction("buildSellerCentralOrderDetailEntryUrl")) {
    addFinding(findings, lawId, batchServicePath, "amazon-invoice-upload/batch-derived-seller-url", "Batch service must derive Seller Central order-detail entry URL from marketplace and order id.");
  }
  for (const url of ["https://sellercentral.amazon.ae", "https://sellercentral.amazon.sa", "https://sellercentral.amazon.co.jp", "https://sellercentral.amazon.com", "https://sellercentral.amazon.co.uk"]) {
    if (!values.has(url)) {
      addFinding(findings, lawId, batchServicePath, "amazon-invoice-upload/batch-derived-seller-url", `Batch service must derive supported Seller Central origin ${url}.`);
    }
  }
  if (!values.has("/orders-v3/order/")) {
    addFinding(findings, lawId, batchServicePath, "amazon-invoice-upload/batch-derived-seller-url", "Batch service must derive the same order-detail entry shape as single-upload API missions.");
  }
  const imports = service.getImportDeclarations().map((item) => item.getModuleSpecifierValue());
  for (const forbiddenImport of ["./amazon-invoice-upload-steps.js", "./amazon-invoice-upload-file-attachment.js", "./amazon-invoice-upload-order-detail.js", "./amazon-invoice-upload-existing.js", "./amazon-invoice-upload-verify.js"]) {
    if (imports.includes(forbiddenImport)) {
      addFinding(findings, lawId, batchServicePath, "amazon-invoice-upload/batch-no-dom-copy", "Batch service must not import Seller Central DOM step modules.");
    }
  }
  const hasPromiseAll = service.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    const expression = call.getExpression();
    return Node.isPropertyAccessExpression(expression) && expression.getExpression().getText() === "Promise" && expression.getName() === "all";
  });
  if (hasPromiseAll) {
    addFinding(findings, lawId, batchServicePath, "amazon-invoice-upload/batch-no-parallel-upload", "Batch upload must remain sequential and must not call Promise.all.");
  }
}

function inspectBatchScaleLimits(context: InspectorContext, findings: InspectorFinding[], lawId: string): void {
  const storage = source(context, batchStoragePath);
  const service = source(context, batchServicePath);
  if (storage?.getVariableDeclaration("MAX_BATCH_ITEMS") || storage?.getVariableDeclaration("MAX_BATCH_TOTAL_BYTES")) {
    addFinding(findings, lawId, batchStoragePath, "amazon-invoice-upload/batch-no-count-cap", "Batch validation must not impose an arbitrary selected-file count or total-byte cap.");
  }
  const values = service ? stringLiteralValues(service) : storage ? stringLiteralValues(storage) : new Set<string>();
  if (values.has("too_many_files")) {
    addFinding(findings, lawId, batchServicePath, "amazon-invoice-upload/batch-no-count-cap", "Batch service must not reject local file queues with too_many_files.");
  }
}

function inspectBatchUi(context: InspectorContext, findings: InspectorFinding[], lawId: string): void {
  const layout = source(context, "src/app/app-shell/amazon-invoice-workspace.ts");
  const client = source(context, "src/app/workbench-home-amazon-invoice-client.ts");
  const homeClient = source(context, "src/app/workbench-home-client.ts");
  const layoutCorpus = layout ? [...stringLiteralValues(layout)].join("\n") : "";
  const batchSurfaceCorpus = layout ? [...stringLiteralValuesFromNode(layout.getVariableDeclaration("renderAmazonInvoiceBatchSurface")?.getInitializer())].join("\n") : "";
  const clientCorpus = [...new Set([
    ...(client ? stringLiteralValues(client) : []),
    ...(homeClient ? stringLiteralValues(homeClient) : []),
  ])].join("\n");
  inspectBatchUiLayout(layoutCorpus, batchSurfaceCorpus, findings, lawId);
  inspectBatchUiClient(clientCorpus, findings, lawId);
}

function inspectBatchUiLayout(layoutCorpus: string, batchSurfaceCorpus: string, findings: InspectorFinding[], lawId: string): void {
  for (const value of ["batch", "ledger", "data-amazon-invoice-batch-form", "Start Batch Upload"]) {
    if (!layoutCorpus.includes(value)) addFinding(findings, lawId, "src/app/app-shell/amazon-invoice-workspace.ts", "amazon-invoice-upload/batch-ui-surface", `Batch UI must expose ${value}.`);
  }
  if (batchSurfaceCorpus.includes("Seller Central Entry URL") || batchSurfaceCorpus.includes("sellerCentralEntryUrl")) {
    addFinding(findings, lawId, "src/app/app-shell/amazon-invoice-workspace.ts", "amazon-invoice-upload/batch-ui-seller-url", "Batch UI must not expose Seller Central Entry URL; it is derived from marketplace.");
  }
  if (layoutCorpus.includes("Safe Review Mode") || layoutCorpus.includes("require human final submit")) {
    addFinding(findings, lawId, "src/app/app-shell/amazon-invoice-workspace.ts", "amazon-invoice-upload/no-human-final-submit-ui", "Amazon invoice upload UI must not expose human final-submit mode.");
  }
}

function inspectBatchUiClient(clientCorpus: string, findings: InspectorFinding[], lawId: string): void {
  if (!clientCorpus.includes("amazonInvoiceBatchSellerCentralEntryUrl")) {
    addFinding(findings, lawId, "src/app/workbench-home-amazon-invoice-client.ts", "amazon-invoice-upload/batch-derived-seller-url", "Batch client must derive a placeholder Seller Central order-detail entry URL from marketplace.");
  }
  if (clientCorpus.includes("requireHumanFinalSubmit") || clientCorpus.includes("stopOnManualRequired")) {
    addFinding(findings, lawId, "src/app/workbench-home-amazon-invoice-client.ts", "amazon-invoice-upload/no-human-final-submit-contract", "Amazon invoice client must not send human final-submit or manual stop compatibility fields.");
  }
  if (clientCorpus.includes("body.append(\"invoicePdfs\"")) {
    addFinding(findings, lawId, "src/app/workbench-home-amazon-invoice-client.ts", "amazon-invoice-upload/batch-no-single-huge-multipart", "Large local selections must be queued through the existing single-upload route instead of one huge multipart request.");
  }
  for (const requiredClientGuard of ["ensureAmazonInvoiceBackendReady", "backend_unreachable", "AMAZON_INVOICE_BATCH_ITEM_RENDER_LIMIT", "compactAmazonInvoiceBatchRecord", "amazonInvoiceLocalQueueCounterKey"]) {
    if (!clientCorpus.includes(requiredClientGuard)) {
      addFinding(findings, lawId, "src/app/workbench-home-amazon-invoice-client.ts", "amazon-invoice-upload/batch-local-queue-health", `Batch local queue client must include ${requiredClientGuard}.`);
    }
  }
  for (const route of requiredBatchRoutes) {
    if (!clientCorpus.includes(route)) addFinding(findings, lawId, "src/app/workbench-home-amazon-invoice-client.ts", "amazon-invoice-upload/batch-client-route", `Batch client must bind ${route}.`);
  }
}
