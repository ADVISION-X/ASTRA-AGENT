import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const collectAstTexts = (sourceFile: SourceFile): string[] => [
  ...sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralValue()),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((node) => node.getLiteralText()),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.TemplateExpression).map((node) => node.getText()),
];

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