import { SyntaxKind, type SourceFile } from "ts-morph";

import { astExpressionPath, astIdentifierName } from "../../../shared/ast-node-identity.js";
import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const hasIdentifier = (sourceFile: SourceFile | undefined, value: string): boolean =>
  !!sourceFile?.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => astIdentifierName(identifier) === value);

const hasPropertyAccessPath = (sourceFile: SourceFile | undefined, path: string): boolean =>
  !!sourceFile?.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    .some((expression) => astExpressionPath(expression) === path);

export const inspectPromptBundleBusinessSovereignty = (input: {
  promptBundleRenderFile: SourceFile | undefined;
  analysisSubQuestionsFile: SourceFile | undefined;
  finalizationFile: SourceFile | undefined;
  htmlReportStageFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  for (const sourceFile of [
    input.promptBundleRenderFile,
    input.analysisSubQuestionsFile,
    input.finalizationFile,
    input.htmlReportStageFile,
  ]) {
    if (sourceFile) input.inspectedFiles.add(getRepoSourcePath(sourceFile));
  }
  for (const [sourceFile, marker, found] of [
    [input.promptBundleRenderFile, "renderPromptBundleSection", hasIdentifier(input.promptBundleRenderFile, "renderPromptBundleSection")],
    [input.analysisSubQuestionsFile, "subQuestion.question.promptBundle", hasPropertyAccessPath(input.analysisSubQuestionsFile, "subQuestion.question.promptBundle")],
    [input.finalizationFile, "finalAdjudicationPromptBundle", hasIdentifier(input.finalizationFile, "finalAdjudicationPromptBundle")],
    [input.htmlReportStageFile, "htmlReportPromptBundle", hasIdentifier(input.htmlReportStageFile, "htmlReportPromptBundle")],
  ] as const) {
    if (found) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/promptbundle-business-sovereignty/missing-marker",
      lawId: input.lawId,
      filePath: sourceFile ? getRepoSourcePath(sourceFile) : "src/plugins/deep-research-analysis",
      message: `PromptBundle business sovereignty marker is missing: ${marker}.`,
    }));
  }
};
