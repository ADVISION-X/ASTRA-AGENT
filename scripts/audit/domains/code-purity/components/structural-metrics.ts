import {
  type ArrowFunction,
  type ClassDeclaration,
  type ConstructorDeclaration,
  Node,
  SyntaxKind,
  ts,
  type FunctionDeclaration,
  type FunctionExpression,
  type GetAccessorDeclaration,
  type MethodDeclaration,
  type Node as MorphNode,
  type SetAccessorDeclaration,
} from "ts-morph";

import type { GovernedFile } from "./code-purity-governed-files.js";

type BudgetFunctionNode =
  | ArrowFunction
  | ConstructorDeclaration
  | FunctionDeclaration
  | FunctionExpression
  | GetAccessorDeclaration
  | MethodDeclaration
  | SetAccessorDeclaration;

const controlFlowKinds = new Set([
  SyntaxKind.CaseClause,
  SyntaxKind.CatchClause,
  SyntaxKind.ConditionalExpression,
  SyntaxKind.DoStatement,
  SyntaxKind.ForInStatement,
  SyntaxKind.ForOfStatement,
  SyntaxKind.ForStatement,
  SyntaxKind.IfStatement,
  SyntaxKind.SwitchStatement,
  SyntaxKind.WhileStatement,
]);

const functionLikeKinds = [
  SyntaxKind.ArrowFunction,
  SyntaxKind.Constructor,
  SyntaxKind.FunctionDeclaration,
  SyntaxKind.FunctionExpression,
  SyntaxKind.GetAccessor,
  SyntaxKind.MethodDeclaration,
  SyntaxKind.SetAccessor,
] as const;

const isSuppressionDirectiveComment = (commentText: string): boolean => {
  const normalized = commentText.trimStart();
  return normalized.startsWith("// @ts-ignore")
    || normalized.startsWith("// @ts-expect-error")
    || normalized.startsWith("/* @ts-ignore")
    || normalized.startsWith("/* @ts-expect-error")
    || normalized.startsWith("// eslint-disable")
    || normalized.startsWith("/* eslint-disable");
};

export const collectFunctionLikes = (governedFile: GovernedFile): BudgetFunctionNode[] =>
  functionLikeKinds.flatMap((kind) => governedFile.sourceFile.getDescendantsOfKind(kind)) as BudgetFunctionNode[];

export const collectOwnFunctionDescendants = (node: MorphNode): MorphNode[] => {
  const descendants: MorphNode[] = [];
  node.forEachChild((child) => {
    if (Node.isFunctionLikeDeclaration(child)) return;
    descendants.push(child, ...collectOwnFunctionDescendants(child));
  });
  return descendants;
};

export const computeMaxNestingDepth = (node: MorphNode, depth = 0): number => {
  let maxDepth = depth;
  node.forEachChild((child) => {
    if (Node.isFunctionLikeDeclaration(child)) return;
    const nextDepth = controlFlowKinds.has(child.getKind()) ? depth + 1 : depth;
    maxDepth = Math.max(maxDepth, computeMaxNestingDepth(child, nextDepth));
  });
  return maxDepth;
};

export const computeCyclomaticComplexity = (body: MorphNode): number =>
  1 +
  collectOwnFunctionDescendants(body).filter((descendant) => {
    if (controlFlowKinds.has(descendant.getKind())) {
      return true;
    }
    return Node.isBinaryExpression(descendant) && [
      SyntaxKind.AmpersandAmpersandToken,
      SyntaxKind.BarBarToken,
      SyntaxKind.QuestionQuestionToken,
    ].includes(descendant.getOperatorToken().getKind());
  }).length;

export const collectDirectiveComments = (governedFile: GovernedFile): { line: number; text: string }[] => {
  const directives: { line: number; text: string }[] = [];
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.Standard,
    governedFile.sourceFile.compilerNode.text,
  );
  for (let token = scanner.scan(); token !== SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    if (token !== SyntaxKind.SingleLineCommentTrivia && token !== SyntaxKind.MultiLineCommentTrivia) continue;
    const text = scanner.getTokenText();
    if (!isSuppressionDirectiveComment(text)) continue;
    directives.push({
      line: governedFile.sourceFile.getLineAndColumnAtPos(scanner.getTokenPos()).line,
      text,
    });
  }
  return directives;
};

export const classBreaksMemberRedLine = (classDeclaration: ClassDeclaration): { reason: string } | null => {
  const totalMembers = classDeclaration.getMembers().length;
  if (totalMembers > 30) {
    return { reason: `member count ${totalMembers} exceeds red line 30` };
  }
  return null;
};
