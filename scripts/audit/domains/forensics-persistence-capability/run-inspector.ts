import { runOwnerInspector } from "../../core/owner-audit-runner.js";

void runOwnerInspector({
  capabilityDomain: "forensics-persistence-capability",
  inspectorEntry: "scripts/audit/domains/forensics-persistence-capability/inspector.ts",
  negativeProofScript: "scripts/audit/domains/forensics-persistence-capability/run-negative-proof.ts",
  skipNegativeProofEnv: "GRASSEYE_SKIP_FORENSICS_NEGATIVE_PROOF",
}).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
