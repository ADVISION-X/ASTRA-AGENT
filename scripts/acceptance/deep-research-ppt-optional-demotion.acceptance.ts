import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (filePath: string): string => readFileSync(filePath, "utf8");

const exportText = read(
  "src/plugins/deep-research-analysis/deep-research-analysis.export.ts",
);
const finalizationText = read(
  "src/plugins/deep-research-analysis/deep-research-analysis.analysis-finalization.ts",
);
const deliveryText = read(
  "src/app/workbench-deep-research-client-delivery-sections.ts",
);
const sectionsText = read(
  "src/app/workbench-deep-research-client-report-sections.ts",
);
const viewText = read(
  "src/app/workbench-deep-research-report-view.ts",
);

assert(
  exportText.includes("selectOptionalPresentationDeck"),
  "Export must explicitly demote PPT selection into an optional presentation deck helper.",
);
assert(
  exportText.includes("Deep Research primary business HTML report is missing."),
  "Primary export completion must fail only when business-report.html is missing.",
);
assert(
  exportText.includes('record.exportKind === "business-deck.ai-pptx"')
    && exportText.includes('record.exportKind === "business-deck.local-pptx"'),
  "Optional deck selection must treat PPTX as an optional derived artifact.",
);
assert(
  !finalizationText.includes("deck_export_partial"),
  "Job completion must not downgrade the primary Deep Research HTML run because PPT export is partial.",
);

for (const marker of [
  "Primary Business Report",
  "HTML report not generated",
  "Open HTML Report",
  "Download HTML Report",
  "Optional Presentation Deck",
  "PPT is optional and does not block the primary business HTML report.",
] as const) {
  assert(
    deliveryText.includes(marker) || sectionsText.includes(marker) || viewText.includes(marker),
    `Report delivery UI must include ${marker}.`,
  );
}

process.stdout.write("[ACCEPTANCE][deep-research-ppt-optional-demotion] PASS\n");