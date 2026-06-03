import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Node, SyntaxKind, type ObjectLiteralExpression, type Project, type SourceFile } from "ts-morph";

import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { loadGeneratedAuditPlan } from "../../core/load-audit-plan.js";
import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding, InspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { createAuditProject } from "../../shared/project.js";

const domain = "amazon-product-sync";
const selfPath = "scripts/audit/domains/amazon-product-sync/inspector.ts";
const pluginStatusPath = "scripts/audit/config/plugin-status.json";
const boundaryPath = "src/app/workbench-api-boundary.ts";
const serverPath = "src/app/create-workbench-server.ts";
const schemaPath = "src/plugins/amazon-product-sync/amazon-product-sync.schema.ts";
const flowPath = "src/plugins/amazon-product-sync/amazon-product-sync.flow.ts";
const taskServicePath = "src/plugins/amazon-product-sync/amazon-product-sync-task-service.ts";
const domScriptsPath = "src/plugins/amazon-product-sync/amazon-product-sync.dom-scripts.ts";
const acceptancePath = "scripts/acceptance/amazon-product-sync.acceptance.ts";

const requiredFiles = [
  ".github/instructions/agent-rules/modules/module-amazon-product-sync.instructions.md",
  "docs/法案辅助文件/GrassEye Amazon 产品更新同步施工图.md",
  "scripts/audit/domains/amazon-product-sync/manifest.json",
  schemaPath,
  flowPath,
  domScriptsPath,
  taskServicePath,
  "src/plugins/amazon-product-sync/amazon-product-sync.storage.ts",
  "src/plugins/amazon-product-sync/index.ts",
  "src/app/workbench-amazon-product-sync-routes.ts",
  acceptancePath,
] as const;

const requiredFlowTokens = [
  "form#sc-global-search-form",
  "input#sc-search-field",
  "button.sc-search-button",
  "搜索 SKU、商品名称/关键词、FNSKU、ASIN、UPC/EAN",
  "shadowRoot",
  "input[type='text'], input",
  "dispatchEvent",
  "SearchBox-module__searchButton MouseEvent click",
  "searchClickDelayMs",
  "setTimeout",
  "closeAmazonTabOnCompletion",
  "closeActiveTab",
  "ProductDetails-module__container",
  "JanusSplitBox-module__row",
  "JanusSplitBox-module__panel",
  "JanusTable-module__tableContentRow",
  "SKU",
  "ASIN",
  "现货（亚马逊物流）",
  "inventory_filter_shadow_input_submit_failed",
  "inventory_search_result_dom_not_verified",
] as const;

const requiredLogEvents = [
  "amazon_product_sync.start_received",
  "amazon_product_sync.queued",
  "amazon_product_sync.progress",
  "amazon_product_sync.item_summary",
  "amazon_product_sync.flow_finished",
  "amazon_product_sync.flow_failed",
  "amazon_product_sync.stale_running_task_failed",
] as const;

const requiredDiagnosticRefs = ["authGate", "detectedState", "diagnosticStage", "pageTitle", "pageUrlPath"] as const;

const forbiddenFlowTokens = [
  "setFileInputFiles",
  "callbackUrl",
  "XMLHttpRequest",
  "rowMatchScore",
  "pickBestSkuRow",
  "findAfter",
  "readFieldAfter",
  "expectedOutputOverride",
] as const;

const addFinding = (findings: InspectorFinding[], lawId: string, filePath: string, message: string): void => {
  findings.push(createFinding({ checkId: "amazon-product-sync/contract", filePath, lawId, message }));
};

const source = (project: Project, repoPath: string): SourceFile | undefined => project.getSourceFile(resolveFromRepo(repoPath));
const property = (objectLiteral: ObjectLiteralExpression, name: string) =>
  objectLiteral.getProperties().find((item) => Node.isPropertyAssignment(item) && item.getName() === name);

const literalText = (objectLiteral: ObjectLiteralExpression, name: string): string | null => {
  const item = property(objectLiteral, name);
  if (!item || !Node.isPropertyAssignment(item)) return null;
  const initializer = item.getInitializer();
  return initializer && (Node.isStringLiteral(initializer) || Node.isNoSubstitutionTemplateLiteral(initializer))
    ? initializer.getLiteralText()
    : null;
};

const booleanLiteral = (objectLiteral: ObjectLiteralExpression, name: string): boolean | null => {
  const item = property(objectLiteral, name);
  if (!item || !Node.isPropertyAssignment(item)) return null;
  const initializer = item.getInitializer();
  if (!initializer) return null;
  if (initializer.getKind() === SyntaxKind.TrueKeyword) return true;
  if (initializer.getKind() === SyntaxKind.FalseKeyword) return false;
  return null;
};

const objectLiteralProperty = (objectLiteral: ObjectLiteralExpression, name: string): ObjectLiteralExpression | null => {
  const item = property(objectLiteral, name);
  if (!item || !Node.isPropertyAssignment(item)) return null;
  const initializer = item.getInitializer();
  return initializer && Node.isObjectLiteralExpression(initializer) ? initializer : null;
};

const propertyInitializerText = (objectLiteral: ObjectLiteralExpression, name: string): string | null => {
  const item = property(objectLiteral, name);
  if (!item || !Node.isPropertyAssignment(item)) return null;
  return item.getInitializer()?.getText() ?? null;
};

const arrayLiteralTexts = (objectLiteral: ObjectLiteralExpression, name: string): string[] => {
  const item = property(objectLiteral, name);
  if (!item || !Node.isPropertyAssignment(item)) return [];
  const initializer = item.getInitializer();
  if (!initializer || !Node.isArrayLiteralExpression(initializer)) return [];
  return initializer.getElements().flatMap((element) =>
    (Node.isStringLiteral(element) || Node.isNoSubstitutionTemplateLiteral(element)) ? [element.getLiteralText()] : [],
  );
};

const hasObjectProperty = (objectLiteral: ObjectLiteralExpression, name: string): boolean => Boolean(property(objectLiteral, name));
const nestedLiteralText = (objectLiteral: ObjectLiteralExpression, parent: string, child: string): string | null => {
  const nested = objectLiteralProperty(objectLiteral, parent);
  return nested ? literalText(nested, child) : null;
};

const nestedPropertyInitializerText = (objectLiteral: ObjectLiteralExpression, parent: string, child: string): string | null => {
  const nested = objectLiteralProperty(objectLiteral, parent);
  return nested ? propertyInitializerText(nested, child) : null;
};

const hasNestedObjectProperty = (objectLiteral: ObjectLiteralExpression, parent: string, child: string): boolean => {
  const nested = objectLiteralProperty(objectLiteral, parent);
  return nested ? hasObjectProperty(nested, child) : false;
};

const hasPropertyBelow = (objectLiteral: ObjectLiteralExpression, name: string): boolean =>
  objectLiteral.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression).some((child) => hasObjectProperty(child, name));

const runtimeEmitObjects = (sourceFile: SourceFile | undefined): ObjectLiteralExpression[] =>
  sourceFile?.getDescendantsOfKind(SyntaxKind.CallExpression).flatMap((callExpression) => {
    const expression = callExpression.getExpression();
    if (!Node.isPropertyAccessExpression(expression) || expression.getName() !== "emit") return [];
    const firstArg = callExpression.getArguments()[0];
    return firstArg && Node.isObjectLiteralExpression(firstArg) ? [firstArg] : [];
  }) ?? [];

const emitObjectsForEvent = (
  sourceFile: SourceFile | undefined,
  eventName: string,
): ObjectLiteralExpression[] =>
  runtimeEmitObjects(sourceFile).filter((objectLiteral) => nestedLiteralText(objectLiteral, "refs", "event") === eventName);

const hasFlowVisibility = (objectLiteral: ObjectLiteralExpression): boolean =>
  arrayLiteralTexts(objectLiteral, "modeVisibility").includes("FLOW");

const functionHasCall = (sourceFile: SourceFile | undefined, functionName: string, callName: string): boolean => {
  const declaration = sourceFile?.getFunctions().find((item) => item.getName() === functionName)
    ?? sourceFile?.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
      .find((item) => item.getName() === functionName)
      ?.getInitializer();
  return Boolean(declaration?.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return (Node.isIdentifier(expression) && expression.getText() === callName)
      || (Node.isPropertyAccessExpression(expression) && expression.getName() === callName);
  }));
};

const hasStringToken = (sourceFile: SourceFile | undefined, value: string): boolean =>
  Boolean(sourceFile?.getDescendants().some((node) =>
    ((Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) && node.getLiteralText().includes(value))
    || (
      Node.isTemplateExpression(node)
      && (
        node.getHead().getLiteralText().includes(value)
        || node.getTemplateSpans().some((span) => span.getLiteral().getLiteralText().includes(value))
      )
    ),
  ));

const hasIdentifier = (sourceFile: SourceFile | undefined, name: string): boolean =>
  Boolean(sourceFile?.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => identifier.getText() === name));

const hasCallName = (sourceFile: SourceFile | undefined, name: string): boolean =>
  Boolean(sourceFile?.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return (Node.isIdentifier(expression) && expression.getText() === name)
      || (Node.isPropertyAccessExpression(expression) && expression.getName() === name);
  }));

const hasTokenInAny = (sourceFiles: readonly (SourceFile | undefined)[], value: string): boolean =>
  sourceFiles.some((sourceFile) => hasStringToken(sourceFile, value) || hasIdentifier(sourceFile, value) || hasCallName(sourceFile, value));

const hasRouteRule = (sourceFile: SourceFile | undefined, path: string, method: string): boolean =>
  Boolean(sourceFile?.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression).some((objectLiteral) =>
    literalText(objectLiteral, "path") === path
    && literalText(objectLiteral, "method") === method
    && literalText(objectLiteral, "jobOwner") === domain
    && booleanLiteral(objectLiteral, "externalApiAllowed") === true
    && booleanLiteral(objectLiteral, "requiresApiKey") === true,
  ));

const pluginStatusCount = (): number => {
  const raw = JSON.parse(readFileSync(resolveFromRepo(pluginStatusPath), "utf8")) as unknown;
  const visit = (value: unknown): number => {
    if (Array.isArray(value)) return value.reduce((sum, item) => sum + visit(item), 0);
    if (!value || typeof value !== "object") return 0;
    const record = value as Record<string, unknown>;
    let count = record["pluginId"] === domain ? 1 : 0;
    for (const item of Object.values(record)) {
      count += visit(item);
    }
    return count;
  };
  return visit(raw);
};

const inspectRequiredFiles = (findings: InspectorFinding[], lawId: string): void => {
  for (const file of requiredFiles) {
    if (!existsSync(resolveFromRepo(file))) {
      addFinding(findings, lawId, file, `missing required file: ${file}`);
    }
  }
};

const inspectBoundary = (boundary: SourceFile | undefined, findings: InspectorFinding[], lawId: string): void => {
  if (!hasRouteRule(boundary, "/api/plugins/amazon-product-sync/start", "POST")) addFinding(findings, lawId, boundaryPath, "boundary missing external API-key amazon-product-sync start route");
  if (!hasRouteRule(boundary, "/api/plugins/amazon-product-sync/latest", "GET")) addFinding(findings, lawId, boundaryPath, "boundary missing external API-key amazon-product-sync latest route");
  if (!hasRouteRule(boundary, "/api/plugins/amazon-product-sync/status/", "GET")) addFinding(findings, lawId, boundaryPath, "boundary missing external API-key amazon-product-sync status route");
};

const inspectSchema = (schema: SourceFile | undefined, findings: InspectorFinding[], lawId: string): void => {
  if (hasIdentifier(schema, "requestedAt")) {
    addFinding(findings, lawId, schemaPath, "Amazon product sync input must not require requestedAt outside the law-approved input shape");
  }
  for (const required of ["site", "requiredFields", "AmazonProductSyncRequiredFieldSchema", "missingRequestedFields", "blocked"]) {
    if (!hasIdentifier(schema, required) && !hasStringToken(schema, required)) addFinding(findings, lawId, schemaPath, `schema missing website request/status contract token: ${required}`);
  }
  for (const required of ["mainImage", "asin", "availableInventory", "actualInventory", "actualInventoryUnits"]) {
    if (!hasIdentifier(schema, required) && !hasStringToken(schema, required)) addFinding(findings, lawId, schemaPath, `schema missing required field token: ${required}`);
  }
  for (const required of ["AmazonProductSyncAllRequiredFields", "containsAllProductUpdateFields", "Amazon product update must request mainImage, asin, availableInventory, and actualInventory."]) {
    if (!hasIdentifier(schema, required) && !hasStringToken(schema, required)) addFinding(findings, lawId, schemaPath, `schema must enforce fixed product update requiredFields: ${required}`);
  }
  for (const required of ["length", "Amazon product sync task must contain exactly one SKU item; website side owns the SKU queue."]) {
    if (!hasIdentifier(schema, required) && !hasStringToken(schema, required)) addFinding(findings, lawId, schemaPath, `schema must reject multi-SKU AGENT tasks: ${required}`);
  }
  for (const required of ["AmazonProductSyncItemDiagnostic", ...requiredDiagnosticRefs]) {
    if (!hasIdentifier(schema, required) && !hasStringToken(schema, required)) addFinding(findings, lawId, schemaPath, `schema missing auth/page diagnostic contract token: ${required}`);
  }
};

const inspectFlow = (flow: SourceFile | undefined, findings: InspectorFinding[], lawId: string): void => {
  for (const forbidden of forbiddenFlowTokens) {
    if (hasIdentifier(flow, forbidden) || hasCallName(flow, forbidden) || hasStringToken(flow, forbidden)) {
      addFinding(findings, lawId, flowPath, `flow must not use forbidden token: ${forbidden}`);
    }
  }
  if (hasCallName(flow, "fetch")) addFinding(findings, lawId, flowPath, "flow must not fetch website callbackUrl or any external callback");
  for (const required of ["BrowserController", "buildInventorySearchProbeScript", "buildInventorySearchSubmitScript", "buildInventoryExtractionScript", "expandSellerCentralParentRows"]) {
    if (!hasIdentifier(flow, required)) addFinding(findings, lawId, flowPath, `flow missing required AST token: ${required}`);
  }
  for (const required of ["open", "click", "evaluateActiveTab", "screenshotRegion"]) {
    if (!hasCallName(flow, required)) addFinding(findings, lawId, flowPath, `flow missing BrowserController action call: ${required}`);
  }
  if (!hasStringToken(flow, "reuse-host-tab")) addFinding(findings, lawId, flowPath, "flow must reuse Seller Central host tab instead of the active website tab");
  for (const required of ["topGlobalSearchExcluded", "inventorySearchUsesShadowInput", "searchVerified", "searchVerificationEvidence", "requestedFields", "missingRequestedFields", "captureMainImageEvidenceRef", "actualInventoryUnits"]) {
    if (!hasIdentifier(flow, required)) addFinding(findings, lawId, flowPath, `flow missing inventory search/evidence contract token: ${required}`);
  }
  for (const required of ["AmazonProductSyncItemDiagnostic", "buildDiagnostic", "authGateFromState", "pageUrlPath", ...requiredDiagnosticRefs]) {
    if (!hasIdentifier(flow, required)) addFinding(findings, lawId, flowPath, `flow missing auth/page diagnostic propagation token: ${required}`);
  }
  inspectSubmitSearchDiagnostic(flow, findings, lawId);
};

const inspectSubmitSearchDiagnostic = (flow: SourceFile | undefined, findings: InspectorFinding[], lawId: string): void => {
  const declaration = flow?.getFunctions().find((item) => item.getName() === "submitInventorySearch")
    ?? flow?.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
      .find((item) => item.getName() === "submitInventorySearch")
      ?.getInitializer();
  if (!declaration) {
    addFinding(findings, lawId, flowPath, "flow missing submitInventorySearch diagnostic owner function");
    return;
  }
  const buildMissingItemCalls = declaration.getDescendantsOfKind(SyntaxKind.CallExpression).filter((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === "buildMissingItem";
  });
  for (const callExpression of buildMissingItemCalls) {
    if (callExpression.getArguments().length < 5) {
      addFinding(findings, lawId, flowPath, "submitInventorySearch failure item must pass submitResult diagnostic into buildMissingItem");
    }
  }
  const diagnosticDeclaration = declaration.getDescendantsOfKind(SyntaxKind.VariableDeclaration).find((item) => item.getName() === "diagnostic");
  const diagnosticInitializer = diagnosticDeclaration?.getInitializer();
  const diagnosticObject = diagnosticInitializer?.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)[0];
  if (!diagnosticInitializer || !hasCallName(flow, "buildDiagnostic")) {
    addFinding(findings, lawId, flowPath, "submitInventorySearch must build auth/page diagnostic from submitResult");
    return;
  }
  if (!diagnosticObject) {
    addFinding(findings, lawId, flowPath, "submitInventorySearch diagnostic must use a structured object literal");
    return;
  }
  for (const field of ["detectedState", "title", "url"]) {
    const initializer = propertyInitializerText(diagnosticObject, field);
    if (!initializer?.startsWith(`submitResult.${field}`)) addFinding(findings, lawId, flowPath, `submitInventorySearch diagnostic must derive ${field} from submitResult.${field}`);
  }
  if (literalText(diagnosticObject, "stageName") !== "seller_central_inventory_filter_submit") {
    addFinding(findings, lawId, flowPath, "submitInventorySearch diagnostic must classify seller_central_inventory_filter_submit stage");
  }
};

const inspectTaskService = (taskService: SourceFile | undefined, findings: InspectorFinding[], lawId: string): void => {
  for (const required of ["flowTimeoutMs", "resolveFlowTimeoutMs", "amazon_product_sync_flow_timeout_after_"]) {
    if (!hasIdentifier(taskService, required) && !hasStringToken(taskService, required)) addFinding(findings, lawId, taskServicePath, `task service missing bounded terminal timeout token: ${required}`);
  }
  for (const required of ["AmazonProductSyncFlowProgress", "persistProgress", "latestProgress"]) {
    if (!hasIdentifier(taskService, required)) addFinding(findings, lawId, taskServicePath, `task service must persist observable running progress: ${required}`);
  }
  for (const required of ["runningProgressStaleMs", "runningProgressStaleReason", "flow_progress_stale"]) {
    if (!hasIdentifier(taskService, required) && !hasStringToken(taskService, required)) addFinding(findings, lawId, taskServicePath, `task service must fail stale running progress: ${required}`);
  }
  for (const required of ["diagnosticValue", "itemAuthGate", "resolveFailureClass", "ACCOUNT_SECURITY_BLOCKER", ...requiredDiagnosticRefs]) {
    if (!hasIdentifier(taskService, required) && !hasStringToken(taskService, required)) addFinding(findings, lawId, taskServicePath, `task service missing auth/page diagnostic log token: ${required}`);
  }
};

const inspectRequiredLogEvents = (taskService: SourceFile | undefined, findings: InspectorFinding[], lawId: string): void => {
  const emitObjects = runtimeEmitObjects(taskService);
  if (emitObjects.length < requiredLogEvents.length) {
    addFinding(findings, lawId, taskServicePath, `runtime log matrix has only ${emitObjects.length} emit object(s); expected at least ${requiredLogEvents.length}`);
  }
  for (const eventName of requiredLogEvents) {
    const matches = emitObjectsForEvent(taskService, eventName);
    if (matches.length === 0) {
      addFinding(findings, lawId, taskServicePath, `runtime log matrix missing event: ${eventName}`);
      continue;
    }
    for (const objectLiteral of matches) {
      if (!hasFlowVisibility(objectLiteral)) addFinding(findings, lawId, taskServicePath, `runtime log event ${eventName} must be FLOW-visible`);
      if (literalText(objectLiteral, "owner") !== "local-runtime") addFinding(findings, lawId, taskServicePath, `runtime log event ${eventName} must use local-runtime owner`);
      if (nestedLiteralText(objectLiteral, "refs", "module") !== "amazon-product-sync") addFinding(findings, lawId, taskServicePath, `runtime log event ${eventName} must set refs.module=amazon-product-sync`);
    }
  }
};

const inspectProgressLogRefs = (taskService: SourceFile | undefined, findings: InspectorFinding[], lawId: string): void => {
  const progress = emitObjectsForEvent(taskService, "amazon_product_sync.progress")[0];
  if (!progress) return;
  for (const refName of ["site", "marketplace", "reachedStep", "previousStep", "itemCount", "reason", ...requiredDiagnosticRefs]) {
    if (!hasNestedObjectProperty(progress, "refs", refName)) addFinding(findings, lawId, taskServicePath, `progress log missing refs.${refName}`);
  }
  const reasonInitializer = nestedPropertyInitializerText(progress, "refs", "reason");
  if (reasonInitializer?.includes('"none"') || reasonInitializer?.includes("'none'")) {
    addFinding(findings, lawId, taskServicePath, "progress log refs.reason must not default to none; it must carry a bounded diagnostic reason");
  }
};

const inspectItemSummaryLog = (taskService: SourceFile | undefined, findings: InspectorFinding[], lawId: string): void => {
  const itemSummaries = emitObjectsForEvent(taskService, "amazon_product_sync.item_summary");
  if (itemSummaries.length === 0) return;
  for (const itemSummary of itemSummaries) {
    for (const refName of ["sellerSku", "itemStatus", "requestedFields", "missingRequestedFields", "availableFbaUnits", "actualInventoryUnits", "rowEvidenceRef", "mainImageEvidenceRef"]) {
      if (!hasNestedObjectProperty(itemSummary, "refs", refName)) addFinding(findings, lawId, taskServicePath, `item summary log missing refs.${refName}`);
    }
  }
  const reviewSummary = itemSummaries.find((itemSummary) => literalText(itemSummary, "status") === "review_required");
  if (!reviewSummary) return;
  for (const refName of requiredDiagnosticRefs) {
    if (!hasNestedObjectProperty(reviewSummary, "refs", refName)) addFinding(findings, lawId, taskServicePath, `review item summary log missing refs.${refName}`);
  }
  for (const payloadName of ["failureClass", "stageName", "retryable", "terminal", "recoveryPolicy"]) {
    if (!hasPropertyBelow(reviewSummary, payloadName)) addFinding(findings, lawId, taskServicePath, `item summary review log missing payload.${payloadName}`);
  }
  const failureClassInitializer = propertyInitializerText(objectLiteralProperty(reviewSummary, "payload") ?? reviewSummary, "failureClass");
  if (failureClassInitializer !== null && !failureClassInitializer.includes("resolveFailureClass")) {
    addFinding(findings, lawId, taskServicePath, "review item summary failureClass must be resolved from auth/page diagnostics");
  }
};

const inspectStaleRunningLog = (taskService: SourceFile | undefined, findings: InspectorFinding[], lawId: string): void => {
  const staleFailed = emitObjectsForEvent(taskService, "amazon_product_sync.stale_running_task_failed")[0];
  if (!staleFailed) return;
  if (!hasObjectProperty(staleFailed, "reason")) addFinding(findings, lawId, taskServicePath, "stale running task log missing stale reason");
  for (const payloadName of ["failureClass", "stageName", "retryable", "terminal", "recoveryPolicy"]) {
    if (!hasPropertyBelow(staleFailed, payloadName)) addFinding(findings, lawId, taskServicePath, `stale running task log missing payload.${payloadName}`);
  }
};

const inspectLogMatrix = (taskService: SourceFile | undefined, findings: InspectorFinding[], lawId: string): void => {
  inspectRequiredLogEvents(taskService, findings, lawId);
  inspectProgressLogRefs(taskService, findings, lawId);
  inspectItemSummaryLog(taskService, findings, lawId);
  inspectStaleRunningLog(taskService, findings, lawId);
  if (!functionHasCall(taskService, "persistProgress", "logProgress")) addFinding(findings, lawId, taskServicePath, "persistProgress must emit amazon_product_sync.progress before persisting task progress");
  if (!functionHasCall(taskService, "failStaleRunningTask", "logStaleRunningTask")) addFinding(findings, lawId, taskServicePath, "stale task failure path must emit amazon_product_sync.stale_running_task_failed");
  if (!hasCallName(taskService, "logItemSummary")) addFinding(findings, lawId, taskServicePath, "terminal flow success path must emit per-item amazon_product_sync.item_summary");
};

const inspectDomScripts = (
  flow: SourceFile | undefined,
  domScripts: SourceFile | undefined,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const scriptSources = [flow, domScripts] as const;
  for (const required of requiredFlowTokens) {
    if (!hasTokenInAny(scriptSources, required)) addFinding(findings, lawId, domScriptsPath, `DOM scripts missing verified DOM/search token: ${required}`);
  }
  for (const forbidden of forbiddenFlowTokens) {
    if (hasIdentifier(domScripts, forbidden) || hasCallName(domScripts, forbidden) || hasStringToken(domScripts, forbidden)) {
      addFinding(findings, lawId, domScriptsPath, `DOM scripts must not use forbidden token: ${forbidden}`);
    }
  }
  for (const required of ["buildInventorySearchProbeScript", "buildInventorySearchSubmitScript", "buildInventoryExtractionScript", "buildVariationExpansionProbeScript"]) {
    if (!hasIdentifier(domScripts, required)) addFinding(findings, lawId, domScriptsPath, `DOM scripts missing exported builder: ${required}`);
  }
  if (!hasIdentifier(domScripts, "actualInventoryUnits") && !hasStringToken(domScripts, "actualInventoryUnits")) addFinding(findings, lawId, domScriptsPath, "DOM scripts missing actualInventoryUnits extraction token");
};

const inspectAcceptance = (acceptance: SourceFile | undefined, findings: InspectorFinding[], lawId: string): void => {
  for (const required of ["site", "requiredFields", "missingRequestedFields", "actualInventoryUnits", "screenshotCalls", "closeActiveTabCalls", "clickLabels", "topGlobalSearchExcluded", "inventorySearchUsesShadowInput", "searchVerified"]) {
    if (!hasIdentifier(acceptance, required)) addFinding(findings, lawId, acceptancePath, `acceptance missing website/search assertion token: ${required}`);
  }
  for (const required of ["form#sc-global-search-form", "input#sc-search-field", "button.sc-search-button", "搜索 SKU、商品名称/关键词、FNSKU、ASIN、UPC/EAN", "shadowRoot", "input[type='text'], input", "dispatchEvent", "SearchBox-module__searchButton MouseEvent click", "searchClickDelayMs"]) {
    if (!hasStringToken(acceptance, required)) addFinding(findings, lawId, acceptancePath, `acceptance missing DOM exclusion assertion token: ${required}`);
  }
  for (const required of ["reuse-host-tab", "acceptance-amazon-product-sync-reject-partial-fields", "amazon_product_sync_flow_timeout_after_20ms"]) {
    if (!hasStringToken(acceptance, required)) addFinding(findings, lawId, acceptancePath, `acceptance missing fixed-field/tab/timeout assertion token: ${required}`);
  }
  if (!hasStringToken(acceptance, "acceptance-amazon-product-sync-reject-multi-sku-agent-task")) addFinding(findings, lawId, acceptancePath, "acceptance missing single-SKU AGENT task rejection assertion");
  for (const required of ["waitForRunningProgress", "seller_central_inventory_"]) {
    if (!hasIdentifier(acceptance, required) && !hasStringToken(acceptance, required)) addFinding(findings, lawId, acceptancePath, `acceptance missing observable progress assertion token: ${required}`);
  }
  if (!hasStringToken(acceptance, "amazon_product_sync_running_progress_stale_after_3000ms")) addFinding(findings, lawId, acceptancePath, "acceptance missing stale running progress failure assertion");
  if (!hasIdentifier(acceptance, "screenshotRegion")) addFinding(findings, lawId, acceptancePath, "acceptance must exercise screenshotRegion for main image evidence");
};

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const lawId = selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-PRODUCT-SYNC-003-V1");
  const logLawId = selectLawId(context.planEntry.lawIds, "GRASSEYE-RUNTIME-LOG-SPINE-016-V1");
  const findings: InspectorFinding[] = [];
  const boundary = source(context.project, boundaryPath);
  const server = source(context.project, serverPath);
  const schema = source(context.project, schemaPath);
  const flow = source(context.project, flowPath);
  const taskService = source(context.project, taskServicePath);
  const domScripts = source(context.project, domScriptsPath);
  const acceptance = source(context.project, acceptancePath);

  inspectRequiredFiles(findings, lawId);
  inspectBoundary(boundary, findings, lawId);
  inspectSchema(schema, findings, lawId);
  inspectFlow(flow, findings, lawId);
  inspectTaskService(taskService, findings, lawId);
  inspectLogMatrix(taskService, findings, logLawId);
  inspectDomScripts(flow, domScripts, findings, lawId);
  inspectAcceptance(acceptance, findings, lawId);
  if (!hasIdentifier(server, "handleAmazonProductSyncRequest")) addFinding(findings, lawId, serverPath, "server must route through handleAmazonProductSyncRequest");
  if (pluginStatusCount() !== 1) addFinding(findings, lawId, pluginStatusPath, "plugin-status must register amazon-product-sync exactly once");

  return {
    capabilityDomain: domain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...requiredFiles, boundaryPath, serverPath, pluginStatusPath, selfPath].sort(),
    reportJson: { generatedAt: new Date().toISOString(), status: findings.length === 0 ? "PASS" : "FAIL", findings },
  };
};

const runInspectorFromCli = async (): Promise<void> => {
  buildAuditArtifacts();
  const planEntry = loadGeneratedAuditPlan().find((entry) => entry.capabilityDomain === domain);
  if (!planEntry) throw new Error("amazon-product-sync audit plan entry is missing.");
  const output = await inspectDomain({ project: createAuditProject(), planEntry, generatedPlan: [planEntry], completedReports: {} });
  if (output.findings.length > 0) {
    for (const finding of output.findings.slice(0, 10)) {
      process.stderr.write(`[AUDIT] amazon-product-sync finding ${finding.filePath}: ${finding.message}\n`);
    }
    throw new Error(`amazon-product-sync failed with ${output.findings.length} finding(s).`);
  }
  process.stdout.write("[AUDIT] amazon-product-sync PASS\n");
};

const isEntrypoint = (): boolean => {
  const invokedPath = process.argv[1];
  return invokedPath !== undefined && resolve(invokedPath) === fileURLToPath(import.meta.url);
};
if (isEntrypoint()) await runInspectorFromCli();
