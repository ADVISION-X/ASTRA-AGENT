import { pathToFileURL } from "node:url";

import { runRestoredDomain } from "../../shared/restored-domain-runner.js";
import { inspectDomain } from "./inspector.js";

export async function runAiInputGatewayCheck(root = process.cwd()): Promise<void> {
  const findings = await runRestoredDomain("ai-input-gateway", inspectDomain, root);
  if (findings.length > 0) {
    findings.forEach((item) => process.stderr.write(`${item.checkId} ${item.filePath ?? "unknown"} ${item.message}\n`));
    process.stderr.write("AI_INPUT_GATEWAY_FINDINGS " + findings.length + "\n");
    process.exitCode = 1;
    return;
  }
  process.stdout.write("AI_INPUT_GATEWAY_ENFORCEMENT_PASS\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runAiInputGatewayCheck();
