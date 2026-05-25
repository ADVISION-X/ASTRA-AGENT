import { SyntaxKind, type SourceFile } from "ts-morph";
import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const hasIdentifier = (sourceFile: SourceFile | undefined, value: string): boolean =>
  Boolean(sourceFile?.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => identifier.getText() === value));

export const inspectFinalAdjudicationFullInput = (input: {
  finalizationFile: SourceFile | undefined;
  finalAdjudicationPromptFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  for (const sourceFile of [input.finalizationFile, input.finalAdjudicationPromptFile]) {
    if (sourceFile) input.inspectedFiles.add(getRepoSourcePath(sourceFile));
  }
  const checks = [
    { ok: hasIdentifier(input.finalizationFile, "fullCaseFile") && hasIdentifier(input.finalizationFile, "renderDeepResearchFinalAdjudicationPrompt"), filePath: "src/plugins/deep-research-analysis/deep-research-analysis.analysis-finalization.ts" },
    { ok: hasIdentifier(input.finalAdjudicationPromptFile, "fullCaseFile") && hasIdentifier(input.finalAdjudicationPromptFile, "fullCaseFileMarkdown"), filePath: "src/plugins/deep-research-analysis/deep-research-analysis.final-adjudication-prompt.ts" },
  ];
  for (const check of checks) {
    if (check.ok) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/final-adjudication-full-input",
      lawId: input.lawId,
      filePath: check.filePath,
      message: "Final adjudication must receive the full case file.",
    }));
  }
};
