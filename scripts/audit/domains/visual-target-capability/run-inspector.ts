import { runOwnerInspector } from "../../core/owner-audit-runner.js";

void runOwnerInspector({
  capabilityDomain: "visual-target-capability",
  inspectorEntry: "scripts/audit/domains/visual-target-capability/inspector.ts",
  negativeProofScript: "scripts/audit/domains/visual-target-capability/negative-proof-harness.ts",
  skipNegativeProofEnv: "GRASSEYE_SKIP_VISUAL_TARGET_NEGATIVE_PROOF",
}).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
