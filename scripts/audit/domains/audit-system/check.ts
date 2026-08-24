import { pathToFileURL } from "node:url";

import { runRestoredDomain } from "../../shared/restored-domain-runner.js";
import { inspectDomain as inspectAuditTruth } from "../audit-truth/inspector.js";
import { inspectAuditSystem } from "./inspector.js";

export async function runAuditSystemCheck(root = process.cwd()): Promise<void> {
  const findings = [
    ...inspectAuditSystem(root).map((item) => ({ checkId: item.code, filePath: item.path, message: item.detail })),
    ...(await runRestoredDomain("audit-system", inspectAuditTruth, root))
      .map((item) => ({ checkId: item.checkId, filePath: item.filePath, message: item.message })),
  ];
  if (findings.length > 0) {
    findings.forEach((item) => process.stderr.write(`${item.checkId} ${item.filePath ?? "unknown"} ${item.message}\n`));
    process.stderr.write(`AUDIT_SYSTEM_FINDINGS ${findings.length}\n`); process.exitCode = 1; return;
  }
  process.stdout.write("AUDIT_SYSTEM_ENFORCEMENT_PASS\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runAuditSystemCheck();
