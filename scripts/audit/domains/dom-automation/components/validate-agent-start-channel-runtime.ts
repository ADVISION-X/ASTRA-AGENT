import { SyntaxKind } from "ts-morph";

import type { Finding } from "../../../core/schema.js";
import {
  collectStringLiteralNodes,
  findNamedImport,
  hasIdentifierCall,
  resolveModuleTargetPath,
  type DomAutomationAuditProject,
} from "./collect-dom-automation-project.js";
import {
  AMAZON_TASK_SERVICE_PATH,
  CURRENT_BROWSER_OWNER_PATH,
  PLUGIN_INDEX_PATH,
  PLUGIN_TASK_ROUTE_PATH,
  VISUAL_TASK_START_ROUTE_PATH,
  WORKBENCH_FACADE_PATH,
  WORKBENCH_IMPL_PATH,
  agentChannelFinding,
  hasPropertyAccessCall,
  requireSourceFile,
} from "./agent-channel-support.js";

export const validateVisualTaskStartIsolation = (auditProject: DomAutomationAuditProject): Finding[] => {
  const sourceFileOrFinding = requireSourceFile(auditProject, VISUAL_TASK_START_ROUTE_PATH, "GRASSEYE-DOM-008-V1", "Keep the Amazon channel out of the visual mission task-start route.");
  if ("severity" in sourceFileOrFinding) return [sourceFileOrFinding];
  const hasAmazonMissionLiteral = collectStringLiteralNodes(sourceFileOrFinding).some(({ text }) => text === "amazon_invoice_upload");
  return hasAmazonMissionLiteral
    ? [agentChannelFinding("GRASSEYE-DOM-008-V1", VISUAL_TASK_START_ROUTE_PATH, 1, "visual task-start route handles amazon_invoice_upload directly", "Keep Amazon launch on the independent plugin route instead of /api/tasks/start.")]
    : [];
};

export const validatePluginRouteContract = (auditProject: DomAutomationAuditProject): Finding[] => {
  const sourceFileOrFinding = requireSourceFile(auditProject, PLUGIN_TASK_ROUTE_PATH, "GRASSEYE-DOM-008-V1", "Restore the independent Amazon plugin task route.");
  if ("severity" in sourceFileOrFinding) return [sourceFileOrFinding];
  const sourceFile = sourceFileOrFinding;
  const findings: Finding[] = [];
  const routeStrings = new Set(collectStringLiteralNodes(sourceFile).map(({ text }) => text));
  for (const requiredPath of ["/api/plugins/amazon-invoice-upload/open-admin", "/api/plugins/amazon-invoice-upload/start", "/api/plugins/amazon-invoice-upload/resume", "/api/plugins/amazon-invoice-upload/status/"]) {
    if (!routeStrings.has(requiredPath)) findings.push(agentChannelFinding("GRASSEYE-DOM-008-V1", PLUGIN_TASK_ROUTE_PATH, 1, `plugin route is missing required path: ${requiredPath}`, "Expose independent open-admin and start endpoints for the Amazon task channel."));
  }
  for (const schemaName of ["AmazonInvoiceUploadMissionInputSchema", "AmazonInvoiceUploadAdminOpenInputSchema"]) {
    const schemaImport = findNamedImport(sourceFile, schemaName);
    if (!schemaImport || resolveModuleTargetPath(schemaImport) !== PLUGIN_INDEX_PATH) findings.push(agentChannelFinding("GRASSEYE-DOM-008-V1", PLUGIN_TASK_ROUTE_PATH, 1, `${schemaName} is not imported from the plugin boundary`, "Validate Amazon payloads with governed plugin schemas."));
    if (!hasPropertyAccessCall(sourceFile, schemaName, "parse")) findings.push(agentChannelFinding("GRASSEYE-DOM-008-V1", PLUGIN_TASK_ROUTE_PATH, 1, `${schemaName}.parse is missing`, "Parse payloads before invoking the workbench facade."));
  }
  for (const methodName of ["startAmazonInvoiceUploadTask", "resumeAmazonInvoiceUploadTask", "getAmazonInvoiceUploadTaskStatus", "openAdminInvoicePage"]) {
    if (!hasPropertyAccessCall(sourceFile, "activeWorkbench", methodName)) findings.push(agentChannelFinding("GRASSEYE-DOM-001-V1", PLUGIN_TASK_ROUTE_PATH, 1, `plugin route does not call activeWorkbench.${methodName}`, "Route Amazon tasks through the public workbench facade only."));
  }
  const forbiddenNamedImports = ["startAmazonInvoiceUploadMission", "openAmazonInvoiceAdminPage", "runAmazonInvoiceUploadPhaseOne", "BrowserController", "CurrentChromeBrowserController"];
  for (const forbiddenImport of forbiddenNamedImports) {
    if (findNamedImport(sourceFile, forbiddenImport)) findings.push(agentChannelFinding("GRASSEYE-DOM-001-V1", PLUGIN_TASK_ROUTE_PATH, 1, `plugin task route imports forbidden implementation symbol: ${forbiddenImport}`, "Keep route handlers limited to schemas plus the public workbench handle boundary."));
  }
  const hasForbiddenBrowserOwnerImport = sourceFile.getImportDeclarations().some((importDeclaration) => resolveModuleTargetPath(importDeclaration) === CURRENT_BROWSER_OWNER_PATH);
  if (hasForbiddenBrowserOwnerImport) findings.push(agentChannelFinding("GRASSEYE-DOM-001-V1", PLUGIN_TASK_ROUTE_PATH, 1, "plugin task route imports CurrentChromeBrowserController directly", "Keep browser ownership inside workbench assembly only."));
  const hasForbiddenNewBrowserOwner = sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression).some((newExpression) => newExpression.getExpression().getText() === "CurrentChromeBrowserController");
  if (hasForbiddenNewBrowserOwner) findings.push(agentChannelFinding("GRASSEYE-DOM-001-V1", PLUGIN_TASK_ROUTE_PATH, 1, "plugin task route constructs CurrentChromeBrowserController directly", "Never create browser owners inside route handlers."));
  if (hasPropertyAccessCall(sourceFile, "activeWorkbench.commanderConsole", "execute")) findings.push(agentChannelFinding("GRASSEYE-DOM-008-V1", PLUGIN_TASK_ROUTE_PATH, 1, "plugin task route falls back to commanderConsole.execute", "Call the dedicated facade methods only."));
  return findings;
};

export const validateWorkbenchFacadeChannel = (auditProject: DomAutomationAuditProject): Finding[] => {
  const findings: Finding[] = [];
  const facadeSourceOrFinding = requireSourceFile(auditProject, WORKBENCH_FACADE_PATH, "GRASSEYE-DOM-001-V1", "Restore the public workbench facade definition for the Amazon start channel.");
  if ("severity" in facadeSourceOrFinding) findings.push(facadeSourceOrFinding);
  else {
    const members = facadeSourceOrFinding.getTypeAlias("WorkbenchFacade")?.getTypeNode()?.getText() ?? "";
    for (const methodName of ["openAdminInvoicePage(", "startAmazonInvoiceUploadTask(", "resumeAmazonInvoiceUploadTask(", "getAmazonInvoiceUploadTaskStatus("]) {
      if (!members.includes(methodName)) findings.push(agentChannelFinding("GRASSEYE-DOM-001-V1", WORKBENCH_FACADE_PATH, 1, `WorkbenchFacade is missing ${methodName}`, "Expose a narrow Amazon method on the public workbench facade."));
    }
  }
  const workbenchSourceOrFinding = requireSourceFile(auditProject, WORKBENCH_IMPL_PATH, "GRASSEYE-DOM-001-V1", "Restore the workbench implementation for the Amazon start channel.");
  if ("severity" in workbenchSourceOrFinding) findings.push(workbenchSourceOrFinding);
  else {
    for (const callName of ["openAmazonInvoiceAdminPage", "startAmazonInvoiceUploadTask", "resumeAmazonInvoiceUploadTask", "getAmazonInvoiceUploadTaskStatus"]) {
      if (!hasIdentifierCall(workbenchSourceOrFinding, callName)) findings.push(agentChannelFinding("GRASSEYE-DOM-001-V1", WORKBENCH_IMPL_PATH, 1, `workbench does not delegate to ${callName}`, "Keep browser-owner wiring inside workbench and call the Amazon task service from there."));
    }
  }
  return findings;
};

export const validateTaskServiceChannel = (auditProject: DomAutomationAuditProject): Finding[] => {
  const sourceFileOrFinding = requireSourceFile(auditProject, AMAZON_TASK_SERVICE_PATH, "GRASSEYE-DOM-001-V1", "Restore the Amazon task service that owns admin allowlist and phase-one delegation.");
  if ("severity" in sourceFileOrFinding) return [sourceFileOrFinding];
  const findings: Finding[] = [];
  const literals = new Set(collectStringLiteralNodes(sourceFileOrFinding).map(({ text }) => text));
  for (const requiredLiteral of ["localhost", "127.0.0.1", "http:", "https:", "admin_url_not_allowed"]) {
    if (!literals.has(requiredLiteral)) findings.push(agentChannelFinding("GRASSEYE-DOM-009-V1", AMAZON_TASK_SERVICE_PATH, 1, `Amazon task service is missing required allowlist literal: ${requiredLiteral}`, "Keep admin open bounded by explicit local-host and protocol allowlists."));
  }
  if (!hasIdentifierCall(sourceFileOrFinding, "runAmazonInvoiceUpload")) findings.push(agentChannelFinding("GRASSEYE-DOM-008-V1", AMAZON_TASK_SERVICE_PATH, 1, "Amazon task service does not delegate start to runAmazonInvoiceUpload", "Keep complete mission execution inside the plugin flow runner."));
  if (!hasPropertyAccessCall(sourceFileOrFinding, "browser", "open")) findings.push(agentChannelFinding("GRASSEYE-DOM-001-V1", AMAZON_TASK_SERVICE_PATH, 1, "Amazon task service does not use browser.open for admin page launch", "Use the single browser owner contract to open the admin page."));
  return findings;
};
