import { runOwnerInspector } from "../../core/owner-audit-runner.js";

void runOwnerInspector({
  capabilityDomain: "ai-capability",
  inspectorEntry: "scripts/audit/domains/ai-capability/inspector.ts",
}).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
