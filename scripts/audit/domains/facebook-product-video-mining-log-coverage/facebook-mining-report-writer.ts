import type { InspectorFinding } from "../../shared/inspector-contracts.js";
import { createFinding } from "../../shared/finding-utils.js";
import { escapeMarkdownCell } from "../../shared/no-regex.js";
import type { FacebookMiningStageContract } from "./facebook-mining-stage-matrix.js";
import { FacebookLogCoverageClause, type FacebookLogCoverageFinding, type FacebookLogCoverageSection } from "./constants.js";

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
    startSites: Array<{
      file: string;
      line: number;
      method: string;
    }>;
    terminalSites: Array<{
      file: string;
      line: number;
      method: string;
    }>;
    confidence: "semantic";
  }>;
  failureCoverage: FacebookLogCoverageFinding[];
  aiCoverage: FacebookLogCoverageFinding[];
  navigationCoverage: FacebookLogCoverageFinding[];
  recoveryCoverage: FacebookLogCoverageFinding[];
  artifactCoverage: FacebookLogCoverageFinding[];
  missingMandatoryStages: FacebookMiningStageContract[];
  findings: FacebookLogCoverageFinding[];
};

export const toInspectorFinding = (finding: FacebookLogCoverageFinding): InspectorFinding => createFinding({
  checkId: finding.checkId,
  lawId: finding.lawId,
  clauseId: FacebookLogCoverageClause[finding.lawId],
  message: finding.message,
  line: finding.line,
  severity: finding.severity,
  hint: finding.hint,
  filePath: finding.file,
});

const escapeCell = escapeMarkdownCell;

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
  "| Stage | Started | Terminal | Missing Fields | Confidence | Sites | Owners |",
  "|---|---:|---:|---|---|---|---|",
  ...report.stageCoverage.map((stage) =>
    `| ${stage.stageName} | ${stage.hasStartedLog ? "yes" : "no"} | ${stage.hasTerminalLog ? "yes" : "no"} | ${escapeCell(stage.missingFields.join(", ") || "none")} | ${stage.confidence} | ${escapeCell(`start:${stage.startSites.length} terminal:${stage.terminalSites.length}`)} | ${escapeCell(stage.ownerFiles.join(", "))} |`,
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
