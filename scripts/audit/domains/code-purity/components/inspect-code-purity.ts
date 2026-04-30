import { spawnSync } from "node:child_process";

import { Project, type SourceFile } from "ts-morph";

import { fileExists, listFilesRecursive } from "../../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../../core/paths.js";
import { createFinding, createPhase } from "../../../core/result.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";
import { ACTIVE_FILES, ACTIVE_ROOTS, BLUEPRINT_PATH, CODE_PURITY_LAW_IDS, LAW_PHASE_SUMMARIES } from "./purity-constants.js";
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

const getActiveRelativePaths = async (): Promise<string[]> => {
  const discovered = new Set<string>(ACTIVE_FILES);

  for (const root of ACTIVE_ROOTS) {
    const absoluteRoot = pathFromRepoRoot(root);
    if (!(await fileExists(absoluteRoot))) {
      continue;
    }

    const files = await listFilesRecursive(absoluteRoot, { extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs"] });
    for (const file of files) {
      discovered.add(toRepoRelativePath(file));
    }
  }

  return [...discovered].sort((left, right) => left.localeCompare(right));
};

const getTouchedActiveRelativePaths = (): Set<string> => {
  const result = spawnSync("git", ["status", "--porcelain", "--untracked-files=all"], {
    cwd: pathFromRepoRoot("."),
    encoding: "utf8",
  });
  if (result.status !== 0 || !result.stdout) {
    return new Set<string>();
  }

  return new Set(
    result.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 3)
      .map((line) => line.slice(3).trim())
      .map((line) => (line.includes(" -> ") ? line.slice(line.indexOf(" -> ") + 4) : line))
      .filter((line) => ACTIVE_ROOTS.some((root) => line.startsWith(`${root}/`) || line === root)),
  );
};

const createPhaseForLaw = (lawId: string, findings: Finding[]): InspectorPhase => {
  const summary = LAW_PHASE_SUMMARIES.find((candidate) => candidate.lawId === lawId);
  const hasLawFindings = findings.some((finding) => finding.lawId === lawId);
  if (!summary) {
    return createPhase(`missing-${lawId.toLowerCase()}`, "FAKE ENFORCEMENT", false, `Missing phase summary for ${lawId}.`);
  }
  return createPhase(summary.name, hasLawFindings ? "CODE VIOLATION" : "PASS", !hasLawFindings, hasLawFindings ? summary.failedSummary : summary.okSummary);
};

export const inspectCodePurity = async (context: InspectorContext): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> => {
  const findings: Finding[] = [];
  const reportDraft = createEmptyPurityReport();
  const relativePaths = await getActiveRelativePaths();
  const touchedPaths = getTouchedActiveRelativePaths();
  debug(`activeRoots=${ACTIVE_ROOTS.join(",")}`);
  debug(`scannedCandidates=${relativePaths.length}`);
  const project = createPurityProject();
  const sourceFiles = relativePaths
    .map((relativePath) => project.addSourceFileAtPathIfExists(pathFromRepoRoot(relativePath)))
    .filter((sourceFile): sourceFile is SourceFile => Boolean(sourceFile));

  if (sourceFiles.length === 0) {
    return {
      findings,
      phases: [
        createPhase("scope-activation", "ENFORCEMENT GAP", false, "code-purity scope is empty, so no real source checks can run"),
      ],
    };
  }

  for (const sourceFile of sourceFiles) {
    findings.push(...inspectPurityMetrics(sourceFile, toRepoRelativePath(sourceFile.getFilePath()), touchedPaths, reportDraft));
  }

  for (const requirement of REQUIRED_COMPONENT_EXPORTS) {
    const sourceFile = project.addSourceFileAtPathIfExists(pathFromRepoRoot(requirement.relativePath));
    const exportedDeclarations = sourceFile?.getExportedDeclarations().get(requirement.exportName);
    if (!exportedDeclarations || exportedDeclarations.length === 0) {
      findings.push(
        createFinding({
          lawId: requirement.lawId,
          file: requirement.relativePath,
          line: 1,
          severity: "error",
          message: requirement.message,
        }),
      );
    }
  }

  const expectedLawIds = context.lawRegistry.laws
    .filter((law) => law.relativeFilePath === ".github/instructions/cursor-rules/modules/module-code-purity.instructions.md")
    .map((law) => law.lawId);
  const missingCoverage = expectedLawIds.filter((lawId) => !CODE_PURITY_LAW_IDS.includes(lawId as (typeof CODE_PURITY_LAW_IDS)[number]) || !LAW_PHASE_SUMMARIES.some((summary) => summary.lawId === lawId));
  for (const lawId of missingCoverage) {
    findings.push(createFinding({ lawId: "GRASSEYE-CODE-PURITY-011-V1", file: "scripts/audit/domains/code-purity/components/purity-constants.ts", line: 1, severity: "error", message: `Active code-purity law ${lawId} has no inspector phase coverage.` }));
  }

  const report = finalizePurityReport(reportDraft);
  await writePurityReport(report);
  if (report.remediationQueue.length === 0 || report.firstPhysicalSplitPlan.length === 0) {
    findings.push(createFinding({ lawId: "GRASSEYE-CODE-PURITY-013-V1", file: "scripts/audit/domains/code-purity/components/purity-report.ts", line: 1, severity: "error", message: "Code-purity report did not produce the required remediation queue and first physical split plan." }));
  }

  let negativeProofPhase = createPhase("negative-proof-harness", "PASS", true, "Negative proof is skipped for nested code-purity harness runs.");
  if (process.env.GRASSEYE_SKIP_CODE_PURITY_NEGATIVE_PROOF !== "1") {
    const negativeProof = await runCodePurityNegativeProof();
    findings.push(...negativeProof.findings);
    negativeProofPhase = negativeProof.phase;
  }

  debug(`findings=${findings.length}`);

  const phases: InspectorPhase[] = [
    createPhase("scope-activation", "PASS", true, `code-purity scans ${sourceFiles.length} active files under ${BLUEPRINT_PATH}`),
    ...LAW_PHASE_SUMMARIES.map((summary) => createPhaseForLaw(summary.lawId, findings)),
    negativeProofPhase,
  ];

  return { findings, phases };
};