import { Project, type SourceFile } from "ts-morph";

import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { collectTouchedFilesArtifact } from "../../core/touched-files-collector.js";
import type { Finding } from "../../core/schema.js";
import { getActiveCodePurityRelativePaths } from "./components/inspect-code-purity.js";
import { createEmptyPurityReport, inspectPurityMetrics } from "./components/purity-metric-inspection.js";
import { CODE_PURITY_SCAN_SCOPE } from "./components/purity-runtime-constants.js";
import type { PurityReportDraft } from "./components/purity-report-types.js";
import {
  assertCodePurityMemoryBoundary,
  logCodePurityStageMetrics,
} from "./components/purity-stage-memory.js";
import { appendCodePurityFinding, appendCodePurityInventory, resetCodePurityStreamArtifacts } from "./components/purity-stage-streams.js";
import { writeScanSummary } from "./components/purity-stage-results.js";
import type { CodePurityInventoryRecord } from "./components/purity-stage-types.js";
import { inspectRetiredMapSystem } from "./components/scan-retired-map-system.js";
import { inspectVisualStoryCoherence } from "./components/scan-visual-story-coherence.js";
import { inspectZombieScan } from "./components/zombie-scan/index.js";

const createScanProject = (): Project =>
  new Project({
    tsConfigFilePath: pathFromRepoRoot("tsconfig.json"),
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      allowJs: true,
    },
  });

const collectInventoryItems = (draft: PurityReportDraft): CodePurityInventoryRecord[] => {
  const records: CodePurityInventoryRecord[] = [];
  const buckets = [
    "godFileInventory",
    "disasterFileInventory",
    "ownerMixingInventory",
    "oversizedTouchedFileInventory",
    "functionOverLimitInventory",
    "classObjectOverLimitInventory",
    "importExportOverLimitInventory",
  ] as const;
  for (const bucket of buckets) {
    for (const item of draft[bucket]) {
      records.push({ bucket, item });
    }
  }
  return records;
};

const appendFindings = async (findings: Finding[]): Promise<void> => {
  for (const finding of findings) {
    await appendCodePurityFinding(finding);
  }
};

const appendInventory = async (items: CodePurityInventoryRecord[]): Promise<void> => {
  for (const item of items) {
    await appendCodePurityInventory(item);
  }
};

const main = async (): Promise<void> => {
  await resetCodePurityStreamArtifacts();
  const touchedSnapshot = await collectTouchedFilesArtifact();
  const touchedPaths = new Set(touchedSnapshot.touchedFiles);
  const relativePaths = await getActiveCodePurityRelativePaths();
  const project = createScanProject();
  let scannedFileCount = 0;
  let findingsCount = 0;

  logCodePurityStageMetrics("scan:start", scannedFileCount, findingsCount);
  for (const relativePath of relativePaths) {
    const sourceFile = project.addSourceFileAtPathIfExists(pathFromRepoRoot(relativePath));
    if (!sourceFile) {
      continue;
    }

    const fileDraft = createEmptyPurityReport();
    const findings = inspectPurityMetrics(sourceFile, toRepoRelativePath(sourceFile.getFilePath()), touchedPaths, fileDraft);
    await appendFindings(findings);
    await appendInventory(collectInventoryItems(fileDraft));
    findingsCount += findings.length;
    scannedFileCount += 1;
    sourceFile.forget();

    if (scannedFileCount % 25 === 0) {
      assertCodePurityMemoryBoundary("scan", scannedFileCount, findingsCount);
      logCodePurityStageMetrics("scan:progress", scannedFileCount, findingsCount);
    }
  }

  const sourceFilesByPath = new Map<string, SourceFile>();
  for (const relativePath of relativePaths) {
    const sourceFile = project.addSourceFileAtPathIfExists(pathFromRepoRoot(relativePath));
    if (sourceFile) {
      sourceFilesByPath.set(relativePath, sourceFile);
    }
  }

  const retiredMapFindings = await inspectRetiredMapSystem(relativePaths, sourceFilesByPath);
  await appendFindings(retiredMapFindings);
  findingsCount += retiredMapFindings.length;

  const visualStoryFindings = await inspectVisualStoryCoherence(relativePaths, sourceFilesByPath);
  await appendFindings(visualStoryFindings);
  findingsCount += visualStoryFindings.length;

  const zombieFindings = await inspectZombieScan(process.cwd(), relativePaths);
  await appendFindings(zombieFindings);
  findingsCount += zombieFindings.length;

  await writeScanSummary({
    generatedAt: new Date().toISOString(),
    touchedBaselineSource: touchedSnapshot.touchedBaselineSource,
    touchedFiles: [...touchedPaths].sort((left, right) => left.localeCompare(right)),
    scanScope: [...CODE_PURITY_SCAN_SCOPE],
    scannedFileCount,
    findingsCount,
  });
  assertCodePurityMemoryBoundary("scan", scannedFileCount, findingsCount);
  logCodePurityStageMetrics("scan:done", scannedFileCount, findingsCount);
};

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
