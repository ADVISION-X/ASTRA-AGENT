import { Node, SyntaxKind, type ArrayLiteralExpression, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const collectAstTexts = (sourceFile: SourceFile): string[] => [
  ...sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralValue()),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((node) => node.getLiteralText()),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.TemplateExpression).map((node) => node.getText()),
];

const getArrayInitializer = (
  sourceFile: SourceFile | undefined,
  arrayName: string,
): ArrayLiteralExpression | undefined => {
  const initializer = sourceFile?.getVariableDeclaration(arrayName)?.getInitializer();
  if (!initializer) {
    return undefined;
  }
  if (Node.isArrayLiteralExpression(initializer)) {
    return initializer;
  }
  if (Node.isAsExpression(initializer) || Node.isSatisfiesExpression(initializer)) {
    const expression = initializer.getExpression();
    return Node.isArrayLiteralExpression(expression) ? expression : undefined;
  }
  return undefined;
};

export const addInspectedFile = (inspectedFiles: Set<string>, sourceFile: SourceFile | undefined): void => {
  if (sourceFile) {
    inspectedFiles.add(getRepoSourcePath(sourceFile));
  }
};

export const astTextIncludes = (sourceFile: SourceFile | undefined, marker: string): boolean =>
  sourceFile ? collectAstTexts(sourceFile).some((text) => text.includes(marker)) : false;

export const requireAstMarker = (input: {
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  sourceFile: SourceFile | undefined;
  lawId: string;
  checkId: string;
  marker: string;
}): void => {
  addInspectedFile(input.inspectedFiles, input.sourceFile);
  if (astTextIncludes(input.sourceFile, input.marker)) {
    return;
  }
  input.findings.push(createFinding({
    checkId: input.checkId,
    lawId: input.lawId,
    filePath: input.sourceFile ? getRepoSourcePath(input.sourceFile) : "unknown",
    message: `${input.sourceFile ? getRepoSourcePath(input.sourceFile) : "source file"} must contain ${input.marker}.`,
  }));
};

export const forbidAstMarker = (input: {
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  sourceFile: SourceFile | undefined;
  lawId: string;
  checkId: string;
  marker: string;
}): void => {
  addInspectedFile(input.inspectedFiles, input.sourceFile);
  if (!astTextIncludes(input.sourceFile, input.marker)) {
    return;
  }
  input.findings.push(createFinding({
    checkId: input.checkId,
    lawId: input.lawId,
    filePath: input.sourceFile ? getRepoSourcePath(input.sourceFile) : "unknown",
    message: `${input.sourceFile ? getRepoSourcePath(input.sourceFile) : "source file"} must not contain ${input.marker}.`,
  }));
};

export const requireNamedImport = (input: {
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  sourceFile: SourceFile | undefined;
  lawId: string;
  checkId: string;
  symbolName: string;
  moduleSuffix: string;
}): void => {
  addInspectedFile(input.inspectedFiles, input.sourceFile);
  const found = input.sourceFile?.getImportDeclarations().some((declaration) =>
    declaration.getModuleSpecifierValue().endsWith(input.moduleSuffix)
    && declaration.getNamedImports().some((namedImport) => namedImport.getName() === input.symbolName),
  );
  if (found) {
    return;
  }
  input.findings.push(createFinding({
    checkId: input.checkId,
    lawId: input.lawId,
    filePath: input.sourceFile ? getRepoSourcePath(input.sourceFile) : "unknown",
    message: `${input.sourceFile ? getRepoSourcePath(input.sourceFile) : "source file"} must import ${input.symbolName} from ${input.moduleSuffix}.`,
  }));
};

export const requireIdentifier = (input: {
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  sourceFile: SourceFile | undefined;
  lawId: string;
  checkId: string;
  identifierName: string;
}): void => {
  addInspectedFile(input.inspectedFiles, input.sourceFile);
  const found = input.sourceFile?.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) =>
    identifier.getText() === input.identifierName,
  );
  if (found) {
    return;
  }
  input.findings.push(createFinding({
    checkId: input.checkId,
    lawId: input.lawId,
    filePath: input.sourceFile ? getRepoSourcePath(input.sourceFile) : "unknown",
    message: `${input.sourceFile ? getRepoSourcePath(input.sourceFile) : "source file"} must contain identifier ${input.identifierName}.`,
  }));
};

export const requireFunctionDeclaration = (input: {
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  sourceFile: SourceFile | undefined;
  lawId: string;
  checkId: string;
  functionName: string;
}): void => {
  addInspectedFile(input.inspectedFiles, input.sourceFile);
  const found = input.sourceFile?.getFunctions().some((declaration) =>
    declaration.getName() === input.functionName,
  );
  if (found) {
    return;
  }
  input.findings.push(createFinding({
    checkId: input.checkId,
    lawId: input.lawId,
    filePath: input.sourceFile ? getRepoSourcePath(input.sourceFile) : "unknown",
    message: `${input.sourceFile ? getRepoSourcePath(input.sourceFile) : "source file"} must declare function ${input.functionName} for browser script injection.`,
  }));
};

export const requireArrayIdentifierElement = (input: {
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  sourceFile: SourceFile | undefined;
  lawId: string;
  checkId: string;
  arrayName: string;
  identifierName: string;
}): void => {
  addInspectedFile(input.inspectedFiles, input.sourceFile);
  const initializer = getArrayInitializer(input.sourceFile, input.arrayName);
  const found = initializer?.getElements().some((element) =>
    element.getKind() === SyntaxKind.Identifier && element.getText() === input.identifierName,
  );
  if (found) {
    return;
  }
  input.findings.push(createFinding({
    checkId: input.checkId,
    lawId: input.lawId,
    filePath: input.sourceFile ? getRepoSourcePath(input.sourceFile) : "unknown",
    message: `${input.sourceFile ? getRepoSourcePath(input.sourceFile) : "source file"} must include ${input.identifierName} in ${input.arrayName}.`,
  }));
};

export const requireArraySpreadElement = (input: {
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  sourceFile: SourceFile | undefined;
  lawId: string;
  checkId: string;
  arrayName: string;
  spreadName: string;
}): void => {
  addInspectedFile(input.inspectedFiles, input.sourceFile);
  const initializer = getArrayInitializer(input.sourceFile, input.arrayName);
  const found = initializer?.getElements().some((element) =>
    element.getKind() === SyntaxKind.SpreadElement
    && element.getText() === `...${input.spreadName}`,
  );
  if (found) {
    return;
  }
  input.findings.push(createFinding({
    checkId: input.checkId,
    lawId: input.lawId,
    filePath: input.sourceFile ? getRepoSourcePath(input.sourceFile) : "unknown",
    message: `${input.sourceFile ? getRepoSourcePath(input.sourceFile) : "source file"} must spread ${input.spreadName} in ${input.arrayName}.`,
  }));
};

export const requireMarkerOrder = (input: {
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  sourceFile: SourceFile | undefined;
  lawId: string;
  checkId: string;
  firstMarker: string;
  secondMarker: string;
}): void => {
  addInspectedFile(input.inspectedFiles, input.sourceFile);
  const text = input.sourceFile?.getFullText() ?? "";
  const firstIndex = text.indexOf(input.firstMarker);
  const secondIndex = text.indexOf(input.secondMarker);
  if (firstIndex >= 0 && secondIndex >= 0 && firstIndex < secondIndex) {
    return;
  }
  input.findings.push(createFinding({
    checkId: input.checkId,
    lawId: input.lawId,
    filePath: input.sourceFile ? getRepoSourcePath(input.sourceFile) : "unknown",
    message: `${input.sourceFile ? getRepoSourcePath(input.sourceFile) : "source file"} must keep ${input.firstMarker} before ${input.secondMarker}.`,
  }));
};
