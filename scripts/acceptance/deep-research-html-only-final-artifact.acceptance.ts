import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const decode = (value: string): string => Buffer.from(value, "base64").toString("utf8");

const exportFile = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.export.ts", "utf8");
const contracts = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.record-contracts.ts", "utf8");
const delivery = readFileSync("src/app/workbench-deep-research-client-delivery-sections.ts", "utf8");
const packageJson = readFileSync("package.json", "utf8");
const ciFull = readFileSync("scripts/audit/ci-full.ts", "utf8");

assert(exportFile.includes("business-report.html"), "business-report.html export is required.");
assert(contracts.includes("business-report.html"), "business-report.html must be an export kind.");
assert(!contracts.includes(decode("LnBwdA==")), "PreviousSchema presentation export kinds must not exist.");
assert(!delivery.includes(decode("T3BlbiBQUFQ=")), "UI must not expose previous schema presentation open action.");
assert(!delivery.includes(decode("RG93bmxvYWQgUFBU")), "UI must not expose previous schema presentation download action.");
assert(packageJson.includes("acceptance:deep-research-html-only-final-artifact"), "package.json must wire the HTML-only final artifact acceptance.");
assert(ciFull.includes("acceptance:deep-research-html-only-final-artifact"), "ci:full must execute the HTML-only final artifact acceptance.");
