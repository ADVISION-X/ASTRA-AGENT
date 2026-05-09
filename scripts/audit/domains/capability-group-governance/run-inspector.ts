import { runOwnerInspector } from "../../core/owner-audit-runner.js";

void runOwnerInspector({
  capabilityDomain: "capability-group-governance",
  inspectorEntry: "scripts/audit/domains/capability-group-governance/inspector.ts",
  negativeProofScript: "scripts/audit/domains/capability-group-governance/negative-proof-harness.ts",
  skipNegativeProofEnv: "GRASSEYE_SKIP_CAPABILITY_GROUP_GOVERNANCE_NEGATIVE_PROOF",
}).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
