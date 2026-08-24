import { pathToFileURL } from "node:url";

import { inspectCodePurity } from "./inspector.js";

export function runCodePurityCheck(root = process.cwd()): void {
  const findings = inspectCodePurity(root);
  if (findings.length > 0) {
    for (const item of findings) process.stderr.write(`${item.code} ${item.path}:${item.line} ${item.symbol ? `${item.symbol} ` : ""}${item.detail}\n`);
    process.stderr.write(`CODE_PURITY_FINDINGS ${findings.length}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write("CODE_PURITY_ENFORCEMENT_PASS\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runCodePurityCheck();
