import { readJsonFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";

type CoverageSummary = {
  finalVerdict: "PASS" | "BLOCKED";
  generatedFakePass: number;
};

async function main(): Promise<void> {
  const summary = await readJsonFile<CoverageSummary>(
    pathFromRepoRoot("scripts/audit/generated/audit-coverage-summary.generated.json"),
  );
  if (summary.finalVerdict === "PASS" && summary.generatedFakePass > 0) {
    throw new Error("Coverage summary cannot pass while generated fake PASS evidence exists.");
  }
  process.stdout.write("[NEGATIVE-PROOF] PASS coverage summary rejects generated fake PASS evidence.\n");
}

void main();
