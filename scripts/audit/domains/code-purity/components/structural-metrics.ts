import {
  type ArrowFunction,
  type ClassDeclaration,
  type ConstructorDeclaration,
  Node,
  SyntaxKind,
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

const suppressedDirectiveTokens = ["@ts-ignore", "@ts-expect-error", "eslint-disable"];

export const collectFunctionLikes = (governedFile: GovernedFile): BudgetFunctionNode[] =>
  functionLikeKinds.flatMap((kind) => governedFile.sourceFile.getDescendantsOfKind(kind)) as BudgetFunctionNode[];

export const computeMaxNestingDepth = (node: MorphNode, depth = 0): number => {
  let maxDepth = depth;
  node.forEachChild((child) => {
    const nextDepth = controlFlowKinds.has(child.getKind()) ? depth + 1 : depth;
    maxDepth = Math.max(maxDepth, computeMaxNestingDepth(child, nextDepth));
  });
  return maxDepth;
};

export const computeCyclomaticComplexity = (body: MorphNode): number =>
  1 +
  body.getDescendants().filter((descendant) => {
    if (controlFlowKinds.has(descendant.getKind())) {
      return true;
    }
    return Node.isBinaryExpression(descendant) && ["&&", "||", "??"].includes(descendant.getOperatorToken().getText());
  }).length;

export const collectDirectiveComments = (governedFile: GovernedFile): { line: number; text: string }[] => {
  const seenRanges = new Set<string>();
  const directives: { line: number; text: string }[] = [];
  governedFile.sourceFile.forEachDescendant((node) => {
    for (const range of [...node.getLeadingCommentRanges(), ...node.getTrailingCommentRanges()]) {
      const key = `${range.getPos()}:${range.getEnd()}`;
      if (seenRanges.has(key)) {
        continue;
      }
      seenRanges.add(key);
      const text = range.getText();
      if (!suppressedDirectiveTokens.some((token) => text.includes(token))) {
        continue;
      }
      directives.push({
        line: governedFile.sourceFile.getLineAndColumnAtPos(range.getPos()).line,
        text,
      });
    }
  });
  return directives;
};

export const classBreaksMemberRedLine = (classDeclaration: ClassDeclaration): { reason: string } | null => {
  const totalMembers = classDeclaration.getMembers().length;
  if (totalMembers > 30) {
    return { reason: `member count ${totalMembers} exceeds red line 30` };
  }
  return null;
};
