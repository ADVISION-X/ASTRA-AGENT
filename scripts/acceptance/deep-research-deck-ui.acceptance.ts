import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const reportViewPath = "src/app/workbench-deep-research-report-view.ts";
const clientReportSectionsPath = "src/app/workbench-deep-research-client-report-sections.ts";
const clientBootPath = "src/app/workbench-deep-research-client-boot.ts";

const read = (filePath: string): string => readFileSync(filePath, "utf8");

const reportView = read(reportViewPath);
const clientSections = read(clientReportSectionsPath);
const clientBoot = read(clientBootPath);

assert(reportView.includes("data-deep-research-business-deck"), "Report view must contain the Business Deck section.");
assert(clientSections.includes("Business PPT"), "Client sections must render the Business PPT heading.");
assert(clientSections.includes("Open PPT"), "Client sections must expose Open PPT.");
assert(clientSections.includes("Download PPT"), "Client sections must expose Download PPT.");
assert(clientSections.includes("Open Deck Outline"), "Client sections must expose Open Deck Outline.");
assert(clientSections.includes("Deck Warnings"), "Client sections must expose Deck Warnings.");
assert(clientSections.includes("Generated At"), "Client sections must expose Generated At.");
assert(clientSections.includes("Deck not generated"), "Client sections must expose the missing-deck state.");
assert(clientSections.includes("Local fallback PPT generated"), "Client sections must expose the local fallback state.");
assert(clientSections.includes("AI-generated PPT"), "Client sections must expose the AI-generated state.");
assert(clientBoot.includes("data-deep-research-open-export"), "Client boot must handle open-export deck actions.");
assert(clientBoot.includes("openDeepResearchExport"), "Client boot must expose openDeepResearchExport.");

const finalCardIndex = reportView.indexOf("data-deep-research-final-card");
const businessDeckIndex = reportView.indexOf("data-deep-research-business-deck");
assert(finalCardIndex >= 0 && businessDeckIndex >= 0 && finalCardIndex < businessDeckIndex, "Decision Card must stay before the Business Deck section.");

process.stdout.write("[ACCEPTANCE][deep-research-deck-ui] PASS\n");
