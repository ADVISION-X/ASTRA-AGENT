import { runOwnerInspector } from "../../core/owner-audit-runner.js";

void runOwnerInspector({
  capabilityDomain: "ai-capability",
  inspectorEntry: "scripts/audit/domains/ai-capability/inspector.ts",
  negativeProofScript: "scripts/audit/domains/ai-capability/run-negative-proof.ts",
  skipNegativeProofEnv: "GRASSEYE_SKIP_AI_NEGATIVE_PROOF",
}).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
