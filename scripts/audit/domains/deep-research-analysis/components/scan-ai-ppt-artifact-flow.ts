import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

export const inspectAiPptArtifactFlow = (input: {
  context: InspectorContext;
  deckStageFile: SourceFile | undefined;
  schemaFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
}): void => {
  const lawId = selectLawId(input.context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-025-V1");
  [input.deckStageFile, input.schemaFile].forEach((sourceFile) => {
    if (sourceFile) input.inspectedFiles.add(getRepoSourcePath(sourceFile));
  });
  const deckStage = input.deckStageFile;
  const schemaText = input.schemaFile?.getFullText() ?? "";
  const runPromptExchange = deckStage?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((call) => Node.isIdentifier(call.getExpression()) && call.getExpression().getText() === "runPromptExchange");
  const callText = runPromptExchange?.getText() ?? "";
  for (const marker of [
    "businessPptArtifactSecretaryPrompt",
    "renderDeepResearchBusinessPptArtifactPrompt",
    "parseAndDownloadBusinessPptArtifact",
    '"business-deck.ai-pptx"',
  ]) {
    if (callText.includes(marker) || (deckStage?.getFullText() ?? "").includes(marker)) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/ai-ppt-artifact-flow",
      lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.deck-stage.ts",
      message: `Primary deck stage must include AI PPT artifact marker ${marker}.`,
    }));
  }
  for (const stage of ["DECK_PPT_SEND", "DECK_PPT_CAPTURE", "DECK_PPT_ARTIFACT_DETECT", "DECK_PPT_DOWNLOAD", "DECK_PPT_PERSIST"]) {
    if (schemaText.includes(stage)) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/ai-ppt-artifact-stage",
      lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.schema.ts",
      message: `Deep Research schema must expose ${stage}.`,
    }));
  }
};
