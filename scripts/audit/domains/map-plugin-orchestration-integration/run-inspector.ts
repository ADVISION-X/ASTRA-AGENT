import { runOwnerInspector } from "../../core/owner-audit-runner.js";

void runOwnerInspector({
  capabilityDomain: "map-plugin-orchestration-integration",
  inspectorEntry: "scripts/audit/domains/map-plugin-orchestration-integration/inspector.ts",
  negativeProofScript: "scripts/audit/domains/map-plugin-orchestration-integration/negative-proof-harness.ts",
  skipNegativeProofEnv: "GRASSEYE_SKIP_MAP_PLUGIN_ORCH_INTEGRATION_NEGATIVE_PROOF",
}).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});