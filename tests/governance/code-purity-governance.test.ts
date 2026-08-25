import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { resolveFromRepo } from "../../scripts/audit/shared/paths.js";

test("Code Purity has no retired generated-plan or ci-full self-proof exception", () => {
  const antiEvasion = readFileSync(resolveFromRepo(
    "scripts/audit/domains/code-purity/components/zombie-anti-evasion.ts"), "utf8");
  const phaseRunner = readFileSync(resolveFromRepo(
    "scripts/audit/domains/code-purity/components/code-purity-phase-runner.ts"), "utf8");
  assert.doesNotMatch(antiEvasion, /run-generated-plan|ci-full|isGeneratedPlanOwnerImportContract/u);
  assert.doesNotMatch(phaseRunner, /scan-code-purity-no-regex/u);
});
