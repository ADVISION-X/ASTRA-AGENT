import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../../core/result.js";
import type { Finding } from "../../../core/schema.js";
import { getSourceFileAtRepoPath } from "./collect-dom-automation-project.js";
import type { DomAutomationAuditProject } from "./dom-automation-project-types.js";

export const agentChannelFinding = (...input: readonly [
  lawId: string,
  file: string,
  line: number,
  message: string,
  hint: string,
]): Finding => {
  const [lawId, file, line, message, hint] = input;
  return createFinding({ lawId, file, line, severity: "fatal", message, hint });
};

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
