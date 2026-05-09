import { runOwnerInspector } from "../../core/owner-audit-runner.js";

void runOwnerInspector({
  capabilityDomain: "index",
  inspectorEntry: "scripts/audit/domains/index/inspector.ts",
}).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});