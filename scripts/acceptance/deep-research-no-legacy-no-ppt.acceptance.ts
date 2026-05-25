import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";

const decode = (value: string): string => Buffer.from(value, "base64").toString("utf8");

const files = execFileSync("rg", [
  "--files",
  "docs/法案辅助文件",
  "src/plugins/deep-research-analysis",
  "src/app",
  "scripts/acceptance",
  "scripts/audit/domains/deep-research-analysis",
  ".github/instructions/agent-rules/modules/module-deep-research-analysis.instructions.md",
], { encoding: "utf8" }).trim().split("\n").filter((file) => Boolean(file) && !file.includes("generated/"));

const forbidden = [
  decode("bGVnYWN5XzFfbl9uXzE="),
  decode("cG9zaXRpdmVBbnN3ZXJSZWNvcmRz"),
  decode("ZmFsc2lmaWNhdGlvbkFuc3dlclJlY29yZHM="),
  decode("Y29uZmxpY3RNYXRyaXg="),
  decode("YnVzaW5lc3MtZGVjaw=="),
  decode("cHB0eA=="),
  decode("cHB0"),
  decode("YnVzaW5lc3NEZWNr"),
];

for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const term of forbidden) {
    assert(!text.includes(term), `${file} must not contain retired Deep Research markers.`);
  }
}

process.stdout.write("[ACCEPTANCE][deep-research-no-legacy-no-ppt] PASS\n");
