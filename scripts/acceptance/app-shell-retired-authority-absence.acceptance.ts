import assert from "../audit/shared/governance-exam-assert.js";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { extname } from "node:path";

import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

const legacyDocPath = "docs/法案辅助文件/GrassEye APP 用户需求启动施工图.md";
const legacyDocTitle = "GrassEye APP 用户需求启动施工图";
const examPath = "scripts/acceptance/app-shell-retired-authority-absence.acceptance.ts";
const textExtensions = new Set([
  "", ".cjs", ".css", ".csv", ".html", ".js", ".json", ".jsx", ".md", ".mjs",
  ".scss", ".sql", ".svg", ".toml", ".ts", ".tsx", ".txt", ".yaml", ".yml",
]);

const repositoryPaths = (): string[] => execFileSync(
  "git", ["ls-files", "--cached", "--others", "--exclude-standard"],
  { cwd: process.cwd(), encoding: "utf8" },
).split("\n").filter((path) => path.length > 0 && existsSync(path)).sort();

const governedPath = (path: string): boolean => path === "package.json"
  || [".github/", "docs/", "scripts/", "src/"].some((prefix) => path.startsWith(prefix));

const enforcementMentionAllowed = (path: string): boolean => path === examPath
  || path === ".github/instructions/agent-rules/基础法案.md"
  || path === ".github/instructions/agent-rules/功能法案.md"
  || path.startsWith("scripts/audit/domains/app-shell-ui/")
  || path.startsWith("tests/governance/");

assert.equal(existsSync(legacyDocPath), false, "The retired APP startup blueprint must be physically absent.");
for (const path of repositoryPaths().filter(governedPath)) {
  const normalized = path.toLocaleLowerCase("en-US");
  const copiedVariant = normalized !== legacyDocPath.toLocaleLowerCase("en-US")
    && (normalized.includes(legacyDocTitle.toLocaleLowerCase("en-US"))
      || normalized.includes("grasseye app user demand startup"));
  assert.equal(copiedVariant, false, `Retired APP startup blueprint copy remains: ${path}`);
  if (enforcementMentionAllowed(path) || !textExtensions.has(extname(path).toLocaleLowerCase("en-US"))) continue;
  const source = readFileSync(path, "utf8");
  const referencesRetiredAuthority = source.includes(legacyDocPath) || source.includes(legacyDocTitle);
  assert.equal(referencesRetiredAuthority, false, `Non-governance source references retired APP startup blueprint: ${path}`);
}

process.stdout.write("[ACCEPTANCE][app-shell-retired-authority-absence] PASS\n");
emitQualityProofObservation({
  lawId: "LAW-APP-SHELL-UI-003-V3",
  evidenceMode: "exam.golden",
  clauses: ["forbidden:0", "forbidden:1", "forbidden:2", "summary"],
  locator: "acceptance:app-shell-ui:retired-startup-blueprint-physical-absence",
  observedValue: "retired APP user-demand startup blueprint path, copied variants, and non-governance references are physically absent from the current repository candidate",
});
