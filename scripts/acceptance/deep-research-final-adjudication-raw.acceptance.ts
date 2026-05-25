import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { parseDeepResearchFinalAdjudicationResponse } from "../../src/plugins/deep-research-analysis/acceptance-surface.js";

const oldFinalSchemaName = "DeepResearch" + "FinalReportSchema";

const markdown = parseDeepResearchFinalAdjudicationResponse("# Final\n\nRaw markdown answer.");
assert(markdown.parsed?.rawFinalAnswerText.includes("Raw markdown answer."), "Markdown final response must persist as rawFinalAnswerText.");
assert.equal(markdown.parsed?.parseStatus, "raw_structured_text", "Markdown final response must be raw_structured_text.");

const structuredText = parseDeepResearchFinalAdjudicationResponse("Decision\n\nUse the full case file as source.");
assert(structuredText.parsed?.rawFinalAnswerText.includes("Decision"), "Structured text final response must persist as rawFinalAnswerText.");

const json = parseDeepResearchFinalAdjudicationResponse(JSON.stringify({ decision: "Proceed with constraints" }));
assert(json.parsed?.rawFinalAnswerText.includes("Proceed with constraints"), "JSON final response must also persist rawFinalAnswerText.");
assert.equal(json.parsed?.parseStatus, "parsed_json_index", "JSON final response must store parsedJsonIndex as secondary index.");
assert.deepEqual(json.parsed?.parsedJsonIndex, { decision: "Proceed with constraints" }, "Parsed JSON index must preserve the JSON object.");

const resultText = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.result.ts", "utf8");
assert(resultText.includes("DeepResearchFinalAdjudicationRecordSchema"), "Final raw record schema must exist.");
assert(!resultText.includes(oldFinalSchemaName), "Fixed final report schema must not remain primary.");

process.stdout.write("[ACCEPTANCE][deep-research-final-adjudication-raw] PASS\n");
