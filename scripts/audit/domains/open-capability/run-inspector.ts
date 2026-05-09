import { runOwnerInspector } from "../../core/owner-audit-runner.js";

void runOwnerInspector({
  capabilityDomain: "open-capability",
  inspectorEntry: "scripts/audit/domains/open-capability/inspector.ts",
  negativeProofScript: "scripts/audit/domains/open-capability/negative-proof-harness.ts",
  skipNegativeProofEnv: "GRASSEYE_SKIP_OPEN_NEGATIVE_PROOF",
}).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});