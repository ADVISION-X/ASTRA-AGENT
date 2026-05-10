import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { inspectCodePurityLawCoverage } from "./components/inspect-code-purity.js";
import { finalizePurityReport, validatePurityReportArtifacts, writePurityReport } from "./components/purity-report.js";
import type { PurityInventoryItem, PurityReportDraft } from "./components/purity-report-types.js";
import {
  assertCodePurityMemoryBoundary,
  logCodePurityStageMetrics,
} from "./components/purity-stage-memory.js";
import { readCodePurityFindings, readCodePurityInventoryRecords } from "./components/purity-stage-streams.js";
import {
  loadCodePurityLawRegistry,
  readScanSummary,
  writeCodePurityReportResult,
} from "./components/purity-stage-results.js";
import type { CodePurityInventoryRecord } from "./components/purity-stage-types.js";

const selectBucket = (records: CodePurityInventoryRecord[], bucket: CodePurityInventoryRecord["bucket"]): PurityInventoryItem[] =>
  records.filter((record) => record.bucket === bucket).map((record) => record.item);

const createDraftFromInventory = (summary: Awaited<ReturnType<typeof readScanSummary>>, inventory: CodePurityInventoryRecord[]): PurityReportDraft => ({
  touchedBaselineSource: summary.touchedBaselineSource,
  touchedFiles: summary.touchedFiles,
  scanScope: summary.scanScope,
  godFileInventory: selectBucket(inventory, "godFileInventory"),
  disasterFileInventory: selectBucket(inventory, "disasterFileInventory"),
  ownerMixingInventory: selectBucket(inventory, "ownerMixingInventory"),
  oversizedTouchedFileInventory: selectBucket(inventory, "oversizedTouchedFileInventory"),
  functionOverLimitInventory: selectBucket(inventory, "functionOverLimitInventory"),
  classObjectOverLimitInventory: selectBucket(inventory, "classObjectOverLimitInventory"),
  importExportOverLimitInventory: selectBucket(inventory, "importExportOverLimitInventory"),
  remediationQueue: [],
  firstPhysicalSplitPlan: [],
});

const inspectReportOutputs = (report: ReturnType<typeof finalizePurityReport>): Finding[] => {
  return validatePurityReportArtifacts(report).map((issue) => createFinding({
    lawId: issue.lawId,
    file: "scripts/audit/domains/code-purity/components/purity-report.ts",
    line: 1,
    severity: "error",
    message: issue.message,
  }));
};

export const createReportPhase = (findings: Finding[]): InspectorPhase =>
  createPhase(
    "report-aggregation",
    findings.length === 0 ? "PASS" : "CODE VIOLATION",
    findings.length === 0,
    findings.length === 0 ? "Code-purity report is generated from streamed scan artifacts." : "Code-purity report aggregation found blocking issues.",
  );

const main = async (): Promise<void> => {
  const summary = await readScanSummary();
  const scanFindings = await readCodePurityFindings();
  const inventory = await readCodePurityInventoryRecords();
  const lawRegistry = await loadCodePurityLawRegistry();
  const draft = createDraftFromInventory(summary, inventory);
  const report = finalizePurityReport(draft);
  await writePurityReport(report);

  const findings = [
    ...scanFindings,
    ...inspectCodePurityLawCoverage({ lawRegistry }),
    ...inspectReportOutputs(report),
  ];
  await writeCodePurityReportResult({ findings });
  for (const finding of findings.slice(scanFindings.length)) {
    process.stdout.write(`[CODE PURITY REPORT FINDING] ${finding.severity.toUpperCase()} ${finding.lawId} ${finding.file}:${finding.line} ${finding.message}\n`);
  }
  assertCodePurityMemoryBoundary("report", summary.scannedFileCount, findings.length);
  logCodePurityStageMetrics("report:done", summary.scannedFileCount, findings.length);
  if (findings.some((finding) => finding.severity === "fatal")) {
    process.exitCode = 1;
  }
};

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
