import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { CANONICAL_FILES, CHILDREN, ROOT } from "./constants.js";

export async function missingCanonicalFiles(): Promise<string[]> {
  const missing: string[] = [];

  for (const path of CANONICAL_FILES) {
    if (!(await fileExists(pathFromRepoRoot(path)))) {
      missing.push(path);
    }
  }

  for (const childId of CHILDREN) {
    for (const suffix of ["contract.ts", "schema.ts", "implementation.ts"]) {
      const path = `${ROOT}/children/${childId}/${suffix}`;
      if (!(await fileExists(pathFromRepoRoot(path)))) {
        missing.push(path);
      }
    }
  }

  return missing;
}