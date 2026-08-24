import { pathToFileURL } from "node:url";

import { runRestoredDomain } from "../../shared/restored-domain-runner.js";
import { inspectDomain } from "./inspector.js";

export async function runAuditTruthCheck(root = process.cwd()): Promise<void> {
  const findings = await runRestoredDomain("audit-truth", inspectDomain, root);
  if (findings.length > 0) {
    findings.forEach((item) => process.stderr.write(`${item.checkId} ${item.filePath ?? "unknown"} ${item.message}\n`));
    process.stderr.write(`AUDIT_TRUTH_FINDINGS ${findings.length}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write("AUDIT_TRUTH_ENFORCEMENT_PASS\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runAuditTruthCheck();
