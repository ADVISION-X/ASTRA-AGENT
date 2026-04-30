import { fileExists, listImmediateDirectories, listImmediateFiles } from "../../../core/filesystem.js";
import { createFinding, createPhase } from "../../../core/result.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";
import { pathFromRepoRoot } from "../../../core/paths.js";

import { codeTopologyShared } from "./topology-shared.js";

const { ALLOWED_DOC_DIRS, LAW_ID_002, REQUIRED_DOC_PATHS, RUNTIME_DIRS, isGitignoredRuntimeDir, isScatteredPhaseArtifact, path } = codeTopologyShared;

export async function inspectDocRuntimeTopology(context: InspectorContext): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const docFindings = await collectCanonicalDocFindings();
  const runtimeFindings = await collectRuntimeHygieneFindings(context);

  return {
    findings: [...docFindings, ...runtimeFindings],
    phases: [
      createPhase(
        "canonical-doc-paths",
        docFindings.length === 0 ? "PASS" : "ENFORCEMENT GAP",
        docFindings.length === 0,
        docFindings.length === 0 ? "Canonical phase-document directories exist." : "Canonical documentation paths are missing or drifted.",
      ),
      createPhase(
        "root-and-runtime-hygiene",
        runtimeFindings.length === 0 ? "PASS" : "CODE VIOLATION",
        runtimeFindings.length === 0,
        runtimeFindings.length === 0 ? "Root docs and runtime data hygiene are clean." : "Scattered root artifacts or runtime data directories were found.",
      ),
    ],
  };
}

async function collectCanonicalDocFindings(): Promise<Finding[]> {
  const findings: Finding[] = [];
  for (const requiredDocPath of REQUIRED_DOC_PATHS) {
    if (!(await fileExists(pathFromRepoRoot(requiredDocPath)))) {
      findings.push(createFinding({ lawId: LAW_ID_002, file: requiredDocPath, line: 1, severity: "error", message: "Canonical documentation path is missing." }));
    }
  }

  const docsDirNames = (await listImmediateDirectories(pathFromRepoRoot("docs"))).map((dirPath) => path.basename(dirPath));
  for (const docsDirName of docsDirNames) {
    if (!ALLOWED_DOC_DIRS.has(docsDirName)) {
      findings.push(createFinding({ lawId: LAW_ID_002, file: `docs/${docsDirName}`, line: 1, severity: "error", message: "Non-canonical documentation bucket found under docs." }));
    }
  }

  return findings;
}

async function collectRuntimeHygieneFindings(context: InspectorContext): Promise<Finding[]> {
  const findings: Finding[] = [];
  const rootFiles = await listImmediateFiles(context.repoRoot);
  for (const rootFile of rootFiles) {
    const fileName = path.basename(rootFile);
    if (isScatteredPhaseArtifact(fileName)) {
      findings.push(createFinding({ lawId: LAW_ID_002, file: fileName, line: 1, severity: "error", message: "Root-level scattered phase artifact found." }));
    }
  }

  for (const runtimeDir of RUNTIME_DIRS) {
    if (!(await fileExists(pathFromRepoRoot(runtimeDir))) || (await isGitignoredRuntimeDir(runtimeDir))) {
      continue;
    }
    findings.push(createFinding({ lawId: LAW_ID_002, file: runtimeDir, line: 1, severity: "error", message: "Runtime local data entered repository source truth." }));
  }

  return findings;
}