import {
  Node,
  SyntaxKind,
  type CallExpression,
  type Expression,
  type ForStatement,
  type ImportSpecifier,
  type SourceFile,
  type Symbol as MorphSymbol,
  type VariableDeclaration,
} from "ts-morph";

import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { getRepoSourcePath } from "../../shared/source-files.js";

export const hasIdentifier = (sourceFile: SourceFile, identifierName: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).some((id) => id.getText() === identifierName);

export const hasStringLiteral = (sourceFile: SourceFile, literalValue: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).some((lit) => lit.getLiteralValue() === literalValue);

export const literalText = (sourceFile: SourceFile): string => [
  ...sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralText()),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((node) => node.getLiteralText()),
].join("\n");

export const identifierText = (sourceFile: SourceFile): string =>
  sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => node.getText()).join("\n");

export const fileIncludesText = (sourceFile: SourceFile, text: string): boolean =>
  literalText(sourceFile).includes(text) || identifierText(sourceFile).includes(text);

export const getRequiredSourceFile = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(repoPath));

export const trackSourceFile = (inspectedFiles: Set<string>, sourceFile: SourceFile | undefined): void => {
  if (sourceFile) {
    inspectedFiles.add(getRepoSourcePath(sourceFile));
  }
};

export type NamedImportContract = {
  localName: string;
  specifier: ImportSpecifier;
  symbol: MorphSymbol | undefined;
};

export const findNamedImportContract = (
  sourceFile: SourceFile,
  moduleSpecifier: string,
  importedName: string,
): NamedImportContract | undefined => {
  for (const declaration of sourceFile.getImportDeclarations()) {
    if (declaration.getModuleSpecifierValue() !== moduleSpecifier) {
      continue;
    }
    for (const namedImport of declaration.getNamedImports()) {
      if (namedImport.getName() !== importedName) {
        continue;
      }
      const aliasNode = namedImport.getAliasNode();
      return {
        localName: aliasNode?.getText() ?? namedImport.getName(),
        specifier: namedImport,
        symbol: aliasNode?.getSymbol() ?? namedImport.getNameNode().getSymbol(),
      };
    }
  }
  return undefined;
};

const identifierMatchesImportContract = (identifier: Node, contract: NamedImportContract): boolean => {
  if (!Node.isIdentifier(identifier) || identifier.getText() !== contract.localName) {
    return false;
  }
  const symbol = identifier.getSymbol();
  if (!symbol || !contract.symbol) {
    return false;
  }
  if (symbol === contract.symbol) {
    return true;
  }
  return symbol.getDeclarations().some((declaration) => declaration === contract.specifier);
};

export const hasCallToImportedFunction = (sourceFile: SourceFile, contract: NamedImportContract): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) =>
    identifierMatchesImportContract(callExpression.getExpression(), contract),
  );

export const hasPropertyAccessNamed = (sourceFile: SourceFile, propertyName: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((propertyAccess) =>
    propertyAccess.getName() === propertyName,
  );

export const hasCallToLocalIdentifier = (sourceFile: SourceFile, identifierName: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) =>
    Node.isIdentifier(callExpression.getExpression()) && callExpression.getExpression().getText() === identifierName,
  );

const isStartIndexDeclaration = (declaration: VariableDeclaration): boolean => {
  const declarationInitializer = declaration.getInitializer();
  return declaration.getName() === "startIndex"
    && Node.isNumericLiteral(declarationInitializer)
    && declarationInitializer.getLiteralValue() === 0;
};

const hasStartIndexInitializer = (initializer: Node | undefined): boolean =>
  Node.isVariableDeclarationList(initializer) && initializer.getDeclarations().some(isStartIndexDeclaration);

const hasTenItemIncrement = (incrementor: Expression | undefined): boolean => {
  if (!Node.isBinaryExpression(incrementor)) {
    return false;
  }
  const incrementLeft = incrementor.getLeft();
  const incrementRight = incrementor.getRight();
  return incrementor.getOperatorToken().getKind() === SyntaxKind.PlusEqualsToken
    && Node.isIdentifier(incrementLeft)
    && incrementLeft.getText() === "startIndex"
    && Node.isNumericLiteral(incrementRight)
    && incrementRight.getLiteralValue() === 10;
};

const isStartIndexProperty = (property: Node): boolean =>
  Node.isShorthandPropertyAssignment(property) && property.getName() === "startIndex";

const objectLiteralPassesStartIndex = (argument: Node): boolean =>
  Node.isObjectLiteralExpression(argument) && argument.getProperties().some(isStartIndexProperty);

const isEvaluateSearchResultSliceCall = (callExpression: CallExpression): boolean => {
  if (!Node.isIdentifier(callExpression.getExpression()) || callExpression.getExpression().getText() !== "evaluateSearchResultSlice") {
    return false;
  }
  return callExpression.getArguments().some(objectLiteralPassesStartIndex);
};

const passesStartIndexIntoSlice = (forStatement: ForStatement): boolean =>
  forStatement.getDescendantsOfKind(SyntaxKind.CallExpression).some(isEvaluateSearchResultSliceCall);

const isChunkedSearchLoop = (forStatement: ForStatement): boolean =>
  hasStartIndexInitializer(forStatement.getInitializer())
  && hasTenItemIncrement(forStatement.getIncrementor())
  && passesStartIndexIntoSlice(forStatement);

export const hasChunkedStartIndexLoop = (sourceFile: SourceFile): boolean => {
  const collectDeclaration = sourceFile.getVariableDeclaration("collectBrowserSearchItems");
  const collectInitializer = collectDeclaration?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  if (!collectInitializer) {
    return false;
  }

  return collectInitializer.getDescendantsOfKind(SyntaxKind.ForStatement).some(isChunkedSearchLoop);
};