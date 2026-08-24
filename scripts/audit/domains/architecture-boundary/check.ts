import { pathToFileURL } from "node:url";

import { runRestoredDomain } from "../../shared/restored-domain-runner.js";
import { inspectDomain as inspectArchitecture } from "./inspector.js";
import { inspectDomain as inspectConstitution } from "./constitutional-boundary-inspector.js";

export async function runArchitectureBoundaryCheck(root = process.cwd()): Promise<void> {
  const findings = [
    ...await runRestoredDomain("architecture-boundary", inspectArchitecture, root),
    ...await runRestoredDomain("architecture-boundary", inspectConstitution, root),
  ];
  if (findings.length > 0) {
    findings.forEach((item) => process.stderr.write(`${item.checkId} ${item.filePath ?? "unknown"} ${item.message}\n`));
    process.stderr.write(`ARCHITECTURE_BOUNDARY_FINDINGS ${findings.length}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write("ARCHITECTURE_BOUNDARY_ENFORCEMENT_PASS\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runArchitectureBoundaryCheck();
