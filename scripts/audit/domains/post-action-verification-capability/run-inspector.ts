import { runOwnerInspector } from "../../core/owner-audit-runner.js";

void runOwnerInspector({
  capabilityDomain: "post-action-verification-capability",
  inspectorEntry: "scripts/audit/domains/post-action-verification-capability/inspector.ts",
  negativeProofScript: "scripts/audit/domains/post-action-verification-capability/negative-proof-harness.ts",
  skipNegativeProofEnv: "GRASSEYE_SKIP_POST_ACTION_NEGATIVE_PROOF",
}).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
