import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type {
  InspectorContext,
} from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

export type AiInputGatewayFinding = ReturnType<typeof createFinding>;

export const pushAiInputGatewayFinding = (
  findings: AiInputGatewayFinding[],
  lawId: string,
  filePath: string,
  checkId: string,
  message: string,
): void => {
  findings.push(createFinding({ lawId, filePath, checkId, message }));
};

export const requireAiInputGatewaySource = (
  context: InspectorContext,
  findings: AiInputGatewayFinding[],
  lawId: string,
  repoPath: string,
): SourceFile | null => {
  const source = context.project.getSourceFile(resolveFromRepo(repoPath));
  if (source) return source;
  pushAiInputGatewayFinding(
    findings,
    lawId,
    repoPath,
    "ai-input-gateway/source-present",
    `${repoPath} must exist in the audit project.`,
  );
  return null;
};

export const identifiers = (source: SourceFile): Set<string> =>
  new Set(
    source.getDescendantsOfKind(SyntaxKind.Identifier)
      .map((node) => node.getText()),
  );

export const stringLiterals = (source: SourceFile): Set<string> =>
  new Set([
    ...source.getDescendantsOfKind(SyntaxKind.StringLiteral)
      .map((node) => node.getLiteralText()),
    ...source.getDescendantsOfKind(
      SyntaxKind.NoSubstitutionTemplateLiteral,
    ).map((node) => node.getLiteralText()),
    ...source.getDescendantsOfKind(SyntaxKind.TemplateHead)
      .map((node) => node.getLiteralText()),
    ...source.getDescendantsOfKind(SyntaxKind.TemplateMiddle)
      .map((node) => node.getLiteralText()),
    ...source.getDescendantsOfKind(SyntaxKind.TemplateTail)
      .map((node) => node.getLiteralText()),
  ]);

export const propertyNames = (node: Node): Set<string> =>
  new Set(
    node.getDescendantsOfKind(SyntaxKind.PropertyAssignment)
      .map((property) => property.getName()),
  );

export const variableStringValues = (
  source: SourceFile,
  variableName: string,
): Set<string> => new Set(
  source.getVariableDeclaration(variableName)
    ?.getInitializer()
    ?.getDescendantsOfKind(SyntaxKind.StringLiteral)
    .map((literal) => literal.getLiteralText()) ?? [],
);

export const typePropertyNames = (
  source: SourceFile,
  typeName: string,
): Set<string> => {
  const alias = source.getTypeAlias(typeName);
  return new Set(
    alias
      ?.getTypeNode()
      ?.getDescendantsOfKind(SyntaxKind.PropertySignature)
      .map((property) => property.getName()) ?? [],
  );
};
