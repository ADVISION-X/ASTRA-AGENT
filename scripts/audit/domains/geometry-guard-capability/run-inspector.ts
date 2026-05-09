import { runOwnerInspector } from "../../core/owner-audit-runner.js";

void runOwnerInspector({
  capabilityDomain: "geometry-guard-capability",
  inspectorEntry: "scripts/audit/domains/geometry-guard-capability/inspector.ts",
  negativeProofScript: "scripts/audit/domains/geometry-guard-capability/negative-proof-harness.ts",
  skipNegativeProofEnv: "GRASSEYE_SKIP_GEOMETRY_GUARD_NEGATIVE_PROOF",
}).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});