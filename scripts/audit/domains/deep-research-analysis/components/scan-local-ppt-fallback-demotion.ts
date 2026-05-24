import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

export const inspectLocalPptFallbackDemotion = (input: {
  context: InspectorContext;
  exportFile: SourceFile | undefined;
  uiFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
}): void => {
  const lawId = selectLawId(input.context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-028-V1");
  [input.exportFile, input.uiFile].forEach((sourceFile) => {
    if (sourceFile) input.inspectedFiles.add(getRepoSourcePath(sourceFile));
  });
  const exportText = input.exportFile?.getFullText() ?? "";
  const uiText = input.uiFile?.getFullText() ?? "";
  const stringCount = input.exportFile?.getDescendantsOfKind(SyntaxKind.StringLiteral).length ?? 0;
  for (const marker of [
    '"business-deck.local-pptx"',
    '"deck_local_fallback_used"',
    'status: "deck_export_partial"',
  ]) {
    if (exportText.includes(marker) && stringCount > 0) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/local-ppt-fallback-demotion",
      lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.export.ts",
      message: `Local PPT fallback must include marker ${marker}.`,
    }));
  }
  if (!uiText.includes("Local fallback PPT generated")) {
    input.findings.push(createFinding({
      checkId: "deep-research/local-ppt-fallback-ui",
      lawId,
      filePath: "src/app/workbench-deep-research-client-report-sections.ts",
      message: "UI must distinguish local fallback PPT from AI-generated PPT.",
    }));
  }
};
