import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const exportText = readFileSync(
  "src/plugins/deep-research-analysis/deep-research-analysis.export.ts",
  "utf8",
);
const clientText = readFileSync(
  "src/app/workbench-deep-research-client-report-sections.ts",
  "utf8",
);

assert(exportText.includes('"business-deck.ai-pptx"'), "Export must prefer existing AI PPTX artifacts.");
assert(exportText.includes('"business-deck.local-pptx"'), "Local fallback must use local-pptx export kind.");
assert(exportText.includes('"deck_local_fallback_used"'), "Local fallback payload must record deck_local_fallback_used.");
assert(!exportText.includes('exportKind: "business-deck.ai-pptx",\n        filePath: pptxFilePath'), "Local generator must not save as AI PPTX.");
assert(clientText.includes("Local fallback PPT generated"), "UI must label local fallback explicitly.");
assert(clientText.includes("AI-generated PPT"), "UI must label AI-generated PPT explicitly.");

process.stdout.write("[ACCEPTANCE][deep-research-local-ppt-fallback] PASS\n");
