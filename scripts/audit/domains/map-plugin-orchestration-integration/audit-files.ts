import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";

export async function missingFiles(paths: readonly string[]): Promise<string[]> {
  const states = await Promise.all(paths.map(async (filePath) => ({ filePath, exists: await fileExists(pathFromRepoRoot(filePath)) })));
  return states.filter((state) => !state.exists).map((state) => state.filePath);
}