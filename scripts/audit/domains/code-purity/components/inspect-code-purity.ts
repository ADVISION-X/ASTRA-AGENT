import { Node, Project, type SourceFile } from "ts-morph";

import { fileExists, listFilesRecursive } from "../../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../../core/paths.js";
import { createFinding, createPhase } from "../../../core/result.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";
import { collectTouchedFilesArtifact } from "../../../core/touched-files-collector.js";
import { CODE_PURITY_LAW_IDS, LAW_PHASE_SUMMARIES } from "./purity-law-phase-data.js";
import { ACTIVE_FILES, ACTIVE_ROOTS, BLUEPRINT_PATH, CODE_PURITY_SCAN_EXTENSIONS, CODE_PURITY_SCAN_SCOPE } from "./purity-runtime-constants.js";
import { createEmptyPurityReport, inspectPurityMetrics } from "./purity-metric-inspection.js";
import { finalizePurityReport, writePurityReport } from "./purity-report.js";
import { inspectRetiredMapSystem } from "./scan-retired-map-system.js";
import { inspectVisualStoryCoherence } from "./scan-visual-story-coherence.js";
import { inspectZombieScan } from "./zombie-scan/index.js";

const REQUIRED_COMPONENT_EXPORTS = [
  {
    relativePath: "scripts/audit/domains/code-purity/components/inspect-source-file.ts",
    exportName: "inspectSourceFile",
    lawId: "GRASSEYE-CODE-PURITY-011-V1",
    message: "Required code-purity component export inspectSourceFile is missing.",
  },
] as const;

const EXCLUDED_SOURCE_PREFIXES = ["scripts/audit/generated/"] as const;
const EXCLUDED_SOURCE_SUFFIXES = [".generated.json", ".generated.jsonc"] as const;

const debug = (message: string): void => {
  if (process.env.GRASSEYE_AUDIT_DEBUG === "1") {
    process.stdout.write(`[code-purity-owner] ${message}\n`);
  }
};

const isExcludedSourcePath = (relativePath: string): boolean =>
  EXCLUDED_SOURCE_PREFIXES.some((prefix) => relativePath.startsWith(prefix))
  || EXCLUDED_SOURCE_SUFFIXES.some((suffix) => relativePath.endsWith(suffix));

const createPurityProject = (): Project =>
  new Project({
    tsConfigFilePath: pathFromRepoRoot("tsconfig.json"),
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      allowJs: true,
    },
  });

const filterActiveRelativePaths = (relativePaths: string[]): string[] =>
  relativePaths
    .filter((relativePath) => ACTIVE_ROOTS.some((root) => relativePath === root || relativePath.startsWith(`${root}/`)))
    .filter((relativePath) => !isExcludedSourcePath(relativePath))
    .sort((left, right) => left.localeCompare(right));

export const getActiveCodePurityRelativePaths = async (): Promise<string[]> => {
  const discovered = new Set<string>(ACTIVE_FILES);

  for (const root of ACTIVE_ROOTS) {
    const absoluteRoot = pathFromRepoRoot(root);
    if (!(await fileExists(absoluteRoot))) {
      continue;
    }

    const files = await listFilesRecursive(absoluteRoot, { extensions: [...CODE_PURITY_SCAN_EXTENSIONS] });
    for (const file of files) {
      discovered.add(toRepoRelativePath(file));
    }
  }

  return filterActiveRelativePaths([...discovered]);
};

const createPhaseForLaw = (lawId: string, findings: Finding[]): InspectorPhase => {
  const summary = LAW_PHASE_SUMMARIES.find((candidate) => candidate.lawId === lawId);
  const hasLawFindings = findings.some((finding) => finding.lawId === lawId);
  if (!summary) {
    return createPhase(`missing-${lawId.toLowerCase()}`, "FAKE ENFORCEMENT", false, `Missing phase summary for ${lawId}.`);
  }
  return createPhase(summary.name, hasLawFindings ? "CODE VIOLATION" : "PASS", !hasLawFindings, hasLawFindings ? summary.failedSummary : summary.okSummary);
};

const collectSourceFiles = async (): Promise<{
  relativePaths: string[];
  touchedPaths: Set<string>;
  touchedBaselineSource: string;
  project: Project;
}> => {
  const touchedSnapshot = await collectTouchedFilesArtifact();
  const relativePaths = await getActiveCodePurityRelativePaths();
  const touchedPaths = new Set(filterActiveRelativePaths(touchedSnapshot.touchedFiles));
  debug(`activeRoots=${ACTIVE_ROOTS.join(",")}`);
  debug(`scannedCandidates=${relativePaths.length}`);
  const project = createPurityProject();
  return { relativePaths, touchedPaths, touchedBaselineSource: touchedSnapshot.touchedBaselineSource, project };
};

const inspectSourceFiles = (sourceFiles: SourceFile[], touchedPaths: Set<string>, reportDraft: ReturnType<typeof createEmptyPurityReport>): Finding[] =>
  sourceFiles.flatMap((sourceFile) => inspectPurityMetrics(sourceFile, toRepoRelativePath(sourceFile.getFilePath()), touchedPaths, reportDraft));

const inspectSourcePaths = (project: Project, relativePaths: string[], touchedPaths: Set<string>, reportDraft: ReturnType<typeof createEmptyPurityReport>): Finding[] => {
  const findings: Finding[] = [];
  for (const relativePath of relativePaths) {
    const sourceFile = project.addSourceFileAtPathIfExists(pathFromRepoRoot(relativePath));
    if (!sourceFile) {
      continue;
    }

    findings.push(...inspectSourceFiles([sourceFile], touchedPaths, reportDraft));
    sourceFile.forget();
  }
  return findings;
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

const hasNamedExportSyntax = (sourceFile: SourceFile, exportName: string): boolean => {
  if (sourceFile.getFunctions().some((statement) => statement.getName() === exportName && statement.hasExportKeyword())) {
    return true;
  }

  if (
    sourceFile.getVariableStatements().some((statement) =>
      statement.hasExportKeyword() && statement.getDeclarations().some((declaration) => declaration.getName() === exportName),
    )
  ) {
    return true;
  }

  return sourceFile.getExportDeclarations().some((declaration) =>
    declaration.getNamedExports().some((namedExport) => namedExport.getName() === exportName)
    || declaration.getNamedExports().some((namedExport) => namedExport.getAliasNode()?.getText() === exportName),
  ) || sourceFile.getStatements().some((statement) =>
    Node.isClassDeclaration(statement) && statement.getName() === exportName && statement.hasExportKeyword(),
  );
};

const inspectRequiredComponentExports = (project: Project): Finding[] =>
  REQUIRED_COMPONENT_EXPORTS.flatMap((requirement) => {
    const sourceFile = project.addSourceFileAtPathIfExists(pathFromRepoRoot(requirement.relativePath));
    const hasRequiredExport = sourceFile ? hasNamedExportSyntax(sourceFile, requirement.exportName) : false;
    sourceFile?.forget();
    return hasRequiredExport
      ? []
      : [createFinding({
        lawId: requirement.lawId,
        file: requirement.relativePath,
        line: 1,
        severity: "error",
        message: requirement.message,
      })];
  });

export const inspectCodePurityLawCoverage = (context: Pick<InspectorContext, "lawRegistry">): Finding[] => {
  const expectedLawIds = context.lawRegistry.laws
    .filter((law) => law.relativeFilePath === ".github/instructions/cursor-rules/modules/module-code-purity.instructions.md")
    .map((law) => law.lawId);
  const missingCoverage = expectedLawIds.filter((lawId) => !CODE_PURITY_LAW_IDS.includes(lawId as (typeof CODE_PURITY_LAW_IDS)[number]) || !LAW_PHASE_SUMMARIES.some((summary) => summary.lawId === lawId));
  return missingCoverage.map((lawId) =>
    createFinding({
      lawId: "GRASSEYE-CODE-PURITY-011-V1",
      file: "scripts/audit/domains/code-purity/components/purity-constants.ts",
      line: 1,
      severity: "error",
      message: `Active code-purity law ${lawId} has no inspector phase coverage.`,
    }),
  );
};

const inspectReportOutputs = async (reportDraft: ReturnType<typeof createEmptyPurityReport>): Promise<Finding[]> => {
  const report = finalizePurityReport(reportDraft);
  await writePurityReport(report);
  if (report.scanScope.length === 0) {
    return [createFinding({
      lawId: "GRASSEYE-CODE-PURITY-011-V1",
      file: "scripts/audit/domains/code-purity/components/purity-report.ts",
      line: 1,
      severity: "error",
      message: "Code-purity report did not record its scan scope.",
    })];
  }
  if (report.touchedBaselineSource === "none") {
    return [createFinding({
      lawId: "GRASSEYE-CODE-PURITY-002-V1",
      file: "scripts/audit/domains/code-purity/components/purity-report.ts",
      line: 1,
      severity: "error",
      message: "Code-purity could not establish a touched-file baseline source.",
    })];
  }
  if (report.remediationQueue.length > 0 && report.firstPhysicalSplitPlan.length > 0) {
    return [];
  }
  return [createFinding({
    lawId: "GRASSEYE-CODE-PURITY-013-V1",
    file: "scripts/audit/domains/code-purity/components/purity-report.ts",
    line: 1,
    severity: "error",
    message: "Code-purity report did not produce the required remediation queue and first physical split plan.",
  })];
};

const createInspectorPhases = (sourceFileCount: number, findings: Finding[]): InspectorPhase[] => [
  createPhase("scope-activation", "PASS", true, `code-purity scans ${sourceFileCount} active files under ${BLUEPRINT_PATH}`),
  ...LAW_PHASE_SUMMARIES.map((summary) => createPhaseForLaw(summary.lawId, findings)),
];

export const inspectCodePurity = async (context: InspectorContext): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> => {
  const reportDraft = createEmptyPurityReport();
  const { relativePaths, touchedPaths, touchedBaselineSource, project } = await collectSourceFiles();
  reportDraft.touchedBaselineSource = touchedBaselineSource;
  reportDraft.touchedFiles = [...touchedPaths].sort((left, right) => left.localeCompare(right));
  reportDraft.scanScope = [...CODE_PURITY_SCAN_SCOPE];

  if (relativePaths.length === 0) {
    return {
      findings: [],
      phases: [
        createPhase("scope-activation", "ENFORCEMENT GAP", false, "code-purity scope is empty, so no real source checks can run"),
      ],
    };
  }

  const findings = [
    ...inspectSourcePaths(project, relativePaths, touchedPaths, reportDraft),
    ...inspectRequiredComponentExports(project),
    ...inspectCodePurityLawCoverage(context),
    ...(await inspectReportOutputs(reportDraft)),
    ...(await inspectRetiredMapSystem(relativePaths, collectSourceFileMap(project, relativePaths))),
    ...(await inspectVisualStoryCoherence(relativePaths, collectSourceFileMap(project, relativePaths))),
    ...(await inspectZombieScan(context.repoRoot, relativePaths)),
  ];

  debug(`findings=${findings.length}`);

  return { findings, phases: createInspectorPhases(relativePaths.length, findings) };
};
