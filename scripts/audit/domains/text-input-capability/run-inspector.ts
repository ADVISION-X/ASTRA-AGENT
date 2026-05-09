import { runOwnerInspector } from "../../core/owner-audit-runner.js";

void runOwnerInspector({
  capabilityDomain: "text-input-capability",
  inspectorEntry: "scripts/audit/domains/text-input-capability/inspector.ts",
  negativeProofScript: "scripts/audit/domains/text-input-capability/negative-proof-harness.ts",
  skipNegativeProofEnv: "GRASSEYE_SKIP_TEXT_INPUT_NEGATIVE_PROOF",
}).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});