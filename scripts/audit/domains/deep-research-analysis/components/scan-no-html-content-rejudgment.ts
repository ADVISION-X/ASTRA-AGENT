import { createFinding, selectLawId } from "../../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";
import type { SourceFile } from "ts-morph";

const markInspected = (
  inspectedFiles: Set<string>,
  sourceFiles: readonly (SourceFile | undefined)[],
): void => {
  sourceFiles.forEach((sourceFile) => {
    if (sourceFile) {
      inspectedFiles.add(getRepoSourcePath(sourceFile));
    }
  });
};

export const inspectNoHtmlContentRejudgment = (input: {
  context: InspectorContext;
  promptFile: SourceFile | undefined;
  htmlReportStageFile: SourceFile | undefined;
  htmlReportExportFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
}): void => {
  const lawId = selectLawId(input.context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-031-V1");
  markInspected(input.inspectedFiles, [
    input.promptFile,
    input.htmlReportStageFile,
    input.htmlReportExportFile,
  ]);

  const promptText = input.promptFile?.getFullText() ?? "";
  for (const marker of [
    '"contentRejudgment"',
    '"unsupportedResearchExpansion"',
    '"externalResources"',
    '"scripts"',
  ] as const) {
    if (promptText.includes(marker)) {
      continue;
    }
    input.findings.push(createFinding({
      checkId: "deep-research/no-html-content-rejudgment-prompt",
      lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.html-report-prompt.ts",
      message: `Business HTML prompt contract must forbid ${marker}.`,
    }));
  }

  const stageAndExportText = [
    input.htmlReportStageFile?.getFullText() ?? "",
    input.htmlReportExportFile?.getFullText() ?? "",
  ].join("\n");
  for (const forbiddenMarker of [
    "business_deck_limitations_not_preserved",
    "finalVerdictPreserved",
    "confidencePreserved",
    "directAnswerPreserved",
    "parseDeepResearchBusinessDeckOutlineResponseForFinalReport",
    "writeDeckOutlineArtifact",
  ] as const) {
    if (!stageAndExportText.includes(forbiddenMarker)) {
      continue;
    }
    input.findings.push(createFinding({
      checkId: "deep-research/no-html-content-rejudgment-runtime",
      lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.html-report-stage.ts",
      message: `Primary HTML report flow must not reintroduce ${forbiddenMarker}.`,
    }));
  }
};