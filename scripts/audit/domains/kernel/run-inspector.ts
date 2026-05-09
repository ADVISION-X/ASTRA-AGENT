import { runOwnerInspector } from "../../core/owner-audit-runner.js";

void runOwnerInspector({
  capabilityDomain: "kernel",
  inspectorEntry: "scripts/audit/domains/kernel/inspector.ts",
  negativeProofScript: "scripts/audit/domains/kernel/negative-proof-harness.ts",
  skipNegativeProofEnv: "GRASSEYE_SKIP_KERNEL_NEGATIVE_PROOF",
}).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
