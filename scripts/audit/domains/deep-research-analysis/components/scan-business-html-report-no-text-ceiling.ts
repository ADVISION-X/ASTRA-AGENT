import { Node, SyntaxKind, type ObjectLiteralExpression, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const htmlReportStagePath = "src/plugins/deep-research-analysis/deep-research-analysis.html-report-stage.ts";

const getObjectLiteralArgument = (
  sourceFile: SourceFile,
  callName: string,
): ObjectLiteralExpression | null => {
  const callExpression = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((call) => call.getExpression().getText() === callName);
  const firstArgument = callExpression?.getArguments()[0];
  return firstArgument && Node.isObjectLiteralExpression(firstArgument) ? firstArgument : null;
};

export const inspectBusinessHtmlReportNoTextCeiling = (input: {
  htmlReportStageFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  if (input.htmlReportStageFile) {
    input.inspectedFiles.add(getRepoSourcePath(input.htmlReportStageFile));
  }
  if (!input.htmlReportStageFile) {
    input.findings.push(createFinding({
      checkId: "deep-research/business-html-report-stage-file",
      lawId: input.lawId,
      filePath: htmlReportStagePath,
      message: "Deep Research business HTML report stage file must exist.",
    }));
    return;
  }
  const runPromptExchangeArgument = getObjectLiteralArgument(input.htmlReportStageFile, "runPromptExchange");
  const maxInputCharsProperty = runPromptExchangeArgument?.getProperty("maxInputChars");
  const hasNoTextCeiling = Node.isPropertyAssignment(maxInputCharsProperty)
    && maxInputCharsProperty.getInitializer()?.getText() === "Number.MAX_SAFE_INTEGER";
  const hasLegacyTextCeiling = input.htmlReportStageFile.getDescendantsOfKind(SyntaxKind.NumericLiteral)
    .some((literal) => literal.getText() === "45_000");
  if (!hasNoTextCeiling || hasLegacyTextCeiling) {
    input.findings.push(createFinding({
      checkId: "deep-research/business-html-report-no-text-ceiling",
      lawId: input.lawId,
      filePath: htmlReportStagePath,
      message: "Business HTML Report Publisher must use Number.MAX_SAFE_INTEGER and must not restore the old 45k prompt-size ceiling.",
    }));
  }
};