import { Node, SyntaxKind, type Expression, type SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import { type InspectorContext, type InspectorFinding, type InspectorOutput, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

const domain = "amazon-product-fee-sync";

const schemaPath = "src/plugins/amazon-product-fee-sync/amazon-product-fee-sync.schema.ts";
const domScriptsPath = "src/plugins/amazon-product-fee-sync/amazon-product-fee-sync.dom-scripts.ts";
const flowPath = "src/plugins/amazon-product-fee-sync/amazon-product-fee-sync.flow.ts";
const storagePath = "src/plugins/amazon-product-fee-sync/amazon-product-fee-sync.storage.ts";
const taskServicePath = "src/plugins/amazon-product-fee-sync/amazon-product-fee-sync-task-service.ts";
const indexPath = "src/plugins/amazon-product-fee-sync/index.ts";
const routePath = "src/app/workbench-amazon-product-fee-sync-routes.ts";
const apiBoundaryPath = "src/app/workbench-api-boundary.ts";
const serverPath = "src/app/create-workbench-server.ts";
const localRuntimePath = "src/lib/local-runtime/workbench-marketplace-handles.ts";
const localRuntimeHandlePath = "src/lib/local-runtime/workbench-handle.ts";
const acceptancePath = "scripts/acceptance/amazon-product-fee-sync.acceptance.ts";
const selfPath = "scripts/audit/domains/amazon-product-fee-sync/inspector.ts";
const manifestPath = "scripts/audit/domains/amazon-product-fee-sync/manifest.json";
const lawPath = ".github/instructions/agent-rules/modules/module-amazon-product-fee-sync.instructions.md";
const blueprintPath = "docs/法案辅助文件/GrassEye Amazon 产品费用同步施工图.md";

const inspectedFiles = [
  lawPath,
  blueprintPath,
  manifestPath,
  selfPath,
  schemaPath,
  domScriptsPath,
  flowPath,
  storagePath,
  taskServicePath,
  indexPath,
  routePath,
  apiBoundaryPath,
  serverPath,
  localRuntimePath,
  localRuntimeHandlePath,
  acceptancePath,
] as const;

const sourceFile = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(repoPath));

const addFinding = (
  findings: InspectorFinding[],
  lawId: string,
  filePath: string,
  checkId: string,
  message: string,
): void => {
  findings.push(createFinding({ checkId, filePath, lawId, message }));
};

const requireSourceFile = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
  repoPath: string,
): SourceFile | null => {
  const file = sourceFile(context, repoPath);
  if (file) {
    return file;
  }
  addFinding(findings, lawId, repoPath, "amazon-product-fee-sync/source-file-present", `${repoPath} must exist in the ts-morph project.`);
  return null;
};

const unwrapExpression = (expression: Expression): Expression => {
  if (Node.isAsExpression(expression) || Node.isSatisfiesExpression(expression) || Node.isParenthesizedExpression(expression)) {
    return unwrapExpression(expression.getExpression());
  }
  return expression;
};

const literalValues = (source: SourceFile): Set<string> =>
  new Set([
    ...source.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => literal.getLiteralText()),
    ...source.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((literal) => literal.getLiteralText()),
    ...source.getDescendantsOfKind(SyntaxKind.TemplateExpression).map((template) => template.getText()),
  ]);

const hasLiteral = (source: SourceFile | null | undefined, value: string): boolean =>
  Boolean(source && literalValues(source).has(value));

const hasLiteralContaining = (source: SourceFile | null | undefined, value: string): boolean =>
  Boolean(source && [...literalValues(source)].some((literal) => literal.includes(value)));

const hasIdentifier = (source: SourceFile | null | undefined, name: string): boolean =>
  Boolean(source?.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => identifier.getText() === name));

const hasCallName = (source: SourceFile | null | undefined, name: string): boolean =>
  Boolean(source?.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return (Node.isIdentifier(expression) && expression.getText() === name)
      || (Node.isPropertyAccessExpression(expression) && expression.getName() === name);
  }));

const zEnumValues = (source: SourceFile, variableName: string): Set<string> => {
  const initializer = source.getVariableDeclaration(variableName)?.getInitializer();
  if (!initializer || !Node.isCallExpression(initializer)) {
    return new Set();
  }
  const [firstArgument] = initializer.getArguments();
  if (!firstArgument || !Node.isArrayLiteralExpression(firstArgument)) {
    return new Set();
  }
  return new Set(firstArgument.getElements().flatMap((element) =>
    Node.isStringLiteral(element) ? [element.getLiteralText()] : []));
};

const arrayVariableValues = (source: SourceFile, variableName: string): Set<string> => {
  const initializer = source.getVariableDeclaration(variableName)?.getInitializer();
  if (!initializer || !Node.isArrayLiteralExpression(initializer)) {
    const unwrapped = initializer ? unwrapExpression(initializer) : null;
    if (!unwrapped || !Node.isArrayLiteralExpression(unwrapped)) {
      return new Set();
    }
    return new Set(unwrapped.getElements().flatMap((element) =>
      Node.isStringLiteral(element) ? [element.getLiteralText()] : []));
  }
  return new Set(initializer.getElements().flatMap((element) =>
    Node.isStringLiteral(element) ? [element.getLiteralText()] : []));
};

const inspectTaskService = (source: SourceFile | null, findings: InspectorFinding[], lawId: string): void => {
  if (!source) {
    return;
  }
  for (const eventName of [
    "amazon_product_fee_sync.start_received",
    "amazon_product_fee_sync.queued",
    "amazon_product_fee_sync.progress",
    "amazon_product_fee_sync.item_summary",
    "amazon_product_fee_sync.flow_finished",
    "amazon_product_fee_sync.flow_failed",
    "amazon_product_fee_sync.stale_running_task_failed",
  ]) {
    if (!hasLiteral(source, eventName)) {
      addFinding(findings, lawId, taskServicePath, "amazon-product-fee-sync/runtime-log", `Task service must emit ${eventName}.`);
    }
  }
  if (!hasIdentifier(source, "runningProgressStaleMs") || !hasLiteralContaining(source, "amazon_product_fee_sync_running_progress_stale_after_")) {
    addFinding(findings, lawId, taskServicePath, "amazon-product-fee-sync/stale-running-task", "Task service must fail stale queued/running tasks that have not advanced recently.");
  }
};

const inspectSchema = (source: SourceFile | null, findings: InspectorFinding[], lawId: string): void => {
  if (!source) {
    return;
  }
  const requiredFieldEnum = zEnumValues(source, "AmazonProductFeeSyncRequiredFieldSchema");
  const allRequiredFields = arrayVariableValues(source, "AmazonProductFeeSyncAllRequiredFields");
  for (const field of ["totalAmazonFee", "fbaFulfillmentFee"]) {
    if (!requiredFieldEnum.has(field) || !allRequiredFields.has(field)) {
      addFinding(findings, lawId, schemaPath, "amazon-product-fee-sync/required-fields", `${field} must be declared as a fixed-scope requested fee field.`);
    }
  }
  if (!hasLiteral(source, "Amazon product fee sync must request totalAmazonFee and fbaFulfillmentFee together.")) {
    addFinding(findings, lawId, schemaPath, "amazon-product-fee-sync/field-pair-rejection", "Schema must reject requests that do not ask for totalAmazonFee and fbaFulfillmentFee together.");
  }
  if (!hasLiteral(source, "Amazon product fee sync task must contain exactly one SKU item; website side owns the SKU queue.")) {
    addFinding(findings, lawId, schemaPath, "amazon-product-fee-sync/single-sku", "Schema must reject multi-SKU fee sync task input.");
  }
  for (const forbidden of ["selector", "actionPlan", "browserCommand", "flowStep", "callbackUrl", "cookie", "sellerCentralCookie"]) {
    if (hasLiteral(source, forbidden)) {
      addFinding(findings, lawId, schemaPath, "amazon-product-fee-sync/external-control", `Schema must not expose external browser control field ${forbidden}.`);
    }
  }
};

const inspectDomScripts = (source: SourceFile | null, findings: InspectorFinding[], lawId: string): void => {
  if (!source) {
    return;
  }
  for (const required of [
    "总费用",
    "亚马逊物流费用",
    "not_visible_in_current_dom",
    "derived_total_minus_fba_not_referral",
    "input[type='text'], input",
  ]) {
    if (!hasLiteral(source, required)) {
      addFinding(findings, lawId, domScriptsPath, "amazon-product-fee-sync/dom-contract", `DOM scripts must preserve required fee/search literal ${required}.`);
    }
  }
  for (const exportedFunction of [
    "buildInventoryFeeSearchProbeScript",
    "buildInventoryFeeSearchSubmitScript",
    "buildInventoryFeeSearchButtonClickScript",
    "buildInventoryFeeExtractionScript",
    "parseAmazonFeeMoney",
    "deriveAmazonFeeResidual",
  ]) {
    if (!hasIdentifier(source, exportedFunction)) {
      addFinding(findings, lawId, domScriptsPath, "amazon-product-fee-sync/dom-export", `${exportedFunction} must remain owned by fee sync DOM scripts.`);
    }
  }
  for (const templateToken of [
    "form#sc-global-search-form",
    "topGlobalSearchExcluded",
    "Object.defineProperty",
    "ProductDetails-module__container",
    "JanusSplitBox-module__row",
    "SKU",
  ]) {
    if (!hasLiteralContaining(source, templateToken)) {
      addFinding(findings, lawId, domScriptsPath, "amazon-product-fee-sync/inventory-search", `DOM scripts must preserve inventory-filter search evidence token ${templateToken}.`);
    }
  }
  if (hasLiteralContaining(source, "rowMatchScore") || hasLiteralContaining(source, "expectedOutputOverride")) {
    addFinding(findings, lawId, domScriptsPath, "amazon-product-fee-sync/no-fuzzy-row-match", "DOM scripts must not use fuzzy row matching or expected output overrides.");
  }
};

const inspectFlow = (source: SourceFile | null, findings: InspectorFinding[], lawId: string): void => {
  if (!source) {
    return;
  }
  for (const required of [
    "buildInventoryFeeSearchProbeScript",
    "buildInventoryFeeSearchSubmitScript",
    "buildInventoryFeeSearchButtonClickScript",
    "buildInventoryFeeExtractionScript",
    "rowEvidenceRef",
    "feeEvidenceRef",
    "not_visible_in_current_dom",
  ]) {
    if (!hasIdentifier(source, required) && !hasLiteral(source, required)) {
      addFinding(findings, lawId, flowPath, "amazon-product-fee-sync/flow-contract", `Flow must preserve ${required}.`);
    }
  }
  for (const forbiddenCall of ["setFileInputFiles", "type", "fill"]) {
    if (hasCallName(source, forbiddenCall)) {
      addFinding(findings, lawId, flowPath, "amazon-product-fee-sync/read-only-flow", `Fee sync flow must not call browser write primitive ${forbiddenCall}.`);
    }
  }
  for (const forbiddenLiteral of ["callbackUrl", "rawHtml", "cookie", "password", "expectedOutputOverride"]) {
    if (hasLiteral(source, forbiddenLiteral)) {
      addFinding(findings, lawId, flowPath, "amazon-product-fee-sync/evidence-safety", `Flow must not expose ${forbiddenLiteral}.`);
    }
  }
};

const inspectApiSurface = (
  sources: {
    apiBoundary: SourceFile | null;
    server: SourceFile | null;
    runtime: SourceFile | null;
    runtimeHandle: SourceFile | null;
  },
  findings: InspectorFinding[],
  lawId: string,
): void => {
  if (!hasLiteral(sources.apiBoundary, "/api/plugins/amazon-product-fee-sync/start")
    || !hasLiteral(sources.apiBoundary, "/api/plugins/amazon-product-fee-sync/status/")
    || !hasLiteral(sources.apiBoundary, "/api/plugins/amazon-product-fee-sync/latest")
    || !hasLiteral(sources.apiBoundary, domain)) {
    addFinding(findings, lawId, apiBoundaryPath, "amazon-product-fee-sync/api-boundary", "API boundary must expose only the explicit fee-sync route namespace.");
  }
  if (!hasIdentifier(sources.server, "handleAmazonProductFeeSyncRequest")) {
    addFinding(findings, lawId, serverPath, "amazon-product-fee-sync/server-route", "Workbench server must register the fee sync route handler.");
  }
  for (const required of [
    "startAmazonProductFeeSyncTask",
    "getAmazonProductFeeSyncTaskStatus",
    "getLatestAmazonProductFeeSyncTask",
  ]) {
    if (!hasIdentifier(sources.runtime, required) || !hasIdentifier(sources.runtimeHandle, required)) {
      addFinding(findings, lawId, localRuntimePath, "amazon-product-fee-sync/workbench-runtime", `${required} must stay on the existing Workbench task status chain.`);
    }
  }
};

const inspectProductSyncIsolation = (context: InspectorContext, findings: InspectorFinding[], lawId: string): void => {
  const productSyncSchema = sourceFile(context, "src/plugins/amazon-product-sync/amazon-product-sync.schema.ts");
  if (!productSyncSchema) {
    return;
  }
  if (hasLiteral(productSyncSchema, "totalAmazonFee") || hasLiteral(productSyncSchema, "fbaFulfillmentFee")) {
    addFinding(findings, lawId, "src/plugins/amazon-product-sync/amazon-product-sync.schema.ts", "amazon-product-fee-sync/product-sync-pollution", "Fee fields must not be added to amazon-product-sync requiredFields.");
  }
};



const inspectDomainEvaluation = async (context: InspectorContext): Promise<Omit<InspectorOutput, "executedChecks">> => {
  const lawId = selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-PRODUCT-FEE-SYNC-001-V1");
  const findings: InspectorFinding[] = [];
  const schema = requireSourceFile(context, findings, lawId, schemaPath);
  const domScripts = requireSourceFile(context, findings, lawId, domScriptsPath);
  const flow = requireSourceFile(context, findings, lawId, flowPath);
  requireSourceFile(context, findings, lawId, storagePath);
  const taskService = requireSourceFile(context, findings, lawId, taskServicePath);
  requireSourceFile(context, findings, lawId, indexPath);
  requireSourceFile(context, findings, lawId, routePath);
  const apiBoundary = requireSourceFile(context, findings, lawId, apiBoundaryPath);
  const server = requireSourceFile(context, findings, lawId, serverPath);
  const runtime = requireSourceFile(context, findings, lawId, localRuntimePath);
  const runtimeHandle = requireSourceFile(context, findings, lawId, localRuntimeHandlePath);
  requireSourceFile(context, findings, lawId, acceptancePath);

  inspectSchema(schema, findings, lawId);
  inspectDomScripts(domScripts, findings, lawId);
  inspectFlow(flow, findings, lawId);
  inspectTaskService(taskService, findings, lawId);
  inspectApiSurface({ apiBoundary, server, runtime, runtimeHandle }, findings, lawId);
  inspectProductSyncIsolation(context, findings, lawId);

  return {
    capabilityDomain: domain,
    reportedLawIds: [lawId],

    findings,
    inspectedFiles: [...inspectedFiles],
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  if (!context.checks) throw new Error("amazon-product-fee-sync requires a runner-owned check session.");
  let reportJson: unknown;
  let reportMarkdown: string | undefined;
  await context.checks.runAll(async () => {
    const evaluation = await inspectDomainEvaluation(context);
    reportJson = evaluation.reportJson;
    reportMarkdown = evaluation.reportMarkdown;
    return {
      findings: evaluation.findings,
      evidenceRefs: [context.planEntry.ownerInspectorPath, ...evaluation.inspectedFiles],
    };
  });
  return context.checks.output({
    ...(reportJson === undefined ? {} : { reportJson }),
    ...(reportMarkdown === undefined ? {} : { reportMarkdown }),
  });
};
