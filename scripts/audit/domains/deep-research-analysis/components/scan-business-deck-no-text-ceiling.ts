import { Node, SyntaxKind, type ObjectLiteralExpression, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const deckStagePath = "src/plugins/deep-research-analysis/deep-research-analysis.deck-stage.ts";

const getObjectLiteralArgument = (
  sourceFile: SourceFile,
  callName: string,
): ObjectLiteralExpression | null => {
  const callExpression = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((call) => call.getExpression().getText() === callName);
  const firstArgument = callExpression?.getArguments()[0];
  return firstArgument && Node.isObjectLiteralExpression(firstArgument) ? firstArgument : null;
};

export const inspectBusinessDeckNoTextCeiling = (input: {
  deckStageFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  if (input.deckStageFile) {
    input.inspectedFiles.add(getRepoSourcePath(input.deckStageFile));
  }
  if (!input.deckStageFile) {
    input.findings.push(createFinding({
      checkId: "deep-research/business-deck-stage-file",
      lawId: input.lawId,
      filePath: deckStagePath,
      message: "Deep Research business deck stage file must exist.",
    }));
    return;
  }
  const runPromptExchangeArgument = getObjectLiteralArgument(input.deckStageFile, "runPromptExchange");
  const maxInputCharsProperty = runPromptExchangeArgument?.getProperty("maxInputChars");
  const hasNoTextCeiling = Node.isPropertyAssignment(maxInputCharsProperty)
    && maxInputCharsProperty.getInitializer()?.getText() === "Number.MAX_SAFE_INTEGER";
  const hasLegacyTextCeiling = input.deckStageFile.getDescendantsOfKind(SyntaxKind.NumericLiteral)
    .some((literal) => literal.getText() === "45_000");
  if (!hasNoTextCeiling || hasLegacyTextCeiling) {
    input.findings.push(createFinding({
      checkId: "deep-research/business-deck-no-text-ceiling",
      lawId: input.lawId,
      filePath: deckStagePath,
      message: "Business Deck Secretary must use Number.MAX_SAFE_INTEGER and must not restore the old 45k prompt-size ceiling.",
    }));
  }
};