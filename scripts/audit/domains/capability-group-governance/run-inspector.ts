import { runOwnerInspector } from "../../core/owner-audit-runner.js";

void runOwnerInspector({
  capabilityDomain: "capability-group-governance",
  inspectorEntry: "scripts/audit/domains/capability-group-governance/inspector.ts",
}).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
