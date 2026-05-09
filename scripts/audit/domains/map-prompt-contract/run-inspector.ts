import { runOwnerInspector } from "../../core/owner-audit-runner.js";

void runOwnerInspector({
  capabilityDomain: "map-prompt-contract",
  inspectorEntry: "scripts/audit/domains/map-prompt-contract/inspector.ts",
  negativeProofScript: "scripts/audit/domains/map-prompt-contract/negative-proof-harness.ts",
  skipNegativeProofEnv: "GRASSEYE_SKIP_MAP_PROMPT_CONTRACT_NEGATIVE_PROOF",
}).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});