import { pathToFileURL } from "node:url";

import { runRestoredDomain } from "../../shared/restored-domain-runner.js";
import { inspectDomain } from "./inspector.js";

export async function runWorkbenchApiBoundaryCheck(root = process.cwd()): Promise<void> {
  const findings = await runRestoredDomain("workbench-api-boundary", inspectDomain, root);
  if (findings.length > 0) {
    findings.forEach((item) => process.stderr.write(`${item.checkId} ${item.filePath ?? "unknown"} ${item.message}\n`));
    process.stderr.write("WORKBENCH_API_BOUNDARY_FINDINGS " + findings.length + "\n");
    process.exitCode = 1;
    return;
  }
  process.stdout.write("WORKBENCH_API_BOUNDARY_ENFORCEMENT_PASS\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runWorkbenchApiBoundaryCheck();
