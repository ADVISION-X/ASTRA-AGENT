import { runOwnerInspector } from "../../core/owner-audit-runner.js";

void runOwnerInspector({
  capabilityDomain: "type-safety",
  inspectorEntry: "scripts/audit/domains/type-safety/inspector.ts",
  negativeProofScript: "scripts/audit/domains/type-safety/negative-proof-harness.ts",
  skipNegativeProofEnv: "GRASSEYE_SKIP_TYPE_SAFETY_NEGATIVE_PROOF",
}).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});