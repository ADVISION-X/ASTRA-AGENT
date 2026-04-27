import { Project, type SourceFile } from "ts-morph";

import { fileExists, listFilesRecursive } from "../../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../../core/paths.js";
import { createPhase } from "../../../core/result.js";
import type { Finding, InspectorPhase } from "../../../core/schema.js";
import { ACTIVE_FILES, ACTIVE_ROOTS, BLUEPRINT_PATH, LAW_PHASE_SUMMARIES, type PurityPhaseSummary } from "./purity-constants.js";
import { inspectSourceFile } from "./inspect-source-file.js";

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

const createPhaseForLaw = (summary: PurityPhaseSummary, findings: Finding[]): InspectorPhase => {
  const hasLawFindings = findings.some((finding) => finding.lawId === summary.lawId);
  return createPhase(
    summary.name,
    hasLawFindings ? "CODE VIOLATION" : "PASS",
    !hasLawFindings,
    hasLawFindings ? summary.failedSummary : summary.okSummary,
  );
};

export const inspectCodePurity = async (): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> => {
  const findings: Finding[] = [];
  const relativePaths = await getActiveRelativePaths();
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
    inspectSourceFile(sourceFile, findings, toRepoRelativePath(sourceFile.getFilePath()));
  }

  const phases: InspectorPhase[] = [
    createPhase("scope-activation", "PASS", true, `code-purity scans ${sourceFiles.length} active files under ${BLUEPRINT_PATH}`),
    ...LAW_PHASE_SUMMARIES.map((summary) => createPhaseForLaw(summary, findings)),
  ];

  return { findings, phases };
};