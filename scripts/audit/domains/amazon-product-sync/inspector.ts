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
const domScriptsPath = "src/plugins/amazon-product-sync/amazon-product-sync.dom-scripts.ts";
const acceptancePath = "scripts/acceptance/amazon-product-sync.acceptance.ts";

const requiredFiles = [
  ".github/instructions/agent-rules/modules/module-amazon-product-sync.instructions.md",
  "docs/法案辅助文件/GrassEye Amazon 产品更新同步施工图.md",
  "scripts/audit/domains/amazon-product-sync/manifest.json",
  schemaPath,
  flowPath,
  domScriptsPath,
  "src/plugins/amazon-product-sync/amazon-product-sync-task-service.ts",
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
  "searchTerm",
  "ProductDetails-module__container",
  "JanusSplitBox-module__row",
  "JanusSplitBox-module__panel",
  "JanusTable-module__tableContentRow",
  "SKU",
  "ASIN",
  "现货（亚马逊物流）",
  "inventory_search_result_dom_not_verified",
] as const;

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

const source = (project: Project, repoPath: string): SourceFile | undefined =>
  project.getSourceFile(resolveFromRepo(repoPath));

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

const hasStringToken = (sourceFile: SourceFile | undefined, value: string): boolean =>
  Boolean(sourceFile?.getDescendants().some((node) =>
    (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) && node.getLiteralText().includes(value),
  ));

const hasStringTokenInAny = (sourceFiles: readonly (SourceFile | undefined)[], value: string): boolean =>
  sourceFiles.some((sourceFile) => hasStringToken(sourceFile, value));

const hasIdentifier = (sourceFile: SourceFile | undefined, name: string): boolean =>
  Boolean(sourceFile?.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => identifier.getText() === name));

const hasCallName = (sourceFile: SourceFile | undefined, name: string): boolean =>
  Boolean(sourceFile?.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return (Node.isIdentifier(expression) && expression.getText() === name)
      || (Node.isPropertyAccessExpression(expression) && expression.getName() === name);
  }));

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
  for (const required of ["mainImage", "asin", "availableInventory"]) {
    if (!hasStringToken(schema, required)) addFinding(findings, lawId, schemaPath, `schema missing required field literal: ${required}`);
  }
};

const inspectFlow = (flow: SourceFile | undefined, findings: InspectorFinding[], lawId: string): void => {
  for (const forbidden of forbiddenFlowTokens) {
    if (hasIdentifier(flow, forbidden) || hasCallName(flow, forbidden) || hasStringToken(flow, forbidden)) {
      addFinding(findings, lawId, flowPath, `flow must not use forbidden token: ${forbidden}`);
    }
  }
  if (hasCallName(flow, "fetch")) addFinding(findings, lawId, flowPath, "flow must not fetch website callbackUrl or any external callback");
  for (const required of ["BrowserController", "buildInventorySearchProbeScript", "buildInventoryExtractionScript", "expandSellerCentralParentRows"]) {
    if (!hasIdentifier(flow, required)) addFinding(findings, lawId, flowPath, `flow missing required AST token: ${required}`);
  }
  for (const required of ["open", "click", "textInput", "evaluateActiveTab", "screenshotRegion"]) {
    if (!hasCallName(flow, required)) addFinding(findings, lawId, flowPath, `flow missing BrowserController action call: ${required}`);
  }
  for (const required of ["topGlobalSearchExcluded", "inventorySearchUsesShadowInput", "searchVerified", "searchVerificationEvidence", "requestedFields", "missingRequestedFields", "captureMainImageEvidenceRef"]) {
    if (!hasIdentifier(flow, required)) addFinding(findings, lawId, flowPath, `flow missing inventory search/evidence contract token: ${required}`);
  }
};

const inspectDomScripts = (
  flow: SourceFile | undefined,
  domScripts: SourceFile | undefined,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const scriptSources = [flow, domScripts] as const;
  for (const required of requiredFlowTokens) {
    if (!hasStringTokenInAny(scriptSources, required)) addFinding(findings, lawId, domScriptsPath, `DOM scripts missing verified DOM/search token: ${required}`);
  }
  for (const forbidden of forbiddenFlowTokens) {
    if (hasIdentifier(domScripts, forbidden) || hasCallName(domScripts, forbidden) || hasStringToken(domScripts, forbidden)) {
      addFinding(findings, lawId, domScriptsPath, `DOM scripts must not use forbidden token: ${forbidden}`);
    }
  }
  for (const required of ["buildInventorySearchProbeScript", "buildInventoryExtractionScript", "buildVariationExpansionProbeScript"]) {
    if (!hasIdentifier(domScripts, required)) addFinding(findings, lawId, domScriptsPath, `DOM scripts missing exported builder: ${required}`);
  }
};

const inspectAcceptance = (acceptance: SourceFile | undefined, findings: InspectorFinding[], lawId: string): void => {
  for (const required of ["site", "requiredFields", "missingRequestedFields", "screenshotCalls", "clickLabels", "textInputLabels", "topGlobalSearchExcluded", "inventorySearchUsesShadowInput", "searchVerified"]) {
    if (!hasIdentifier(acceptance, required)) addFinding(findings, lawId, acceptancePath, `acceptance missing website/search assertion token: ${required}`);
  }
  for (const required of ["form#sc-global-search-form", "input#sc-search-field", "button.sc-search-button", "搜索 SKU、商品名称/关键词、FNSKU、ASIN、UPC/EAN", "shadowRoot", "searchTerm"]) {
    if (!hasStringToken(acceptance, required)) addFinding(findings, lawId, acceptancePath, `acceptance missing DOM exclusion assertion token: ${required}`);
  }
  if (!hasIdentifier(acceptance, "screenshotRegion")) addFinding(findings, lawId, acceptancePath, "acceptance must exercise screenshotRegion for main image evidence");
};

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const lawId = selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-PRODUCT-SYNC-003-V1");
  const findings: InspectorFinding[] = [];
  const boundary = source(context.project, boundaryPath);
  const server = source(context.project, serverPath);
  const schema = source(context.project, schemaPath);
  const flow = source(context.project, flowPath);
  const domScripts = source(context.project, domScriptsPath);
  const acceptance = source(context.project, acceptancePath);

  inspectRequiredFiles(findings, lawId);
  inspectBoundary(boundary, findings, lawId);
  inspectSchema(schema, findings, lawId);
  inspectFlow(flow, findings, lawId);
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
  if (output.findings.length > 0) throw new Error(`amazon-product-sync failed with ${output.findings.length} finding(s).`);
  process.stdout.write("[AUDIT] amazon-product-sync PASS\n");
};

const isEntrypoint = (): boolean => {
  const invokedPath = process.argv[1];
  return invokedPath !== undefined && resolve(invokedPath) === fileURLToPath(import.meta.url);
};

if (isEntrypoint()) {
  await runInspectorFromCli();
}
