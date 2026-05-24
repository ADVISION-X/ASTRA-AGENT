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

const inspectExportMarkers = (input: {
  exportFile: SourceFile | undefined;
  findings: InspectorFinding[];
  lawId: string;
}): void => {
  const exportText = input.exportFile?.getFullText() ?? "";
  for (const marker of [
    "selectOptionalPresentationDeck",
    'record.exportKind === "business-deck.ai-pptx"',
    'record.exportKind === "business-deck.local-pptx"',
    'record.exportKind === "business-deck.pptx"',
    'Deep Research primary business HTML report is missing.',
  ] as const) {
    if (exportText.includes(marker)) {
      continue;
    }
    input.findings.push(createFinding({
      checkId: "deep-research/ppt-demoted-to-optional-export",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.export.ts",
      message: `Optional PPT demotion must include ${marker}.`,
    }));
  }
};

const inspectOptionalUiMarkers = (input: {
  deliveryFile: SourceFile | undefined;
  reportSectionsFile: SourceFile | undefined;
  findings: InspectorFinding[];
  lawId: string;
}): void => {
  const uiText = [
    input.deliveryFile?.getFullText() ?? "",
    input.reportSectionsFile?.getFullText() ?? "",
  ].join("\n");
  for (const marker of [
    "Primary Business Report",
    "HTML report not generated",
    "Open HTML Report",
    "Download HTML Report",
    "Optional Presentation Deck",
    "PPT is optional and does not block the primary business HTML report.",
  ] as const) {
    if (uiText.includes(marker)) {
      continue;
    }
    input.findings.push(createFinding({
      checkId: "deep-research/ppt-demoted-to-optional-ui",
      lawId: input.lawId,
      filePath: "src/app/workbench-deep-research-client-delivery-sections.ts",
      message: `Delivery UI must include ${marker}.`,
    }));
  }
};

const inspectCiBinding = (input: {
  ciFullFile: SourceFile | undefined;
  findings: InspectorFinding[];
  lawId: string;
}): void => {
  if ((input.ciFullFile?.getFullText() ?? "").includes("acceptance:deep-research-ppt-optional-demotion")) {
    return;
  }
  input.findings.push(createFinding({
    checkId: "deep-research/ppt-demoted-to-optional-ci",
    lawId: input.lawId,
    filePath: "scripts/audit/ci-full.ts",
    message: "ci:full must execute acceptance:deep-research-ppt-optional-demotion.",
  }));
};

export const inspectPptDemotedToOptional = (input: {
  context: InspectorContext;
  exportFile: SourceFile | undefined;
  finalizationFile: SourceFile | undefined;
  deliveryFile: SourceFile | undefined;
  reportSectionsFile: SourceFile | undefined;
  acceptanceFile: SourceFile | undefined;
  ciFullFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
}): void => {
  const lawId = selectLawId(input.context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-032-V1");
  markInspected(input.inspectedFiles, [
    input.exportFile,
    input.finalizationFile,
    input.deliveryFile,
    input.reportSectionsFile,
    input.acceptanceFile,
    input.ciFullFile,
  ]);
  inspectExportMarkers({
    exportFile: input.exportFile,
    findings: input.findings,
    lawId,
  });

  if ((input.finalizationFile?.getFullText() ?? "").includes("deck_export_partial")) {
    input.findings.push(createFinding({
      checkId: "deep-research/ppt-demoted-to-optional-finalization",
      lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.analysis-finalization.ts",
      message: "Primary Deep Research completion must not downgrade to deck_export_partial because PPT is optional.",
    }));
  }
  inspectOptionalUiMarkers({
    deliveryFile: input.deliveryFile,
    reportSectionsFile: input.reportSectionsFile,
    findings: input.findings,
    lawId,
  });
  inspectCiBinding({
    ciFullFile: input.ciFullFile,
    findings: input.findings,
    lawId,
  });
};