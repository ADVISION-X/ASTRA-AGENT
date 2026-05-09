import { runOwnerInspector } from "../../core/owner-audit-runner.js";

void runOwnerInspector({
  capabilityDomain: "screenshot-capability",
  inspectorEntry: "scripts/audit/domains/screenshot-capability/inspector.ts",
  negativeProofScript: "scripts/audit/domains/screenshot-capability/run-negative-proof.ts",
  skipNegativeProofEnv: "GRASSEYE_SKIP_SCREENSHOT_NEGATIVE_PROOF",
}).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
