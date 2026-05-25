import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

type SourceNotesFlowInput = {
  finalPackageFile: SourceFile | undefined;
  finalizationFile: SourceFile | undefined;
  htmlReportStageFile: SourceFile | undefined;
  htmlReportPromptFile: SourceFile | undefined;
  resultFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
};

const requireFile = (
  sourceFile: SourceFile | undefined,
  input: SourceNotesFlowInput,
  label: string,
): sourceFile is SourceFile => {
  if (sourceFile) {
    input.inspectedFiles.add(getRepoSourcePath(sourceFile));
    return true;
  }
  input.findings.push(createFinding({
    checkId: "deep-research/source-notes-file",
    lawId: input.lawId,
    filePath: label,
    message: `${label} must exist for sourceNotes enforcement.`,
  }));
  return false;
};

const hasNamedImport = (
  sourceFile: SourceFile,
  symbolName: string,
  moduleSuffix: string,
): boolean =>
  sourceFile.getImportDeclarations().some((declaration) =>
    declaration.getModuleSpecifierValue().endsWith(moduleSuffix)
    && declaration.getNamedImports().some((namedImport) => namedImport.getName() === symbolName),
  );

const hasCall = (sourceFile: SourceFile, symbolName: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    const expression = call.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === symbolName;
  });

const hasPropertyName = (sourceFile: SourceFile, propertyName: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) =>
    property.getNameNode().getText() === propertyName,
  );

const hasPropertyInitializedByCall = (
  sourceFile: SourceFile,
  propertyName: string,
  symbolName: string,
): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) => {
    if (property.getNameNode().getText() !== propertyName) {
      return false;
    }
    const initializer = property.getInitializer();
    if (!initializer || !Node.isCallExpression(initializer)) {
      return false;
    }
    const expression = initializer.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === symbolName;
  });

const hasPropertyAccess = (sourceFile: SourceFile, propertyName: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((property) =>
    property.getName() === propertyName,
  );

const pushMissing = (input: SourceNotesFlowInput, sourceFile: SourceFile, checkId: string, message: string): void => {
  input.findings.push(createFinding({
    checkId,
    lawId: input.lawId,
    filePath: getRepoSourcePath(sourceFile),
    message,
  }));
};

const inspectFinalPackageSourceNotes = (input: SourceNotesFlowInput, sourceFile: SourceFile): void => {
  if (
    hasNamedImport(sourceFile, "buildDeepResearchSourceNotesFromAnswers", "deep-research-analysis.source-notes.js")
    && hasPropertyInitializedByCall(
      sourceFile,
      "sourceNotes",
      "buildDeepResearchSourceNotesFromAnswers",
    )
  ) {
    return;
  }
  pushMissing(
    input,
    sourceFile,
    "deep-research/source-notes-final-package",
    "Final package must derive sourceNotes from persisted analysis evidenceMentions.",
  );
};

const inspectFinalizationSourceNotes = (input: SourceNotesFlowInput, sourceFile: SourceFile): void => {
  if (
    hasNamedImport(sourceFile, "mergeDeepResearchFinalReportSourceNotes", "deep-research-analysis.source-notes.js")
    && hasCall(sourceFile, "mergeDeepResearchFinalReportSourceNotes")
    && hasPropertyAccess(sourceFile, "sourceNotes")
  ) {
    return;
  }
  pushMissing(
    input,
    sourceFile,
    "deep-research/source-notes-final-report",
    "Final adjudication persist path must merge package sourceNotes into the saved final report.",
  );
};

const inspectHtmlSourceNotes = (input: SourceNotesFlowInput, stageFile: SourceFile, promptFile: SourceFile): void => {
  if (
    hasCall(stageFile, "buildHtmlSourceNotes")
    && hasPropertyAccess(stageFile, "sourceNotes")
    && hasPropertyName(promptFile, "sourceNotes")
  ) {
    return;
  }
  pushMissing(
    input,
    stageFile,
    "deep-research/source-notes-html-prompt",
    "Business HTML report prompt must receive structured sourceNotes instead of empty references-only evidence.",
  );
};

const inspectResultContract = (input: SourceNotesFlowInput, sourceFile: SourceFile): void => {
  if (
    sourceFile.getVariableDeclaration("DeepResearchSourceNoteSchema")
    && hasPropertyName(sourceFile, "sourceNotes")
  ) {
    return;
  }
  pushMissing(
    input,
    sourceFile,
    "deep-research/source-notes-contract",
    "Final report contract must expose structured sourceNotes.",
  );
};

export const inspectSourceNotesFlow = (input: SourceNotesFlowInput): void => {
  if (requireFile(input.resultFile, input, "deep-research-analysis.result.ts")) {
    inspectResultContract(input, input.resultFile);
  }
  if (requireFile(input.finalPackageFile, input, "deep-research-analysis.final-package.ts")) {
    inspectFinalPackageSourceNotes(input, input.finalPackageFile);
  }
  if (requireFile(input.finalizationFile, input, "deep-research-analysis.analysis-finalization.ts")) {
    inspectFinalizationSourceNotes(input, input.finalizationFile);
  }
  if (
    requireFile(input.htmlReportStageFile, input, "deep-research-analysis.html-report-stage.ts")
    && requireFile(input.htmlReportPromptFile, input, "deep-research-analysis.html-report-prompt.ts")
  ) {
    inspectHtmlSourceNotes(input, input.htmlReportStageFile, input.htmlReportPromptFile);
  }
};
