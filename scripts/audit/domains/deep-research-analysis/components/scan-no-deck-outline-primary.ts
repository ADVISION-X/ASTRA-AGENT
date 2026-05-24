import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

export const inspectNoDeckOutlinePrimary = (input: {
  context: InspectorContext;
  deckStageFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
}): void => {
  const lawId = selectLawId(input.context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-026-V1");
  if (input.deckStageFile) input.inspectedFiles.add(getRepoSourcePath(input.deckStageFile));
  const imports = input.deckStageFile?.getImportDeclarations().flatMap((declaration) =>
    declaration.getNamedImports().map((namedImport) => namedImport.getName())) ?? [];
  const calls = input.deckStageFile?.getDescendantsOfKind(SyntaxKind.CallExpression).map((call) => {
    const expression = call.getExpression();
    return Node.isIdentifier(expression) ? expression.getText() : expression.getText();
  }) ?? [];
  for (const forbiddenSymbol of [
    "parseDeepResearchBusinessDeckOutlineResponseForFinalReport",
    "writeDeckOutlineArtifact",
  ]) {
    if (!imports.includes(forbiddenSymbol) && !calls.includes(forbiddenSymbol)) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/no-deck-outline-primary",
      lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.deck-stage.ts",
      message: `${forbiddenSymbol} must not be in the primary AI PPT artifact path.`,
    }));
  }
  const text = input.deckStageFile?.getFullText() ?? "";
  if (text.includes("business_deck_limitations_not_preserved")) {
    input.findings.push(createFinding({
      checkId: "deep-research/no-content-validator-primary",
      lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.deck-stage.ts",
      message: "business_deck_limitations_not_preserved must not block primary AI PPT artifact flow.",
    }));
  }
};
