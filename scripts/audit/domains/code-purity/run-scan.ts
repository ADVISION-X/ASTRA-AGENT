import { Project, type SourceFile } from "ts-morph";

import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { collectTouchedFilesArtifact } from "../../core/touched-files-collector.js";
import type { Finding } from "../../core/schema.js";
import { getActiveCodePurityRelativePaths } from "./components/inspect-code-purity.js";
import { createEmptyPurityReport, inspectPurityMetrics } from "./components/purity-metric-inspection.js";
import { CODE_PURITY_SCAN_SCOPE } from "./components/purity-runtime-constants.js";
import {
  assertCodePurityMemoryBoundary,
  logCodePurityStageMetrics,
} from "./components/purity-stage-memory.js";
import { appendCodePurityFinding, appendCodePurityInventory, resetCodePurityStreamArtifacts } from "./components/purity-stage-streams.js";
import { writeScanSummary } from "./components/purity-stage-results.js";
import { runSupplementalScans } from "./run-scan-supplemental.js";

const INVENTORY_BUCKETS = [
  "godFileInventory",
  "disasterFileInventory",
  "ownerMixingInventory",
  "oversizedTouchedFileInventory",
  "functionOverLimitInventory",
  "classObjectOverLimitInventory",
  "importExportOverLimitInventory",
] as const;

const createScanProject = (): Project =>
  new Project({
    tsConfigFilePath: pathFromRepoRoot("tsconfig.json"),
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      allowJs: true,
    },
  });

const collectInventoryItems = (draft: ReturnType<typeof createEmptyPurityReport>) => {
  const records = [];
  for (const bucket of INVENTORY_BUCKETS) {
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

const scanSourceFile = async (
  project: Project,
  relativePath: string,
  touchedPaths: Set<string>,
): Promise<number | null> => {
  const sourceFile = project.addSourceFileAtPathIfExists(pathFromRepoRoot(relativePath));
  if (!sourceFile) {
    return null;
  }
  const fileDraft = createEmptyPurityReport();
  const findings = inspectPurityMetrics(sourceFile, toRepoRelativePath(sourceFile.getFilePath()), touchedPaths, fileDraft);
  await appendFindings(findings);
  await appendInventory(collectInventoryItems(fileDraft));
  sourceFile.forget();
  return findings.length;
};

const scanSourceFiles = async (
  project: Project,
  relativePaths: string[],
  touchedPaths: Set<string>,
): Promise<{ scannedFileCount: number; findingsCount: number }> => {
  let scannedFileCount = 0;
  let findingsCount = 0;
  logCodePurityStageMetrics("scan:start", scannedFileCount, findingsCount);
  for (const relativePath of relativePaths) {
    const findingCount = await scanSourceFile(project, relativePath, touchedPaths);
    if (findingCount === null) {
      continue;
    }
    scannedFileCount += 1;
    findingsCount += findingCount;
    if (scannedFileCount % 25 === 0) {
      assertCodePurityMemoryBoundary("scan", scannedFileCount, findingsCount);
      logCodePurityStageMetrics("scan:progress", scannedFileCount, findingsCount);
    }
  }
  return { scannedFileCount, findingsCount };
};

const collectSourceFileMap = (project: Project, relativePaths: string[]): Map<string, SourceFile> => {
  const sourceFilesByPath = new Map<string, SourceFile>();
  for (const relativePath of relativePaths) {
    const sourceFile = project.addSourceFileAtPathIfExists(pathFromRepoRoot(relativePath));
    if (sourceFile) {
      sourceFilesByPath.set(relativePath, sourceFile);
    }
  }
  return sourceFilesByPath;
};

const createSupplementalSourceFileMap = (relativePaths: string[]): Map<string, SourceFile> => {
  const supplementalProject = createScanProject();
  return collectSourceFileMap(supplementalProject, relativePaths);
};

const appendSupplementalFindings = async (project: Project, relativePaths: string[]): Promise<number> => {
  const sourceFilesByPath = createSupplementalSourceFileMap(relativePaths);
  const findings = await runSupplementalScans(process.cwd(), relativePaths, sourceFilesByPath);
  await appendFindings(findings);
  return findings.length;
};

const main = async (): Promise<void> => {
  await resetCodePurityStreamArtifacts();
  const touchedSnapshot = await collectTouchedFilesArtifact();
  const touchedPaths = new Set(touchedSnapshot.touchedFiles);
  const relativePaths = await getActiveCodePurityRelativePaths();
  const project = createScanProject();
  const { scannedFileCount, findingsCount: sourceFindingsCount } = await scanSourceFiles(project, relativePaths, touchedPaths);
  const findingsCount = sourceFindingsCount + await appendSupplementalFindings(project, relativePaths);

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
