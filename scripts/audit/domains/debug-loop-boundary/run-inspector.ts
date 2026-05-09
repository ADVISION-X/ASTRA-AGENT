import { runOwnerInspector } from "../../core/owner-audit-runner.js";

void runOwnerInspector({
  capabilityDomain: "debug-loop-boundary",
  inspectorEntry: "scripts/audit/domains/debug-loop-boundary/inspector.ts",
  negativeProofScript: "scripts/audit/domains/debug-loop-boundary/negative-proof-harness.ts",
}).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
