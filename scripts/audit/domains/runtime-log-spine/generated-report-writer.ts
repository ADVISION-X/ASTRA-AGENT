import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import type { InspectorFinding } from "../../shared/inspector-contracts.js";
import { generatedDir } from "../../shared/paths.js";
import {
  RUNTIME_LOG_GENERATED_JSON,
  RUNTIME_LOG_GENERATED_MD,
  type RuntimeLogSpineFinding,
  type RuntimeLogSpinePhase,
} from "./constants.js";

export type RuntimeLogSpineReport = {
  generatedAt: string;
  status: "PASS" | "FAIL";
  summary: {
    totalFindings: number;
    fatalFindings: number;
    scannedFiles: number;
    emitCallCount: number;
    consoleViolationCount: number;
    failureWithoutClassCount: number;
    stageCoveragePercent: number;
  };
  phases: RuntimeLogSpinePhase[];
  findings: RuntimeLogSpineFinding[];
};

export const toInspectorFinding = (finding: RuntimeLogSpineFinding): InspectorFinding => ({
  checkId: finding.checkId,
  lawId: finding.lawId,
  clauseId: "primary",
  message: finding.message,
  line: finding.line,
  severity: finding.severity,
  hint: finding.hint,
  filePath: finding.file,
});

const escapeCell = (value: string): string => value.replace(/\|/gu, "\\|").replace(/\n/gu, " ");

const renderMarkdown = (report: RuntimeLogSpineReport): string => [
  "# Runtime Log Spine Quality Report",
  "",
  `Status: ${report.status}`,
  "",
  "## Summary",
  "",
  `- Total findings: ${report.summary.totalFindings}`,
  `- Fatal findings: ${report.summary.fatalFindings}`,
  `- Scanned files: ${report.summary.scannedFiles}`,
  `- Emit calls: ${report.summary.emitCallCount}`,
  `- Console violations: ${report.summary.consoleViolationCount}`,
  `- Failure events without class: ${report.summary.failureWithoutClassCount}`,
  `- Stage coverage: ${report.summary.stageCoveragePercent}%`,
  "",
  "## Phases",
  "",
  "| Phase | Status | Findings |",
  "|---|---:|---:|",
  ...report.phases.map((phase) => `| ${escapeCell(phase.name)} | ${phase.status} | ${phase.findingCount} |`),
  "",
  "## Fatal Findings",
  "",
  report.findings.length === 0
    ? "No fatal findings."
    : [
      "| Law | File | Line | Message | Hint |",
      "|---|---|---:|---|---|",
      ...report.findings.map((finding) =>
        `| ${finding.lawId} | ${escapeCell(finding.file)} | ${finding.line} | ${escapeCell(finding.message)} | ${escapeCell(finding.hint)} |`,
      ),
    ].join("\n"),
  "",
  "## Coverage",
  "",
  "Coverage is computed from AST/text contract checks for console policy, event registry usage, emit trace contracts, mode visibility, stage pairs, catch branches, failure classes, redaction, debug bundles, AI contracts, and browser action contracts.",
  "",
].join("\n");

export const writeRuntimeLogSpineReport = (report: RuntimeLogSpineReport): void => {
  mkdirSync(generatedDir, { recursive: true });
  writeFileSync(resolve(generatedDir, "runtime-log-spine-report.generated.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(resolve(generatedDir, "runtime-log-spine-report.generated.md"), renderMarkdown(report), "utf8");
};

export const runtimeReportPaths = [RUNTIME_LOG_GENERATED_JSON, RUNTIME_LOG_GENERATED_MD] as const;
