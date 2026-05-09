import { runOwnerInspector } from "../../core/owner-audit-runner.js";

void runOwnerInspector({
  capabilityDomain: "nerve-bus-capability",
  inspectorEntry: "scripts/audit/domains/nerve-bus-capability/inspector.ts",
  negativeProofScript: "scripts/audit/domains/nerve-bus-capability/run-negative-proof.ts",
  skipNegativeProofEnv: "GRASSEYE_SKIP_NERVE_BUS_NEGATIVE_PROOF",
}).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
