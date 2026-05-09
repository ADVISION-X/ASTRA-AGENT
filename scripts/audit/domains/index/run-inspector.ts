import { runOwnerInspector } from "../../core/owner-audit-runner.js";

void runOwnerInspector({
  capabilityDomain: "index",
  inspectorEntry: "scripts/audit/domains/index/inspector.ts",
  negativeProofScript: "scripts/audit/domains/index/negative-proof-harness.ts",
  skipNegativeProofEnv: "GRASSEYE_SKIP_INDEX_NEGATIVE_PROOF",
}).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});