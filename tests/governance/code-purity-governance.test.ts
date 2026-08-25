import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { Project } from "ts-morph";

import { scanCodePurityNoRegex } from "../../scripts/audit/domains/code-purity/components/scan-code-purity-no-regex.js";
import { createAuditProject } from "../../scripts/audit/shared/project.js";
import { repoRoot, resolveFromRepo } from "../../scripts/audit/shared/paths.js";

const lawIds = ["LAW-CODE-PURITY-001-V3"];

test("Code Purity enforcement uses structural analysis and rejects regex implementation mutants", () => {
  const project = new Project({ useInMemoryFileSystem: true });
  project.createSourceFile(resolve(repoRoot,
    "scripts/audit/domains/code-purity/components/regex-mutant.ts"), [
    "const harmlessText = 'regex-like text is not executable';",
    "export const counterfeitAstCheck = (source: string): boolean => /function\\s+/u.test(source);",
  ].join("\n"));
  const findings = scanCodePurityNoRegex(project, lawIds);
  assert.equal(findings.some((finding) => finding.checkId === "code-purity/no-regex"), true);
});

test("Code Purity ordinary governance check accepts the current enforcement implementation", () => {
  const findings = scanCodePurityNoRegex(createAuditProject(), lawIds);
  assert.deepEqual(findings, []);
});

test("Code Purity has no retired generated-plan or ci-full self-proof exception", () => {
  const antiEvasion = readFileSync(resolveFromRepo(
    "scripts/audit/domains/code-purity/components/zombie-anti-evasion.ts"), "utf8");
  const phaseRunner = readFileSync(resolveFromRepo(
    "scripts/audit/domains/code-purity/components/code-purity-phase-runner.ts"), "utf8");
  assert.doesNotMatch(antiEvasion, /run-generated-plan|ci-full|isGeneratedPlanOwnerImportContract/u);
  assert.doesNotMatch(phaseRunner, /scan-code-purity-no-regex/u);
});
