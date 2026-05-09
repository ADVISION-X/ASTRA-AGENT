import { runOwnerInspector } from "../../core/owner-audit-runner.js";

void runOwnerInspector({
  capabilityDomain: "security-privacy",
  inspectorEntry: "scripts/audit/domains/security-privacy/inspector.ts",
  negativeProofScript: "scripts/audit/domains/security-privacy/negative-proof-harness.ts",
  skipNegativeProofEnv: "GRASSEYE_SKIP_SECURITY_PRIVACY_NEGATIVE_PROOF",
}).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});