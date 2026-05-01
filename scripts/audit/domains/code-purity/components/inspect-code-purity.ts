import { Project, type SourceFile } from "ts-morph";

import { fileExists, listFilesRecursive } from "../../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../../core/paths.js";
import { createFinding, createPhase } from "../../../core/result.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";
import { collectTouchedFilesArtifact } from "../../../core/touched-files-collector.js";
import { CODE_PURITY_LAW_IDS, LAW_PHASE_SUMMARIES } from "./purity-law-phase-data.js";
import { ACTIVE_FILES, ACTIVE_ROOTS, BLUEPRINT_PATH, CODE_PURITY_SCAN_EXTENSIONS, CODE_PURITY_SCAN_SCOPE } from "./purity-runtime-constants.js";
import { createEmptyPurityReport, inspectPurityMetrics } from "./purity-metric-inspection.js";
import { runCodePurityNegativeProof } from "./purity-negative-proof.js";
import { finalizePurityReport, writePurityReport } from "./purity-report.js";

const REQUIRED_COMPONENT_EXPORTS = [
  {
    relativePath: "scripts/audit/domains/code-purity/components/inspect-source-file.ts",
    exportName: "inspectSourceFile",
    lawId: "GRASSEYE-CODE-PURITY-011-V1",
    message: "Required code-purity component export inspectSourceFile is missing.",
  },
] as const;

const debug = (message: string): void => {
  if (process.env.GRASSEYE_AUDIT_DEBUG === "1") {
    process.stdout.write(`[code-purity-owner] ${message}\n`);
  }
};

const createPurityProject = (): Project =>
  new Project({
    tsConfigFilePath: pathFromRepoRoot("tsconfig.json"),
    skipAddingFilesFromTsConfig: false,
    compilerOptions: {
      allowJs: true,
    },
  });

const filterActiveRelativePaths = (relativePaths: string[]): string[] =>
  relativePaths.filter((relativePath) => ACTIVE_ROOTS.some((root) => relativePath === root || relativePath.startsWith(`${root}/`))).sort((left, right) => left.localeCompare(right));

const getActiveRelativePaths = async (): Promise<string[]> => {
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
  sourceFiles: SourceFile[];
}> => {
  const touchedSnapshot = await collectTouchedFilesArtifact();
  const relativePaths = await getActiveRelativePaths();
  const touchedPaths = new Set(filterActiveRelativePaths(touchedSnapshot.touchedFiles));
  debug(`activeRoots=${ACTIVE_ROOTS.join(",")}`);
  debug(`scannedCandidates=${relativePaths.length}`);
  const project = createPurityProject();
  const sourceFiles = relativePaths
    .map((relativePath) => project.addSourceFileAtPathIfExists(pathFromRepoRoot(relativePath)))
    .filter((sourceFile): sourceFile is SourceFile => Boolean(sourceFile));
  return { relativePaths, touchedPaths, touchedBaselineSource: touchedSnapshot.touchedBaselineSource, sourceFiles };
};

const inspectSourceFiles = (sourceFiles: SourceFile[], touchedPaths: Set<string>, reportDraft: ReturnType<typeof createEmptyPurityReport>): Finding[] =>
  sourceFiles.flatMap((sourceFile) => inspectPurityMetrics(sourceFile, toRepoRelativePath(sourceFile.getFilePath()), touchedPaths, reportDraft));

const inspectRequiredComponentExports = (project: Project): Finding[] =>
  REQUIRED_COMPONENT_EXPORTS.flatMap((requirement) => {
    const sourceFile = project.addSourceFileAtPathIfExists(pathFromRepoRoot(requirement.relativePath));
    const exportedDeclarations = sourceFile?.getExportedDeclarations().get(requirement.exportName);
    return exportedDeclarations && exportedDeclarations.length > 0
      ? []
      : [createFinding({
        lawId: requirement.lawId,
        file: requirement.relativePath,
        line: 1,
        severity: "error",
        message: requirement.message,
      })];
  });

const inspectLawCoverage = (context: InspectorContext): Finding[] => {
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

const runNegativeProofPhase = async (): Promise<{ findings: Finding[]; phase: InspectorPhase }> => {
  if (process.env.GRASSEYE_SKIP_CODE_PURITY_NEGATIVE_PROOF === "1") {
    return {
      findings: [],
      phase: createPhase("negative-proof-harness", "PASS", true, "Negative proof is skipped for nested code-purity harness runs."),
    };
  }
  return runCodePurityNegativeProof();
};

const createInspectorPhases = (sourceFiles: SourceFile[], findings: Finding[], negativeProofPhase: InspectorPhase): InspectorPhase[] => [
  createPhase("scope-activation", "PASS", true, `code-purity scans ${sourceFiles.length} active files under ${BLUEPRINT_PATH}`),
  ...LAW_PHASE_SUMMARIES.map((summary) => createPhaseForLaw(summary.lawId, findings)),
  negativeProofPhase,
];

export const inspectCodePurity = async (context: InspectorContext): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> => {
  const reportDraft = createEmptyPurityReport();
  const { touchedPaths, touchedBaselineSource, sourceFiles } = await collectSourceFiles();
  reportDraft.touchedBaselineSource = touchedBaselineSource;
  reportDraft.touchedFiles = [...touchedPaths].sort((left, right) => left.localeCompare(right));
  reportDraft.scanScope = [...CODE_PURITY_SCAN_SCOPE];

  if (sourceFiles.length === 0) {
    return {
      findings: [],
      phases: [
        createPhase("scope-activation", "ENFORCEMENT GAP", false, "code-purity scope is empty, so no real source checks can run"),
      ],
    };
  }

  const project = createPurityProject();
  const findings = [
    ...inspectSourceFiles(sourceFiles, touchedPaths, reportDraft),
    ...inspectRequiredComponentExports(project),
    ...inspectLawCoverage(context),
    ...(await inspectReportOutputs(reportDraft)),
  ];

  const negativeProof = await runNegativeProofPhase();
  findings.push(...negativeProof.findings);

  debug(`findings=${findings.length}`);

  return { findings, phases: createInspectorPhases(sourceFiles, findings, negativeProof.phase) };
};