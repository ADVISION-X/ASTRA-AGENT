import { runOwnerInspector } from "../../core/owner-audit-runner.js";

void runOwnerInspector({
  capabilityDomain: "map-prompt-contract",
  inspectorEntry: "scripts/audit/domains/map-prompt-contract/inspector.ts",
}).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});