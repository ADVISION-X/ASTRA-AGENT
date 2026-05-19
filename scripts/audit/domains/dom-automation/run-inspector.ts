import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { pathFromRepoRoot } from "../../core/paths.js";
import { runDomAutomationInspector } from "./inspector.js";

const RESULT_PATH = pathFromRepoRoot("scripts/audit/generated/dom-automation-binary-result.generated.json");

const result = await runDomAutomationInspector();
mkdirSync(dirname(RESULT_PATH), { recursive: true });
writeFileSync(RESULT_PATH, JSON.stringify(result, null, 2));

process.stdout.write(
  `\n[DOM-AUTOMATION][RESULT] status=${result.status} laws=${result.summary.passedLaws}/${result.summary.totalLaws} clauses=${result.summary.passedClauses}/${result.summary.totalClauses} inspector=${result.inspectorId}\n\n`,
);

if (result.status === "FAIL") {
  for (const lawResult of result.lawResults) {
    for (const clauseResult of lawResult.clauseResults.filter((clause) => clause.status === "FAIL")) {
      process.stdout.write(`  lawId: ${lawResult.lawId}\n`);
      process.stdout.write(`  clauseId: ${clauseResult.clauseId}\n`);
      process.stdout.write(`  enforcementLevel: ${clauseResult.enforcementLevel}\n`);
      process.stdout.write(`  evidence: ${clauseResult.evidence}\n`);
      if (clauseResult.failureReason) {
        process.stdout.write(`  failureReason: ${clauseResult.failureReason}\n`);
      }
      process.stdout.write("\n");
    }
  }
  process.exit(1);
}
