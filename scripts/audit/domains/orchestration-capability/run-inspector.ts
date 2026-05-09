import { runOwnerInspector } from "../../core/owner-audit-runner.js";

void runOwnerInspector({
  capabilityDomain: "orchestration-capability",
  inspectorEntry: "scripts/audit/domains/orchestration-capability/inspector.ts",
  negativeProofScript: "scripts/audit/domains/orchestration-capability/run-negative-proof.ts",
  skipNegativeProofEnv: "GRASSEYE_SKIP_ORCHESTRATION_NEGATIVE_PROOF",
}).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
