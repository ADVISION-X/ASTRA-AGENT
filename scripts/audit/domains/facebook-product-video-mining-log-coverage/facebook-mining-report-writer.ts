import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import type { InspectorFinding } from "../../shared/inspector-contracts.js";
import { generatedDir } from "../../shared/paths.js";
import type { FacebookMiningStageContract } from "./facebook-mining-stage-matrix.js";
import type { FacebookLogCoverageFinding, FacebookLogCoverageSection } from "./constants.js";

export type FacebookLogCoverageReport = {
  generatedAt: string;
  status: "PASS" | "FAIL";
  summary: {
    totalFindings: number;
    fatalFindings: number;
    mandatoryStageCount: number;
    coveredStageCount: number;
    stageCoveragePercent: number;
  };
  sections: FacebookLogCoverageSection[];
  stageCoverage: Array<{
    stageName: string;
    ownerFiles: string[];
    hasStartedLog: boolean;
    hasTerminalLog: boolean;
    missingFields: string[];
  }>;
  failureCoverage: FacebookLogCoverageFinding[];
  aiCoverage: FacebookLogCoverageFinding[];
  navigationCoverage: FacebookLogCoverageFinding[];
  recoveryCoverage: FacebookLogCoverageFinding[];
  artifactCoverage: FacebookLogCoverageFinding[];
  missingMandatoryStages: FacebookMiningStageContract[];
  findings: FacebookLogCoverageFinding[];
};

export const toInspectorFinding = (finding: FacebookLogCoverageFinding): InspectorFinding => ({
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

const renderFindingsTable = (findings: readonly FacebookLogCoverageFinding[]): string =>
  findings.length === 0
    ? "No fatal findings."
    : [
      "| Law | File | Line | Message | Hint |",
      "|---|---|---:|---|---|",
      ...findings.map((finding) =>
        `| ${finding.lawId} | ${escapeCell(finding.file)} | ${finding.line} | ${escapeCell(finding.message)} | ${escapeCell(finding.hint)} |`,
      ),
    ].join("\n");

const renderSummarySection = (report: FacebookLogCoverageReport): string[] => [
  "## Summary",
  "",
  `- Total findings: ${report.summary.totalFindings}`,
  `- Fatal findings: ${report.summary.fatalFindings}`,
  `- Mandatory stages: ${report.summary.mandatoryStageCount}`,
  `- Covered stages: ${report.summary.coveredStageCount}`,
  `- Stage coverage: ${report.summary.stageCoveragePercent}%`,
  "",
];

const renderStageCoverageSection = (report: FacebookLogCoverageReport): string[] => [
  "## Stage Coverage",
  "",
  "| Stage | Started | Terminal | Missing Fields | Owners |",
  "|---|---:|---:|---|---|",
  ...report.stageCoverage.map((stage) =>
    `| ${stage.stageName} | ${stage.hasStartedLog ? "yes" : "no"} | ${stage.hasTerminalLog ? "yes" : "no"} | ${escapeCell(stage.missingFields.join(", ") || "none")} | ${escapeCell(stage.ownerFiles.join(", "))} |`,
  ),
  "",
];

const renderFindingsSection = (
  title: string,
  findings: readonly FacebookLogCoverageFinding[],
): string[] => [
  `## ${title}`,
  "",
  renderFindingsTable(findings),
  "",
];

export const renderFacebookLogCoverageMarkdown = (report: FacebookLogCoverageReport): string => [
  "# Facebook Product Video Mining Log Coverage Report",
  "",
  `Status: ${report.status}`,
  "",
  ...renderSummarySection(report),
  ...renderStageCoverageSection(report),
  ...renderFindingsSection("Failure Coverage", report.failureCoverage),
  ...renderFindingsSection("AI Coverage", report.aiCoverage),
  ...renderFindingsSection("Navigation Coverage", report.navigationCoverage),
  ...renderFindingsSection("Recovery Coverage", report.recoveryCoverage),
  ...renderFindingsSection("Artifact Coverage", report.artifactCoverage),
  ...renderFindingsSection("Fatal Findings", report.findings),
].join("\n");

export const writeFacebookLogCoverageReport = (report: FacebookLogCoverageReport): void => {
  mkdirSync(generatedDir, { recursive: true });
  writeFileSync(
    resolve(generatedDir, "facebook-product-video-mining-log-coverage-report.generated.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    resolve(generatedDir, "facebook-product-video-mining-log-coverage-report.generated.md"),
    renderFacebookLogCoverageMarkdown(report),
    "utf8",
  );
};
