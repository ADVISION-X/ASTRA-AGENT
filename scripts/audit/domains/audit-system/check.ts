import { pathToFileURL } from "node:url";

import { inspectAuditSystem } from "./inspector.js";

export function runAuditSystemCheck(root = process.cwd()): void {
  const findings = inspectAuditSystem(root);
  if (findings.length > 0) {
    for (const item of findings) process.stderr.write(`${item.code} ${item.path} ${item.detail}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write("AUDIT_SYSTEM_ENFORCEMENT_PASS\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runAuditSystemCheck();
