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

const requiredFiles = [
  ".github/instructions/agent-rules/modules/module-amazon-product-sync.instructions.md",
  "docs/法案辅助文件/GrassEye Amazon 产品更新同步施工图.md",
  "scripts/audit/domains/amazon-product-sync/manifest.json",
  schemaPath,
  flowPath,
  "src/plugins/amazon-product-sync/amazon-product-sync-task-service.ts",
  "src/plugins/amazon-product-sync/amazon-product-sync.storage.ts",
  "src/plugins/amazon-product-sync/index.ts",
  "src/app/workbench-amazon-product-sync-routes.ts",
  "scripts/acceptance/amazon-product-sync.acceptance.ts",
] as const;

const structuralDomTokens = [
  "VariationExpander-module__expanderHeader",
  "ProductDetails-module__container",
  "JanusSplitBox-module__row",
  "JanusSplitBox-module__panel",
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

const usesTextFallback = (sourceFile: SourceFile | undefined): boolean =>
  Boolean(sourceFile?.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    if (!Node.isPropertyAccessExpression(expression)) return false;
    if (expression.getName() === "includes" && callExpression.getArguments().some((arg) => Node.isIdentifier(arg) && arg.getText() === "normalized")) return true;
    return expression.getName() === "toUpperCase" && expression.getExpression().getText() === "row.text";
  }));

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
};

const inspectFlow = (flow: SourceFile | undefined, findings: InspectorFinding[], lawId: string): void => {
  for (const forbidden of ["setFileInputFiles", "textInput", "rowMatchScore", "pickBestSkuRow", "findAfter", "readFieldAfter"]) {
    if (hasIdentifier(flow, forbidden) || hasCallName(flow, forbidden)) addFinding(findings, lawId, flowPath, `flow must not use forbidden token: ${forbidden}`);
  }
  if (usesTextFallback(flow)) addFinding(findings, lawId, flowPath, "flow must not use normalized includes or row.text uppercase fallback matching");
  for (const required of ["BrowserController", "expandSellerCentralParentRows", "buildVariationExpansionProbeScript"]) {
    if (!hasIdentifier(flow, required)) addFinding(findings, lawId, flowPath, `flow missing required AST token: ${required}`);
  }
  if (!hasCallName(flow, "click")) addFinding(findings, lawId, flowPath, "flow missing read-only parent variation expansion click");
  for (const required of structuralDomTokens) {
    if (!hasStringToken(flow, required)) addFinding(findings, lawId, flowPath, `flow missing verified structural DOM token: ${required}`);
  }
};

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const lawId = selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-PRODUCT-SYNC-001-V1");
  const findings: InspectorFinding[] = [];
  const boundary = source(context.project, boundaryPath);
  const server = source(context.project, serverPath);
  const schema = source(context.project, schemaPath);
  const flow = source(context.project, flowPath);

  inspectRequiredFiles(findings, lawId);
  inspectBoundary(boundary, findings, lawId);
  inspectSchema(schema, findings, lawId);
  inspectFlow(flow, findings, lawId);
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
