import { runOwnerInspector } from "../../core/owner-audit-runner.js";

void runOwnerInspector({
  capabilityDomain: "map-plugin-package",
  inspectorEntry: "scripts/audit/domains/map-plugin-package/inspector.ts",
  negativeProofScript: "scripts/audit/domains/map-plugin-package/negative-proof-harness.ts",
  skipNegativeProofEnv: "GRASSEYE_SKIP_MAP_PLUGIN_NEGATIVE_PROOF",
}).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});