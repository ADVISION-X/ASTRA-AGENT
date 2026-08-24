import { pathToFileURL } from "node:url";

import { runRestoredDomain } from "../../shared/restored-domain-runner.js";
import { inspectAuditSystem, inspectDomain } from "./inspector.js";

export async function runAuditSystemCheck(root = process.cwd()): Promise<void> {
  const findings = process.env.GOVERNANCE_BINDING_ID
    ? await runRestoredDomain("audit-system", inspectDomain, root)
    : inspectAuditSystem(root).map((item) => ({ checkId: item.code, filePath: item.path, message: item.detail }));
  if (findings.length > 0) {
    findings.forEach((item) => process.stderr.write(`${item.checkId} ${item.filePath ?? "unknown"} ${item.message}\n`));
    process.stderr.write(`AUDIT_SYSTEM_FINDINGS ${findings.length}\n`); process.exitCode = 1; return;
  }
  process.stdout.write("AUDIT_SYSTEM_ENFORCEMENT_PASS\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runAuditSystemCheck();
