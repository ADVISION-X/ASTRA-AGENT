import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import { existsSync, readFileSync } from "node:fs";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import { type InspectorContext, type InspectorFinding, type InspectorOutput, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

const domain = "amazon-listing-edit-read-sync";

const lawPath = ".github/instructions/agent-rules/modules/module-amazon-listing-edit-read-sync.instructions.md";
const blueprintPath = "docs/法案辅助文件/GrassEye Amazon Listing Edit Read Sync 施工图.md";
const manifestPath = "scripts/audit/domains/amazon-listing-edit-read-sync/manifest.json";
const selfPath = "scripts/audit/domains/amazon-listing-edit-read-sync/inspector.ts";
const schemaPath = "src/plugins/amazon-listing-edit-read-sync/amazon-listing-edit-read-sync.schema.ts";
const domScriptsPath = "src/plugins/amazon-listing-edit-read-sync/amazon-listing-edit-read-sync.dom-scripts.ts";
const flowPath = "src/plugins/amazon-listing-edit-read-sync/amazon-listing-edit-read-sync.flow.ts";
const inventorySearchPath = "src/plugins/amazon-listing-edit-read-sync/amazon-listing-edit-read-sync.inventory-search.ts";
const targetResolutionPath = "src/plugins/amazon-listing-edit-read-sync/amazon-listing-edit-read-sync.target-resolution.ts";
const urlsPath = "src/plugins/amazon-listing-edit-read-sync/amazon-listing-edit-read-sync.urls.ts";
const storagePath = "src/plugins/amazon-listing-edit-read-sync/amazon-listing-edit-read-sync.storage.ts";
const taskServicePath = "src/plugins/amazon-listing-edit-read-sync/amazon-listing-edit-read-sync-task-service.ts";
const indexPath = "src/plugins/amazon-listing-edit-read-sync/index.ts";
const routePath = "src/app/workbench-amazon-listing-edit-read-sync-routes.ts";
const workspacePath = "src/app/app-shell/amazon-listing-edit-read-sync-workspace.ts";
const appShellPath = "src/app/app-shell/app-shell.ts";
const skillRegistryPath = "src/app/app-shell/skill-registry.ts";
const clientPath = "src/app/workbench-home-amazon-listing-edit-read-sync-client.ts";
const apiBoundaryPath = "src/app/workbench-api-boundary.ts";
const serverPath = "src/app/create-workbench-server.ts";
const runtimePath = "src/lib/local-runtime/workbench.ts";
const runtimeSupportPath = "src/lib/local-runtime/workbench-amazon-listing-edit-read-sync-support.ts";
const runtimeHandlePath = "src/lib/local-runtime/workbench-handle.ts";
const acceptancePath = "scripts/acceptance/amazon-listing-edit-read-sync.acceptance.ts";
const pluginStatusPath = "scripts/audit/config/plugin-status.json";
const ciPhasePath = "scripts/audit/ci-full-phase-plan.ts";
const ciAcceptanceBindingsPath = "scripts/audit/ci-acceptance-law-bindings.ts";
const packagePath = "package.json";

const inspectedFiles = [
  lawPath,
  blueprintPath,
  manifestPath,
  selfPath,
  schemaPath,
  domScriptsPath,
  flowPath,
  inventorySearchPath,
  targetResolutionPath,
  urlsPath,
  storagePath,
  taskServicePath,
  indexPath,
  routePath,
  workspacePath,
  appShellPath,
  skillRegistryPath,
  clientPath,
  apiBoundaryPath,
  serverPath,
  runtimePath,
  runtimeSupportPath,
  runtimeHandlePath,
  acceptancePath,
  pluginStatusPath,
  ciPhasePath,
  ciAcceptanceBindingsPath,
  packagePath,
] as const;

const sourceFile = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(repoPath));

const readRepoTextIfExists = (repoPath: string): string | null => {
  const absolutePath = resolveFromRepo(repoPath);
  return existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : null;
};

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
  if (file) return file;
  addFinding(findings, lawId, repoPath, "amazon-listing-edit-read-sync/source-file-present", `${repoPath} must exist.`);
  return null;
};

const requireRepoFile = (
  findings: InspectorFinding[],
  lawId: string,
  repoPath: string,
): string | null => {
  const text = readRepoTextIfExists(repoPath);
  if (text !== null) return text;
  addFinding(findings, lawId, repoPath, "amazon-listing-edit-read-sync/source-file-present", `${repoPath} must exist.`);
  return null;
};

const literalValues = (source: SourceFile | null | undefined): Set<string> =>
  new Set(source ? [
    ...source.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => literal.getLiteralText()),
    ...source.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((literal) => literal.getLiteralText()),
    ...source.getDescendantsOfKind(SyntaxKind.TemplateExpression).map((template) => template.getText()),
  ] : []);

const hasLiteral = (source: SourceFile | null | undefined, value: string): boolean =>
  literalValues(source).has(value);

const hasLiteralContaining = (source: SourceFile | null | undefined, value: string): boolean =>
  [...literalValues(source)].some((literal) => literal.includes(value));

const textHas = (text: string | null, value: string): boolean =>
  Boolean(text && text.includes(value));

const hasIdentifier = (source: SourceFile | null | undefined, name: string): boolean =>
  Boolean(source?.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => identifier.getText() === name));

const hasCallName = (source: SourceFile | null | undefined, name: string): boolean =>
  Boolean(source?.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return (Node.isIdentifier(expression) && expression.getText() === name)
      || (Node.isPropertyAccessExpression(expression) && expression.getName() === name);
  }));

const inspectLawAndRegistration = (
  sources: {
    law: string | null;
    packageJson: string | null;
    pluginStatus: string | null;
    ciAcceptanceBindings: SourceFile | null;
  },
  findings: InspectorFinding[],
  lawId: string,
): void => {
  for (const requiredLawId of [
    "APEX-AMAZON-LISTING-EDIT-READ-SYNC-001-V1",
    "APEX-AMAZON-LISTING-EDIT-READ-SYNC-002-V1",
    "APEX-AMAZON-LISTING-EDIT-READ-SYNC-003-V1",
    "APEX-AMAZON-LISTING-EDIT-READ-SYNC-004-V1",
    "APEX-AMAZON-LISTING-EDIT-READ-SYNC-005-V1",
    "APEX-AMAZON-LISTING-EDIT-READ-SYNC-006-V1",
    "APEX-AMAZON-LISTING-EDIT-READ-SYNC-007-V1",
    "APEX-AMAZON-LISTING-EDIT-READ-SYNC-008-V1",
    "APEX-AMAZON-LISTING-EDIT-READ-SYNC-009-V1",
    "APEX-AMAZON-LISTING-EDIT-READ-SYNC-010-V1",
  ]) {
    if (!textHas(sources.law, requiredLawId)) {
      addFinding(findings, lawId, lawPath, "amazon-listing-edit-read-sync/law-id", `${requiredLawId} must be present.`);
    }
  }
  for (const required of ["acceptance:amazon-listing-edit-read-sync", "audit:amazon-listing-edit-read-sync"]) {
    if (!textHas(sources.packageJson, required)) {
      addFinding(findings, lawId, packagePath, "amazon-listing-edit-read-sync/package-script", `${required} must be exposed.`);
    }
  }
  if (!textHas(sources.pluginStatus, domain)) {
    addFinding(findings, lawId, pluginStatusPath, "amazon-listing-edit-read-sync/plugin-status", "plugin-status must register the owner once.");
  }
  if (!hasLiteral(sources.ciAcceptanceBindings, acceptancePath)) {
    addFinding(findings, lawId, ciAcceptanceBindingsPath, "amazon-listing-edit-read-sync/ci-full", "ci:full acceptance binding must include the physical acceptance leaf.");
  }
};

const inspectSchema = (source: SourceFile | null, findings: InspectorFinding[], lawId: string): void => {
  for (const required of ["inventory-only", "single-sku-search-only", "single-sku-sku-central-only", "single-sku-edit-tabs", "all-inventory-edit-tabs", "visible-inventory-page", "all-inventory-pages", "inventory", "asin", "sku", "parent", "child", "all-inventory", "product_details", "images", "variations", "offer", "safety_and_compliance"]) {
    if (!hasLiteral(source, required)) {
      addFinding(findings, lawId, schemaPath, "amazon-listing-edit-read-sync/schema-contract", `${required} must be in schema.`);
    }
  }
  if (!hasIdentifier(source, "stopOnFirstIssue")) {
    addFinding(findings, lawId, schemaPath, "amazon-listing-edit-read-sync/schema-contract", "stopOnFirstIssue must be in schema.");
  }
  for (const required of ["targetMode", "target", "parentAsin", "parentSku", "childAsin", "childSku", "targetResolution", "requireParentChildProof"]) {
    if (!hasIdentifier(source, required)) {
      addFinding(findings, lawId, schemaPath, "amazon-listing-edit-read-sync/schema-contract", `${required} must be in schema.`);
    }
  }
};

const inspectDomSafety = (source: SourceFile | null, findings: InspectorFinding[], lawId: string): void => {
  for (const required of [
    "VariationExpander-module__expanderHeader",
    "JanusTable-module__tableContentRow",
    "kat-input",
    "imageUrls",
    "pageInfo",
    "visibleText",
    "headings",
    "saveActionLabels",
    "编辑商品信息",
    "form#sc-global-search-form",
    "input#sc-search-field",
    "搜索 SKU、商品名称/关键词、FNSKU、ASIN、UPC/EAN",
    "shadowRoot",
    "Object.defineProperty",
    "hostValueGetterDefined",
    "SearchBox-module__searchButton",
    "pointerdown",
    "a[href*=\"/skucentral\"]",
    "sku_central_link_not_unique",
    "parentAsin",
    "parentSku",
  ]) {
    if (!hasLiteralContaining(source, required)) {
      addFinding(findings, lawId, domScriptsPath, "amazon-listing-edit-read-sync/dom-anchor", `DOM script must include ${required}.`);
    }
  }
  for (const forbidden of ["document.cookie", "localStorage", "sessionStorage", "outerHTML", "innerHTML"]) {
    if (hasLiteralContaining(source, forbidden)) {
      addFinding(findings, lawId, domScriptsPath, "amazon-listing-edit-read-sync/privacy", `DOM script must not read ${forbidden}.`);
    }
  }
};

const inspectFlow = (
  sources: readonly (SourceFile | null)[],
  urlsSource: SourceFile | null,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  for (const forbiddenCall of ["click", "textInput", "setFileInputFiles"]) {
    if (sources.some((source) => hasCallName(source, forbiddenCall))) {
      addFinding(findings, lawId, flowPath, "amazon-listing-edit-read-sync/read-only-flow", `Flow must not call browser.${forbiddenCall}.`);
    }
  }
  for (const required of [
    "reuse-host-tab",
    "product_type_required_for_edit_tab_url",
    "inventory_search_result_dom_not_verified",
    "verify inventory search exact SKU row",
    "read unique SKU Central href from result DOM",
    "sku_central_only_finished",
    "batch_stopped_on_first_issue",
    "inventory_page_read",
    "all-inventory-pages",
    "child_parent_mismatch",
    "parent_not_proven",
  ]) {
    if (!sources.some((source) => hasLiteralContaining(source, required))) {
      addFinding(findings, lawId, flowPath, "amazon-listing-edit-read-sync/flow-contract", `Flow must include ${required}.`);
    }
  }
  if (!sources.some((source) => hasIdentifier(source, "targetResolution"))) {
    addFinding(findings, lawId, flowPath, "amazon-listing-edit-read-sync/flow-contract", "Flow must include targetResolution.");
  }
  const flowSource = sources[0];
  if (!hasCallName(flowSource, "runInventorySkuSearch")) {
    addFinding(findings, lawId, flowPath, "amazon-listing-edit-read-sync/flow-job-step-wiring", "Flow must call the governed runInventorySkuSearch job step.");
  }
  for (const required of ["/abis/listing/edit", "obo_el_skuc_ac"]) {
    if (!hasLiteralContaining(urlsSource, required)) {
      addFinding(findings, lawId, urlsPath, "amazon-listing-edit-read-sync/url-contract", `URL helper must include ${required}.`);
    }
  }
};

const inspectAppShellSurface = (
  sources: {
    appShell: SourceFile | null;
    client: SourceFile | null;
    registry: SourceFile | null;
    workspace: SourceFile | null;
  },
  findings: InspectorFinding[],
  lawId: string,
): void => {
  for (const required of [
    "amazon-listing-edit-read-sync",
    "Amazon Listing Edit Read",
  ]) {
    if (!hasLiteralContaining(sources.registry, required)) {
      addFinding(findings, lawId, skillRegistryPath, "amazon-listing-edit-read-sync/app-shell-registry", `${required} must be registered in Skill Registry.`);
    }
  }
  for (const required of [
    "data-listing-edit-read-form",
    "targetMode",
    "parentAsin",
    "parentSku",
    "childAsin",
    "childSku",
    "data-listing-edit-read-status",
    "data-listing-edit-read-items",
  ]) {
    if (!hasLiteralContaining(sources.workspace, required)) {
      addFinding(findings, lawId, workspacePath, "amazon-listing-edit-read-sync/app-workspace", `${required} must be in App Shell workspace.`);
    }
  }
  for (const forbidden of ["selector", "browserCommand", "rawHtml", "document.cookie", "localStorage", "sessionStorage"]) {
    if (hasLiteralContaining(sources.workspace, forbidden) || hasLiteralContaining(sources.client, forbidden)) {
      addFinding(findings, lawId, workspacePath, "amazon-listing-edit-read-sync/app-forbidden-input", `App Shell must not expose ${forbidden}.`);
    }
  }
  for (const forbidden of ["Save", "Submit", "Publish", "Upload", "Delete", "保存", "提交", "发布", "上传", "删除"]) {
    if (hasLiteral(sources.workspace, forbidden)) {
      addFinding(findings, lawId, workspacePath, "amazon-listing-edit-read-sync/app-write-action", `App Shell must not expose ${forbidden} action.`);
    }
  }
  if (!hasIdentifier(sources.appShell, "renderAmazonListingEditReadSyncClient")) {
    addFinding(findings, lawId, appShellPath, "amazon-listing-edit-read-sync/app-client", "App Shell must load listing edit read sync client.");
  }
  if (!hasLiteralContaining(sources.client, "/api/plugins/amazon-listing-edit-read-sync/start")) {
    addFinding(findings, lawId, clientPath, "amazon-listing-edit-read-sync/app-api", "Client must call existing start route.");
  }
};

const inspectApiSurface = (
  sources: {
    apiBoundary: SourceFile | null;
    server: SourceFile | null;
    runtime: SourceFile | null;
    runtimeSupport: SourceFile | null;
    runtimeHandle: SourceFile | null;
  },
  findings: InspectorFinding[],
  lawId: string,
): void => {
  for (const route of [
    "/api/plugins/amazon-listing-edit-read-sync/start",
    "/api/plugins/amazon-listing-edit-read-sync/status/",
    "/api/plugins/amazon-listing-edit-read-sync/latest",
  ]) {
    if (!hasLiteral(sources.apiBoundary, route)) {
      addFinding(findings, lawId, apiBoundaryPath, "amazon-listing-edit-read-sync/api-boundary", `${route} must be registered.`);
    }
  }
  if (!hasIdentifier(sources.server, "handleAmazonListingEditReadSyncRequest")) {
    addFinding(findings, lawId, serverPath, "amazon-listing-edit-read-sync/server-route", "Workbench server must register route handler.");
  }
  for (const required of [
    "startAmazonListingEditReadSyncTask",
    "getAmazonListingEditReadSyncTaskStatus",
    "getLatestAmazonListingEditReadSyncTask",
  ]) {
    if (!hasIdentifier(sources.runtimeSupport, required) || !hasIdentifier(sources.runtimeHandle, required)) {
      addFinding(findings, lawId, runtimePath, "amazon-listing-edit-read-sync/workbench-runtime", `${required} must stay on Workbench status chain.`);
    }
  }
  if (!hasIdentifier(sources.runtime, "buildAmazonListingEditReadSyncHandle")) {
    addFinding(findings, lawId, runtimePath, "amazon-listing-edit-read-sync/workbench-runtime", "Workbench must compose the listing edit read sync support handle.");
  }
};

const inspectIsolation = (context: InspectorContext, findings: InspectorFinding[], lawId: string): void => {
  for (const repoPath of [flowPath, taskServicePath, routePath]) {
    const source = sourceFile(context, repoPath);
    if (hasLiteralContaining(source, "amazon-product-sync/") || hasLiteralContaining(source, "amazon-product-fee-sync/")) {
      addFinding(findings, lawId, repoPath, "amazon-listing-edit-read-sync/no-cross-owner-import", "New owner must not import private implementation from sibling Amazon sync plugins.");
    }
  }
};



const inspectDomainEvaluation = async (context: InspectorContext): Promise<Omit<InspectorOutput, "executedChecks">> => {
  const lawId = selectLawId(context.planEntry.lawIds, "APEX-AMAZON-LISTING-EDIT-READ-SYNC-001-V1");
  const findings: InspectorFinding[] = [];
  const law = requireRepoFile(findings, lawId, lawPath);
  requireRepoFile(findings, lawId, blueprintPath);
  requireRepoFile(findings, lawId, manifestPath);
  const schema = requireSourceFile(context, findings, lawId, schemaPath);
  const domScripts = requireSourceFile(context, findings, lawId, domScriptsPath);
  const flow = requireSourceFile(context, findings, lawId, flowPath);
  const urls = requireSourceFile(context, findings, lawId, urlsPath);
  requireSourceFile(context, findings, lawId, storagePath);
  requireSourceFile(context, findings, lawId, taskServicePath);
  requireSourceFile(context, findings, lawId, indexPath);
  requireSourceFile(context, findings, lawId, routePath);
  const workspace = requireSourceFile(context, findings, lawId, workspacePath);
  const appShell = requireSourceFile(context, findings, lawId, appShellPath);
  const skillRegistry = requireSourceFile(context, findings, lawId, skillRegistryPath);
  const client = requireSourceFile(context, findings, lawId, clientPath);
  const apiBoundary = requireSourceFile(context, findings, lawId, apiBoundaryPath);
  const server = requireSourceFile(context, findings, lawId, serverPath);
  const runtime = requireSourceFile(context, findings, lawId, runtimePath);
  const runtimeSupport = requireSourceFile(context, findings, lawId, runtimeSupportPath);
  const runtimeHandle = requireSourceFile(context, findings, lawId, runtimeHandlePath);
  requireSourceFile(context, findings, lawId, acceptancePath);
  const pluginStatus = requireRepoFile(findings, lawId, pluginStatusPath);
  requireSourceFile(context, findings, lawId, ciPhasePath);
  const ciAcceptanceBindings = requireSourceFile(context, findings, lawId, ciAcceptanceBindingsPath);
  const packageJson = requireRepoFile(findings, lawId, packagePath);

  inspectLawAndRegistration({ law, packageJson, pluginStatus, ciAcceptanceBindings }, findings, lawId);
  inspectSchema(schema, findings, lawId);
  inspectDomSafety(domScripts, findings, lawId);
  inspectFlow([
    flow,
    sourceFile(context, inventorySearchPath) ?? null,
    sourceFile(context, targetResolutionPath) ?? null,
  ], urls, findings, lawId);
  inspectAppShellSurface({ appShell, client, registry: skillRegistry, workspace }, findings, lawId);
  inspectApiSurface({ apiBoundary, server, runtime, runtimeSupport, runtimeHandle }, findings, lawId);
  inspectIsolation(context, findings, lawId);

  return {
    capabilityDomain: domain,
    reportedLawIds: [lawId],

    findings,
    inspectedFiles: [...inspectedFiles],
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  if (!context.checks) throw new Error("amazon-listing-edit-read-sync requires a runner-owned check session.");
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
