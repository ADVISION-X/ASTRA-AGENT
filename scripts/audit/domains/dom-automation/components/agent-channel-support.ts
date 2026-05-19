import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../../core/result.js";
import type { Finding } from "../../../core/schema.js";
import {
  getSourceFileAtRepoPath,
  type DomAutomationAuditProject,
} from "./collect-dom-automation-project.js";

export const VISUAL_TASK_START_ROUTE_PATH = "src/app/task-start-api-handler.ts";
export const PLUGIN_TASK_ROUTE_PATH = "src/app/plugin-task-api-handlers.ts";
export const WORKBENCH_FACADE_PATH = "src/lib/local-runtime/workbench-facade.ts";
export const WORKBENCH_IMPL_PATH = "src/lib/local-runtime/workbench.ts";
export const AMAZON_PAGE_PATH = "src/lib/local-app-shell/pages/AmazonInvoiceUploadPage.ts";
export const AMAZON_CLIENT_PATH = "src/lib/local-app-shell/commander-console-shell-client.ts";
export const AMAZON_CLIENT_EVENTS_PATH = "src/lib/local-app-shell/commander-console-shell-client-events.ts";
export const AMAZON_TASK_SERVICE_PATH = "src/plugins/amazon-invoice-upload/amazon-invoice-upload-task-service.ts";
export const PLUGIN_INDEX_PATH = "src/plugins/amazon-invoice-upload/index.ts";
export const CURRENT_BROWSER_OWNER_PATH = "src/lib/browser/current-chrome-browser-controller.ts";

export const agentChannelFinding = (
  lawId: string,
  file: string,
  line: number,
  message: string,
  hint: string,
): Finding => createFinding({ lawId, file, line, severity: "fatal", message, hint });

export const collectTemplateFragments = (sourceFile: SourceFile): string[] => sourceFile
  .forEachDescendantAsArray()
  .flatMap((node) => {
    if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) return [node.getLiteralText()];
    const kind = node.getKind();
    return kind === SyntaxKind.TemplateHead || kind === SyntaxKind.TemplateMiddle || kind === SyntaxKind.TemplateTail
      ? [node.getText()]
      : [];
  });

export const hasPropertyAccessCall = (
  sourceFile: SourceFile,
  receiverText: string,
  methodName: string,
): boolean => sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
  const expression = callExpression.getExpression();
  return Node.isPropertyAccessExpression(expression)
    && expression.getExpression().getText() === receiverText
    && expression.getName() === methodName;
});

export const requireSourceFile = (
  auditProject: DomAutomationAuditProject,
  repoPath: string,
  lawId: string,
  hint: string,
): SourceFile | Finding => {
  const sourceFile = getSourceFileAtRepoPath(auditProject.project, repoPath);
  return sourceFile ?? agentChannelFinding(lawId, repoPath, 1, "required agent start channel file is missing", hint);
};
