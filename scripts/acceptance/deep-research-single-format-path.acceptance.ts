import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const decode = (value: string): string => Buffer.from(value, "base64").toString("utf8");

const sourceTexts = [
  readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.parser.ts", "utf8"),
  readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.html-report-stage.ts", "utf8"),
  readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.public-contracts.ts", "utf8"),
  readFileSync("src/app/workbench-deep-research-client-contracts.ts", "utf8"),
  readFileSync("src/app/workbench-deep-research-client-report-sections.ts", "utf8"),
  readFileSync("src/app/workbench-deep-research-client-shared.ts", "utf8"),
];

for (const forbidden of [
  decode("RGVlcFJlc2VhcmNoRmluYWxSZXBvcnRTY2hlbWE="),
  decode("YnVpbGRGaW5hbEFkanVkaWNhdGlvblRleHRSYXdJbmRleFZhbHVl"),
  decode("ZmluYWwtcmVwb3J0Lm1k"),
  decode("b3B0aW9uYWxDb250ZW50"),
  decode("ZGVjaXNpb24tcGFja2FnZS5qc29u"),
  decode("YnVzaW5lc3MtZGVjaw=="),
  decode("ZGVja091dGxpbmU="),
  decode("UFBUWA=="),
]) {
  for (const text of sourceTexts) {
    assert(!text.includes(forbidden), `Deep Research active source must not retain ${forbidden}.`);
  }
}

process.stdout.write("[ACCEPTANCE][deep-research-single-format-path] PASS\n");