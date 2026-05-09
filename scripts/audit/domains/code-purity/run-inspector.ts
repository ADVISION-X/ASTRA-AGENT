import { spawn } from "node:child_process";

import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { hasBlockingFindings } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import {
  logCodePurityStageMetrics,
} from "./components/purity-stage-memory.js";
import {
  CODE_PURITY_FINDINGS_NDJSON,
  CODE_PURITY_REPORT_RESULT,
  CODE_PURITY_SCAN_SUMMARY,
} from "./components/purity-stage-paths.js";
import {
  assertFreshStreamArtifact,
  readCodePurityReportResult,
  readScanSummary,
} from "./components/purity-stage-results.js";

const EXPLICIT_BUILD_ENV = "GRASSEYE_CODE_PURITY_BUILD_ARTIFACTS";

const STAGES = [
  { label: "code-purity:scan", script: "scripts/audit/domains/code-purity/run-scan.ts" },
  { label: "code-purity:report", script: "scripts/audit/domains/code-purity/run-report.ts" },
] as const;

const runStage = async (stage: (typeof STAGES)[number]): Promise<void> => {
  process.stdout.write(`[AUDIT] starting ${stage.label}...\n`);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", stage.script], {
      stdio: "inherit",
      env: process.env,
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${stage.label} failed${signal ? ` by ${signal}` : ""} with exit code ${code ?? 1}.`));
    });
  });
};

const maybeBuildArtifacts = async (): Promise<void> => {
  if (process.env[EXPLICIT_BUILD_ENV] !== "1") {
    return;
  }
  process.stdout.write("[AUDIT] GRASSEYE_CODE_PURITY_BUILD_ARTIFACTS=1 set; building audit artifacts explicitly...\n");
  await buildAuditArtifacts();
};

const printFinding = (finding: Finding): void => {
  process.stdout.write(`- ${finding.severity.toUpperCase()} ${finding.lawId} ${finding.file}:${finding.line} ${finding.message}\n`);
};

const main = async (): Promise<void> => {
  await maybeBuildArtifacts();
  logCodePurityStageMetrics("orchestrator:start", 0, 0);
  for (const stage of STAGES) {
    await runStage(stage);
  }

  await assertFreshStreamArtifact(CODE_PURITY_SCAN_SUMMARY);
  await assertFreshStreamArtifact(CODE_PURITY_FINDINGS_NDJSON);
  await assertFreshStreamArtifact(CODE_PURITY_REPORT_RESULT);

  const summary = await readScanSummary();
  const reportResult = await readCodePurityReportResult();
  const findings = [...reportResult.findings];
  const blocking = hasBlockingFindings(findings);

  logCodePurityStageMetrics("orchestrator:done", summary.scannedFileCount, findings.length);
  process.stdout.write(`[${blocking ? "CODE VIOLATION" : "PASS"}] code-purity: ${findings.length} finding(s)\n`);
  for (const finding of findings) {
    printFinding(finding);
  }

  if (blocking) {
    process.exitCode = 1;
  }
};

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
