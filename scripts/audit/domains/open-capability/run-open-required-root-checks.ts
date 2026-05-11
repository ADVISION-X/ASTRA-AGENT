import { fileExists, listFilesRecursive } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";

import { OPEN_REQUIRED_FILES, openInspectionConstants } from "./inspection-constants.js";

const { LAW_PACKAGE_SHAPE, OPEN_ROOT } = openInspectionConstants;

type OpenRootPresenceResult = {
  findings: Finding[];
  openRootBound: boolean;
};

export async function runOpenRequiredRootChecks(): Promise<OpenRootPresenceResult> {
  const findings: Finding[] = [];

  for (const requiredFile of OPEN_REQUIRED_FILES) {
    if (!(await fileExists(pathFromRepoRoot(requiredFile)))) {
      findings.push(createFinding({ lawId: LAW_PACKAGE_SHAPE, file: requiredFile, line: 1, severity: "fatal", message: "Open capability required package or audit file is missing." }));
    }
  }

  const repoOpenTsFiles = await listFilesRecursive(pathFromRepoRoot(OPEN_ROOT), { extensions: [".ts"] });
  return { findings, openRootBound: repoOpenTsFiles.length > 0 };
}