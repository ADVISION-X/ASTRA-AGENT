import { runOwnerInspector } from "../../core/owner-audit-runner.js";

void runOwnerInspector({
  capabilityDomain: "mouse-click-capability",
  inspectorEntry: "scripts/audit/domains/mouse-click-capability/inspector.ts",
  negativeProofScript: "scripts/audit/domains/mouse-click-capability/negative-proof-harness.ts",
  skipNegativeProofEnv: "GRASSEYE_SKIP_MOUSE_CLICK_NEGATIVE_PROOF",
}).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});