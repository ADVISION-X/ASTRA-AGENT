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

import { toRepoPath } from "../../../shared/paths.js";
import type { GovernedFile } from "./code-purity-governed-files.js";
import { resolveCodePurityOwner } from "./code-purity-owner-model.js";

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

const suppressedDirectivePattern = /@ts-ignore|@ts-expect-error|eslint-disable/u;

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

export const countCrossOwnerImports = (governedFile: GovernedFile): number => {
  const targetOwners = new Set<string>();
  for (const importDeclaration of governedFile.sourceFile.getImportDeclarations()) {
    const targetSourceFile = importDeclaration.getModuleSpecifierSourceFile();
    if (!targetSourceFile) {
      continue;
    }
    const targetOwner = resolveCodePurityOwner(toRepoPath(targetSourceFile.getFilePath()));
    if (targetOwner !== governedFile.owner && targetOwner !== "unknown") {
      targetOwners.add(targetOwner);
    }
  }
  return targetOwners.size;
};

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
      if (!suppressedDirectivePattern.test(text)) {
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

export const classBreaksHardLimit = (classDeclaration: ClassDeclaration): { reason: string } | null => {
  const fieldCount = classDeclaration.getProperties().length;
  const methodCount = classDeclaration.getMethods().length + classDeclaration.getGetAccessors().length + classDeclaration.getSetAccessors().length;
  const totalMembers = classDeclaration.getMembers().length;
  const constructorParams = classDeclaration.getConstructors().flatMap((ctor) => ctor.getParameters()).length;
  if (fieldCount > 14) {
    return { reason: `field count ${fieldCount} exceeds hard limit 14` };
  }
  if (methodCount > 14) {
    return { reason: `method count ${methodCount} exceeds hard limit 14` };
  }
  if (totalMembers > 24) {
    return { reason: `member count ${totalMembers} exceeds hard limit 24` };
  }
  return constructorParams > 6 ? { reason: `constructor parameter count ${constructorParams} exceeds hard limit 6` } : null;
};