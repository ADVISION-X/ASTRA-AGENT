import { runOwnerInspector } from "../../core/owner-audit-runner.js";

void runOwnerInspector({
  capabilityDomain: "mouse-scroll-capability",
  inspectorEntry: "scripts/audit/domains/mouse-scroll-capability/inspector.ts",
  negativeProofScript: "scripts/audit/domains/mouse-scroll-capability/negative-proof-harness.ts",
  skipNegativeProofEnv: "GRASSEYE_SKIP_MOUSE_SCROLL_NEGATIVE_PROOF",
}).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});