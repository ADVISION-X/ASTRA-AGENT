import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

export const inspectBusinessPptPromptBoundary = (input: {
  context: InspectorContext;
  promptFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
}): void => {
  const lawId = selectLawId(input.context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-027-V1");
  if (input.promptFile) input.inspectedFiles.add(getRepoSourcePath(input.promptFile));
  const promptLiteralText = input.promptFile?.getDescendantsOfKind(SyntaxKind.StringLiteral)
    .map((literal) => literal.getLiteralValue())
    .join("\n") ?? "";
  const promptDeclaration = input.promptFile?.getVariableDeclaration("businessPptArtifactSecretaryPrompt");
  if (!promptDeclaration) {
    input.findings.push(createFinding({
      checkId: "deep-research/business-ppt-prompt-asset",
      lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.ppt-artifact-prompt.ts",
      message: "businessPptArtifactSecretaryPrompt must be an AST-visible prompt object literal.",
    }));
  }
  for (const marker of [
    "not a researcher",
    "not a final adjudicator",
    "not allowed to conduct deeper research",
    "not allowed to change the final judgment",
    "not allowed to add new facts",
    "not allowed to remove or distort the original content",
    "Create a downloadable PowerPoint file (.pptx).",
    "Do not output only JSON.",
    "Do not output only markdown.",
    "Do not output only an outline.",
  ]) {
    if (promptLiteralText.includes(marker)) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/business-ppt-prompt-boundary",
      lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.ppt-artifact-prompt.ts",
      message: `Business PPT prompt must include boundary marker: ${marker}.`,
    }));
  }
};
